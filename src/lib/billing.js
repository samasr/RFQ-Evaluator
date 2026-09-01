// Client for the billing routes on the AI-proxy Worker (Phase 7b).
// Every call carries the Supabase access token; the Worker verifies the
// payment with the provider before it promotes the user's plan.

import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_AI_PROXY_URL;

// Card payment (mada / Visa / Apple Pay) via Moyasar — Saudi customers.
export const MOYASAR_PUBLISHABLE_KEY = import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY;
export const MOYASAR_ENABLED = Boolean(MOYASAR_PUBLISHABLE_KEY);

// Hosted checkout via Stripe — international customers.
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
export const STRIPE_ENABLED = Boolean(STRIPE_PUBLIC_KEY);

export const BILLING_ENABLED = Boolean(BASE) && (MOYASAR_ENABLED || STRIPE_ENABLED);

// SAR minor units (halalas for Moyasar; Stripe SAR uses the same 2-decimal unit).
export const PLAN_AMOUNT_HALALAS = { pro: 29900, team: 79900 };

async function authedPost(path, body) {
  if (!supabase) throw new Error("Accounts aren't enabled on this deployment.");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Please sign in first.");

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}

// Returns { url } — redirect the browser there.
export function createStripeSession(plan) {
  return authedPost("/billing/stripe/create-session", { plan });
}

// Both return { plan } once the payment is confirmed and the plan applied.
export function verifyStripePayment(sessionId) {
  return authedPost("/billing/stripe/verify", { sessionId });
}
export function verifyMoyasarPayment(paymentId) {
  return authedPost("/billing/moyasar/verify", { paymentId });
}
