// Billing routes for the AI-proxy Worker (Phase 7b + H2).
//
//   POST /billing/stripe/create-session  { plan }       -> { url }
//   POST /billing/stripe/verify          { sessionId }  -> { plan }
//   POST /billing/stripe/webhook         (Stripe event) -> { received: true }
//
// create-session / verify require a Supabase access token in
// `Authorization: Bearer …`; the webhook is authenticated by its Stripe
// signature instead. Plan upgrades are only applied AFTER the payment is
// independently verified (paid + correct amount + belongs to this user); the
// client-supplied plan is never trusted on its own. Every upgrade goes through
// applyPaidSession(), which records the payment in public.payments and is
// idempotent on the Stripe session id — a replayed session never upgrades
// twice.

import { Env, corsHeaders, jsonResponse, resolveAllowedOrigin } from "./http";

type PlanId = "pro" | "team";

// SAR minor units — Stripe SAR amounts use a 2-decimal minor unit.
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

// Base URL + auth headers for PostgREST calls made with the service-role key
// (bypasses RLS). Throws 503 when the Worker isn't configured for billing.
function serviceRest(env: Env): { base: string; headers: Record<string, string> } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, "Billing is not configured");
  }
  return {
    base: env.SUPABASE_URL,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  };
}

// Promotes the user's plan using the service-role key (bypasses RLS). The
// plan-change guard trigger in the DB allows this only for the service role.
async function upgradePlan(env: Env, userId: string, plan: PlanId): Promise<void> {
  const { base, headers } = serviceRest(env);
  const res = await fetch(
    `${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ plan }),
    }
  );
  if (!res.ok) {
    console.error(`[billing] upgradePlan failed for user ${userId} (${res.status})`);
    throw new HttpError(502, "Database error. Please try again.");
  }
}

// ── Payment audit trail + idempotency (H2) ───────────────────────────────────

type PaymentStatus = "pending" | "completed" | "failed";

interface PaymentRow {
  user_id: string;
  plan: PlanId;
  status: PaymentStatus;
}

// A Stripe session we've been asked to act on, normalised from either the
// /verify call or a webhook event.
interface PaidSession {
  id: string;
  userId: string;
  amountTotal: number;
  currency: string;
  plan: PlanId;
}

async function findPayment(
  env: Env,
  providerPaymentId: string
): Promise<PaymentRow | null> {
  const { base, headers } = serviceRest(env);
  const res = await fetch(
    `${base}/rest/v1/payments?provider=eq.stripe&provider_payment_id=eq.${encodeURIComponent(
      providerPaymentId
    )}&select=user_id,plan,status&limit=1`,
    { headers }
  );
  if (!res.ok) {
    console.error(`[billing] findPayment failed for ${providerPaymentId} (${res.status})`);
    throw new HttpError(502, "Database error. Please try again.");
  }
  const rows = (await res.json()) as PaymentRow[];
  return rows[0] ?? null;
}

// Inserts the row as `pending`. A 409 means a concurrent call already inserted
// it (the UNIQUE constraint) — harmless, we carry on and (re)apply the upgrade.
async function insertPendingPayment(env: Env, s: PaidSession): Promise<void> {
  const { base, headers } = serviceRest(env);
  const res = await fetch(`${base}/rest/v1/payments`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: s.userId,
      provider: "stripe",
      provider_payment_id: s.id,
      amount: s.amountTotal,
      currency: s.currency,
      plan: s.plan,
      status: "pending",
    }),
  });
  if (res.status === 409) return;
  if (!res.ok) {
    console.error(`[billing] insertPendingPayment failed for ${s.id} (${res.status})`);
    throw new HttpError(502, "Database error. Please try again.");
  }
}

async function setPaymentStatus(
  env: Env,
  providerPaymentId: string,
  status: PaymentStatus
): Promise<void> {
  const { base, headers } = serviceRest(env);
  const res = await fetch(
    `${base}/rest/v1/payments?provider=eq.stripe&provider_payment_id=eq.${encodeURIComponent(
      providerPaymentId
    )}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) {
    console.error(`[billing] setPaymentStatus failed for ${providerPaymentId} (${res.status})`);
    throw new HttpError(502, "Database error. Please try again.");
  }
}

// The single idempotent path both /verify and the webhook go through: record
// the payment once, apply the plan upgrade once. Safe to call repeatedly for
// the same session id — a completed row short-circuits, a pending row (e.g. the
// user closed the tab mid-verify) just re-applies the idempotent upgrade.
async function applyPaidSession(
  env: Env,
  s: PaidSession
): Promise<{ plan: PlanId; alreadyProcessed: boolean }> {
  const existing = await findPayment(env, s.id);
  if (existing && existing.status === "completed") {
    return { plan: existing.plan, alreadyProcessed: true };
  }
  if (!existing) {
    await insertPendingPayment(env, s);
  }
  try {
    await upgradePlan(env, s.userId, s.plan);
  } catch (err) {
    await setPaymentStatus(env, s.id, "failed").catch(() => {});
    throw err;
  }
  await setPaymentStatus(env, s.id, "completed");
  return { plan: s.plan, alreadyProcessed: Boolean(existing) };
}

// ── Stripe webhook signature ─────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Verifies a `Stripe-Signature` header (`t=…,v1=…[,v1=…]`) against the raw
// request body, per Stripe's scheme: HMAC-SHA256 of `${t}.${payload}` keyed
// with the endpoint's signing secret, plus a timestamp tolerance.
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  if (!header) return false;
  let t = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "t") t = val;
    else if (key === "v1") v1.push(val);
  }
  const ts = Number(t);
  if (!t || v1.length === 0 || !Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${t}.${payload}`)
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return v1.some((sig) => timingSafeEqual(sig, expected));
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
    console.error("[billing] stripeCreateSession failed", data.error?.message);
    throw new HttpError(502, "Payment processing failed. Please try again.");
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

  // Idempotent: records the payment once and upgrades once, however many times
  // this session id is submitted (double-clicks, refreshes, or the webhook
  // having already handled it).
  const { plan: applied } = await applyPaidSession(env, {
    id: sessionId,
    userId: user.id,
    amountTotal: s.amount_total || 0,
    currency: (s.currency || "sar").toUpperCase(),
    plan,
  });
  return { plan: applied };
}

// ── Stripe webhook ───────────────────────────────────────────────────────────

// POST /billing/stripe/webhook — called by Stripe server-to-server, so there's
// no Origin and no Supabase JWT; the Stripe-Signature header is the auth. This
// is the backstop that upgrades the account even if the user closed the tab
// before /verify ran.
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook not configured" }, 503);

  const raw = await request.text();
  const signature = request.headers.get("Stripe-Signature") || "";
  if (!(await verifyStripeSignature(raw, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event: {
    type?: string;
    data?: { object?: Record<string, any> };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object ?? {};
      const userId: string | undefined =
        session.client_reference_id || session.metadata?.user_id;
      const plan = planForAmount(session.amount_total || 0);
      const metaPlan: string | undefined = session.metadata?.plan;
      if (
        session.payment_status === "paid" &&
        userId &&
        plan &&
        (!metaPlan || metaPlan === plan) &&
        typeof session.id === "string"
      ) {
        await applyPaidSession(env, {
          id: session.id,
          userId,
          amountTotal: session.amount_total || 0,
          currency: (session.currency || "sar").toUpperCase(),
          plan,
        });
      }
    }
  } catch (err) {
    // Our DB write failed — return non-2xx so Stripe retries the delivery.
    // The response body isn't shown to any end user (Stripe only inspects
    // the status code to decide whether to retry), but keep it generic and
    // log the real cause internally rather than echoing it back regardless.
    console.error("[billing] webhook processing failed", err);
    const status = err instanceof HttpError ? err.status : 500;
    const message =
      err instanceof HttpError ? err.message : "Webhook processing failed";
    return json({ error: message }, status);
  }

  return json({ received: true }, 200);
}

// ── Router ───────────────────────────────────────────────────────────────────

const ROUTES: Record<
  string,
  (request: Request, env: Env) => Promise<unknown>
> = {
  "/billing/stripe/create-session": stripeCreateSession,
  "/billing/stripe/verify": stripeVerify,
};

export function isBillingPath(pathname: string): boolean {
  return (
    pathname in ROUTES ||
    pathname === "/billing" ||
    pathname === "/billing/stripe/webhook"
  );
}

export async function handleBilling(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  // The webhook is server-to-server from Stripe: no browser Origin, no JWT,
  // signature-verified instead. It must skip the origin/method gate below.
  if (pathname === "/billing/stripe/webhook") {
    return handleStripeWebhook(request, env);
  }

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
    // HttpError messages thrown in this file are curated to be safe to show
    // the user (validation failures like "Unknown plan" or "Payment not
    // completed") — third-party/DB failures are sanitized to a generic
    // message at the point they're wrapped into an HttpError, above. Any
    // other error here is unexpected, so it never reaches the client as-is.
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status, origin);
    }
    console.error("[billing] unexpected error", err);
    return jsonResponse(
      { error: "Payment processing failed. Please try again." },
      500,
      origin
    );
  }
}
