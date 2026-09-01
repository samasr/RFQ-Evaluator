// Shared env + CORS helpers for the AI proxy and the billing routes.

export interface Env {
  // AI proxy
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  RL_IP: RateLimit;
  RL_GLOBAL: RateLimit;

  // Billing (Phase 7b) — see wrangler.toml. The *_SECRET_KEY and
  // SERVICE_ROLE key are wrangler secrets, never committed.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  MOYASAR_SECRET_KEY?: string;
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
