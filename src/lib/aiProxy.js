// Shared helpers for talking to the Cloudflare Worker AI proxy.
//
// When Supabase auth is configured (production), every AI request carries the
// user's short-lived Supabase access token. The Worker rejects requests without
// a valid token (see worker/src/index.ts), so a non-browser client can't just
// spoof the Origin header and spend our Anthropic quota. On an unconfigured
// build (local "local mode") there's no session and no token — the Worker there
// is also unconfigured and keeps the origin-only check, so nothing breaks.

import { supabase } from "./supabase";

// Headers for a POST to the AI proxy. Adds `Authorization: Bearer <jwt>` when
// the user has a live Supabase session.
export async function aiProxyHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Thrown when the Worker rejects a request because the user's plan doesn't
// include the feature (HTTP 403 + { code: "plan_required" }). Carries the
// Worker's own upgrade message so callers can show it in the UpgradeModal.
export class PlanRequiredError extends Error {
  constructor(message) {
    super(message || "This feature requires the Pro plan.");
    this.name = "PlanRequiredError";
    this.planRequired = true;
  }
}

// Call right after a proxy fetch, before treating the response as a success:
//  - 401 → bounce the user to /login and throw a clear error
//  - 403 plan gate → throw PlanRequiredError with the Worker's message
// Any other status is left for the caller to handle off response.ok.
export async function assertProxyResponseOk(response) {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.hash = "#/login";
    }
    throw new Error("Please sign in to use AI features.");
  }
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => null);
    if (body && body.code === "plan_required") {
      throw new PlanRequiredError(body.error);
    }
  }
}
