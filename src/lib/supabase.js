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
