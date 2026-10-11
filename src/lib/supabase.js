import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When the Supabase env vars aren't set, the whole app runs in "local mode":
// no accounts, no route protection, evaluations in localStorage, every feature
// unlocked — i.e. exactly how the app worked before Phase 7. This lets the
// preview build (which has no Supabase config) stay fully functional.
export const isAuthConfigured = Boolean(url && anonKey);

export const supabase = isAuthConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// HashRouter means OAuth / password-recovery redirects must land on a real
// path and let the app route via the hash fragment afterwards.
export function authRedirectTo(hashPath = "/dashboard") {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${hashPath}`;
}

// Those redirects then arrive as /#/dashboard#access_token=… — HashRouter's
// fragment plus Supabase's. supabase-js only parses the first fragment, so it
// never sees the tokens (Google sign-in, signup confirmation). Establish the
// session from the second fragment and strip the tokens from the address bar.
// /reset-password parses its own tokens (see ResetPassword.jsx).
export async function consumeRedirectSession() {
  const { pathname, search, hash } = window.location;
  const second = hash.indexOf("#", 1);
  if (second === -1 || hash.startsWith("#/reset-password")) return;

  const params = new URLSearchParams(hash.slice(second + 1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token && !params.get("error")) return;

  window.history.replaceState(
    window.history.state,
    "",
    `${pathname}${search}${hash.slice(0, second)}`
  );
  if (!access_token || !refresh_token) {
    console.error("[auth] redirect failed:", params.get("error_description"));
    return;
  }
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) console.error("[auth] couldn't establish session from redirect", error);
}
