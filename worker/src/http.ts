// Shared env + CORS helpers for the AI proxy and the billing routes.

export interface Env {
  // AI proxy
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  RL_IP: RateLimit;
  RL_GLOBAL: RateLimit;

  // Supabase — see wrangler.toml. Used to authenticate AI-proxy callers and
  // by the billing routes (Phase 7b). The *_SECRET_KEY and SERVICE_ROLE key
  // are wrangler secrets, never committed.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  APP_URL?: string;
}

export function resolveAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  origin: string,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

// True once the Worker has the Supabase config it needs to verify session
// tokens. When false (e.g. a bare `wrangler dev`), callers fall back to the
// origin-only check.
export function isSupabaseConfigured(env: Env): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}

// Verifies a Supabase access token from `Authorization: Bearer <jwt>` by asking
// the Supabase Auth API who it belongs to. Returns the user, or null when the
// token is missing, malformed, expired, or otherwise rejected. Never throws.
export async function verifySupabaseToken(
  request: Request,
  env: Env
): Promise<{ id: string; email: string } | null> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string; email?: string };
    return user.id ? { id: user.id, email: user.email || "" } : null;
  } catch {
    return null;
  }
}
