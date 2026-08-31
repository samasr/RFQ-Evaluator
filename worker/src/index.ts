import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  // Rate limit bindings (see wrangler.toml). Per-Cloudflare-location, not global.
  RL_IP: RateLimit;
  RL_GLOBAL: RateLimit;
}

const MODEL = "claude-sonnet-4-6";
const MAX_PROMPT_CHARS = 40000;
const MAX_DOCUMENTS = 10;
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024; // ~15MB base64 per file

interface DocumentInput {
  mediaType: string;
  data: string; // base64, no data: URI prefix
}

interface RequestBody {
  prompt?: string;
  documents?: DocumentInput[];
  maxTokens?: number;
}

function resolveAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function isImageMediaType(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded — wait a minute and try again." }),
        {
          status: 429,
          headers: {
            ...corsHeaders(origin),
            "Content-Type": "application/json",
            "Retry-After": "60",
          },
        }
      );
    }

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
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
  },
};
