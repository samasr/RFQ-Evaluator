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

// Call right after a proxy fetch: if the Worker rejected the request for lack
// of a valid session, bounce the user to /login and surface a clear error.
export function throwIfUnauthorized(response) {
  if (response.status !== 401) return;
  if (typeof window !== "undefined") {
    window.location.hash = "#/login";
  }
  throw new Error("Please sign in to use AI features.");
}
