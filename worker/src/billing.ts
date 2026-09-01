// Billing routes for the AI-proxy Worker (Phase 7b).
//
//   POST /billing/stripe/create-session  { plan }            -> { url }
//   POST /billing/stripe/verify          { sessionId }       -> { plan }
//   POST /billing/moyasar/verify         { paymentId }       -> { plan }
//
// Every route requires a Supabase access token in `Authorization: Bearer …`.
// Plan upgrades are only applied AFTER the payment is independently verified
// with the provider (paid + correct amount + belongs to this user). The
// client-supplied plan is never trusted on its own.

import { Env, corsHeaders, jsonResponse, resolveAllowedOrigin } from "./http";

type PlanId = "pro" | "team";

// SAR minor units. Moyasar amounts are in halalas; Stripe SAR amounts use the
// same 2-decimal minor unit, so one table covers both.
const PLAN_AMOUNT: Record<PlanId, number> = {
  pro: 29900,
  team: 79900,
};
const PLAN_NAME: Record<PlanId, string> = {
  pro: "RFQ Ranker Pro",
  team: "RFQ Ranker Team",
};

function isPlan(v: unknown): v is PlanId {
  return v === "pro" || v === "team";
}

function planForAmount(amount: number): PlanId | null {
  if (amount === PLAN_AMOUNT.pro) return "pro";
  if (amount === PLAN_AMOUNT.team) return "team";
  return null;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Verifies the caller's Supabase JWT and returns the authenticated user.
async function authUser(
  request: Request,
  env: Env
): Promise<{ id: string; email: string }> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new HttpError(503, "Billing is not configured");
  }
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new HttpError(401, "Invalid or expired session");
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user.id) throw new HttpError(401, "Invalid session");
  return { id: user.id, email: user.email || "" };
}

// Promotes the user's plan using the service-role key (bypasses RLS). The
// plan-change guard trigger in the DB allows this only for the service role.
async function upgradePlan(env: Env, userId: string, plan: PlanId): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, "Billing is not configured");
  }
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ plan }),
    }
  );
  if (!res.ok) {
    throw new HttpError(502, `Could not update plan (${res.status})`);
  }
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

// ── Stripe ───────────────────────────────────────────────────────────────────

async function stripeCreateSession(
  request: Request,
  env: Env
): Promise<{ url: string }> {
  const user = await authUser(request, env);
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "Stripe is not configured");
  const { plan } = await readJson<{ plan?: string }>(request);
  if (!isPlan(plan)) throw new HttpError(400, "Unknown plan");

  const appUrl = env.APP_URL || "https://rfqranker.com";
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("client_reference_id", user.id);
  if (user.email) form.set("customer_email", user.email);
  form.set("success_url", `${appUrl}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${appUrl}/#/checkout?plan=${plan}`);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "sar");
  form.set("line_items[0][price_data][unit_amount]", String(PLAN_AMOUNT[plan]));
  form.set("line_items[0][price_data][product_data][name]", PLAN_NAME[plan]);
  form.set("metadata[plan]", plan);
  form.set("metadata[user_id]", user.id);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new HttpError(502, data.error?.message || "Stripe session failed");
  }
  return { url: data.url };
}

async function stripeVerify(
  request: Request,
  env: Env
): Promise<{ plan: PlanId }> {
  const user = await authUser(request, env);
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, "Stripe is not configured");
  const { sessionId } = await readJson<{ sessionId?: string }>(request);
  if (!sessionId) throw new HttpError(400, "Missing sessionId");

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  const s = (await res.json()) as {
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    client_reference_id?: string;
    metadata?: { plan?: string; user_id?: string };
  };
  if (!res.ok) throw new HttpError(502, "Could not retrieve Stripe session");
  if (s.payment_status !== "paid") throw new HttpError(402, "Payment not completed");
  if (s.client_reference_id !== user.id && s.metadata?.user_id !== user.id) {
    throw new HttpError(403, "Payment does not belong to this account");
  }
  const plan = planForAmount(s.amount_total || 0);
  if (!plan || (s.metadata?.plan && s.metadata.plan !== plan)) {
    throw new HttpError(422, "Unrecognised payment amount");
  }

  await upgradePlan(env, user.id, plan);
  return { plan };
}

// ── Moyasar ──────────────────────────────────────────────────────────────────

async function moyasarVerify(
  request: Request,
  env: Env
): Promise<{ plan: PlanId }> {
  const user = await authUser(request, env);
  if (!env.MOYASAR_SECRET_KEY) throw new HttpError(503, "Moyasar is not configured");
  const { paymentId } = await readJson<{ paymentId?: string }>(request);
  if (!paymentId) throw new HttpError(400, "Missing paymentId");

  const res = await fetch(
    `https://api.moyasar.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Basic ${btoa(`${env.MOYASAR_SECRET_KEY}:`)}` } }
  );
  const p = (await res.json()) as {
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: { plan?: string; user_id?: string };
  };
  if (!res.ok) throw new HttpError(502, "Could not retrieve Moyasar payment");
  if (p.status !== "paid") throw new HttpError(402, "Payment not completed");
  if ((p.currency || "SAR").toUpperCase() !== "SAR") {
    throw new HttpError(422, "Unexpected payment currency");
  }
  if (p.metadata?.user_id && p.metadata.user_id !== user.id) {
    throw new HttpError(403, "Payment does not belong to this account");
  }
  const plan = planForAmount(p.amount || 0);
  if (!plan || (p.metadata?.plan && p.metadata.plan !== plan)) {
    throw new HttpError(422, "Unrecognised payment amount");
  }

  await upgradePlan(env, user.id, plan);
  return { plan };
}

// ── Router ───────────────────────────────────────────────────────────────────

const ROUTES: Record<
  string,
  (request: Request, env: Env) => Promise<unknown>
> = {
  "/billing/stripe/create-session": stripeCreateSession,
  "/billing/stripe/verify": stripeVerify,
  "/billing/moyasar/verify": moyasarVerify,
};

export function isBillingPath(pathname: string): boolean {
  return pathname in ROUTES || pathname === "/billing" ;
}

export async function handleBilling(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  const origin = resolveAllowedOrigin(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (!origin) return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const handler = ROUTES[pathname];
  if (!handler) return jsonResponse({ error: "Not found" }, 404, origin);

  try {
    const body = await handler(request, env);
    return jsonResponse(body, 200, origin);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Billing error";
    return jsonResponse({ error: message }, status, origin);
  }
}
