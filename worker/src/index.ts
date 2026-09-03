import Anthropic from "@anthropic-ai/sdk";
import {
  Env,
  corsHeaders,
  jsonResponse,
  resolveAllowedOrigin,
  isSupabaseConfigured,
  isPlanEnforced,
  verifySupabaseToken,
  fetchUserPlan,
} from "./http";
import { handleBilling } from "./billing";

export type { Env };

const MODEL = "claude-sonnet-4-6";
const MAX_PROMPT_CHARS = 40000;
const MAX_DOCUMENTS = 10;
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024; // ~15MB base64 per file

// Plans that unlock the AI proxy. Everything the proxy does (scoring, memos,
// clarifications, PDF extraction) is a paid feature — the free plan can't reach
// Anthropic through here at all. Kept in lockstep with src/lib/planLimits.js.
const PAID_PLANS = new Set(["pro", "team"]);

// Frontend-supplied `feature` tag -> label for the 403 message. The gate rule
// is uniform (paid plan required), so this only tailors the wording.
const FEATURE_LABEL: Record<string, string> = {
  aiScoring: "AI scoring",
  decisionMemo: "Decision memo generation",
  clarification: "Clarification questions",
  extraction: "PDF quote extraction",
};

function planGateMessage(feature: string | undefined): string {
  const label = (feature && FEATURE_LABEL[feature]) || "This AI feature";
  return `${label} requires the Pro plan. Upgrade at rfqranker.com/pricing`;
}

interface DocumentInput {
  mediaType: string;
  data: string; // base64, no data: URI prefix
}

interface RequestBody {
  prompt?: string;
  documents?: DocumentInput[];
  maxTokens?: number;
  feature?: string;
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

// The AI proxy: bare-path POST { prompt, documents?, maxTokens? } -> { text }.
async function handleAiProxy(request: Request, env: Env): Promise<Response> {
  const origin = resolveAllowedOrigin(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }
  // Requests from origins outside the allowlist get no CORS headers, so the
  // browser blocks the response client-side; we also reject them here.
  if (!origin) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  // A per-IP cap plus a whole-worker circuit breaker so a scripted client or
  // a runaway loop can't run up the Anthropic bill. Checked before the body
  // is read so blocked requests cost almost nothing.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const [perIp, global] = await Promise.all([
    env.RL_IP.limit({ key: clientIp }),
    env.RL_GLOBAL.limit({ key: "all" }),
  ]);
  if (!perIp.success || !global.success) {
    return jsonResponse(
      { error: "Rate limit exceeded — wait a minute and try again." },
      429,
      origin,
      { "Retry-After": "60" }
    );
  }

  // Authentication: on a Supabase-configured proxy (production) every request
  // must carry a valid Supabase session token. This is what actually protects
  // the Anthropic key — the Origin check above is spoofable by non-browser
  // clients. A proxy with no Supabase config (a bare `wrangler dev`) skips this
  // and keeps the origin-only check so the local dev workflow isn't blocked.
  let userId: string | null = null;
  if (isSupabaseConfigured(env)) {
    const user = await verifySupabaseToken(request, env);
    if (!user) {
      return jsonResponse(
        { error: "Sign in required to use AI features." },
        401,
        origin
      );
    }
    userId = user.id;
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
  }

  // Plan enforcement (C3): the plan lives in `public.users`, not in the JWT, so
  // it's checked here rather than trusting the client-side gate in
  // planLimits.js / FeatureGate. Only runs when the Worker has the service-role
  // key; without it the proxy stays auth-only.
  if (userId && isPlanEnforced(env)) {
    let plan: string;
    try {
      plan = await fetchUserPlan(env, userId);
    } catch {
      return jsonResponse(
        { error: "Couldn't verify your plan — try again in a moment." },
        503,
        origin
      );
    }
    if (!PAID_PLANS.has(plan)) {
      return jsonResponse(
        { error: planGateMessage(body.feature), code: "plan_required" },
        403,
        origin
      );
    }
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return jsonResponse({ error: "Missing 'prompt' field" }, 400, origin);
  }
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    return jsonResponse({ error: "Prompt too large" }, 413, origin);
  }

  const documents = Array.isArray(body.documents) ? body.documents : [];
  if (documents.length > MAX_DOCUMENTS) {
    return jsonResponse({ error: `Too many documents (max ${MAX_DOCUMENTS})` }, 413, origin);
  }
  for (const doc of documents) {
    if (!doc.mediaType || !doc.data) {
      return jsonResponse({ error: "Each document needs mediaType and data" }, 400, origin);
    }
    if (doc.data.length > MAX_DOCUMENT_BYTES) {
      return jsonResponse({ error: "A document exceeds the size limit" }, 413, origin);
    }
  }

  const content: Anthropic.MessageParam["content"] = [
    ...documents.map((doc): Anthropic.ContentBlockParam =>
      isImageMediaType(doc.mediaType)
        ? {
            type: "image",
            source: { type: "base64", media_type: doc.mediaType as any, data: doc.data },
          }
        : {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: doc.data },
          }
    ),
    { type: "text", text: body.prompt },
  ];

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: Math.min(body.maxTokens || 4096, 8192),
      messages: [{ role: "user", content }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return jsonResponse(
      { text: textBlock && "text" in textBlock ? textBlock.text : "" },
      200,
      origin
    );
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err && Number.isInteger((err as any).status)
        ? (err as any).status
        : 500;
    const message = err instanceof Error ? err.message : "Anthropic API error";
    return jsonResponse({ error: message }, status, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/billing/")) {
      return handleBilling(request, env, pathname);
    }
    return handleAiProxy(request, env);
  },
};
