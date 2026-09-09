import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase, isAuthConfigured, authRedirectTo } from "../lib/supabase";

const AuthContext = createContext(null);

const NOT_CONFIGURED = new Error(
  "Accounts aren't enabled on this deployment yet."
);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // `loading` covers the initial session check only; once resolved the app renders.
  const [loading, setLoading] = useState(isAuthConfigured);
  const profileReqId = useRef(0);

  const user = session?.user ?? null;

  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const reqId = ++profileReqId.current;
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, email, name, plan, evaluations_count, created_at, trial_ends_at, trial_plan"
      )
      .eq("id", uid)
      .maybeSingle();
    if (reqId !== profileReqId.current) return; // superseded
    if (error) {
      setProfile(null);
      return;
    }
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    if (!isAuthConfigured) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
      if (data.session?.user) loadProfile(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      if (next?.user) loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async ({ name, email, password }) => {
    if (!isAuthConfigured) throw NOT_CONFIGURED;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: authRedirectTo("/dashboard") },
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithPassword = useCallback(async ({ email, password }) => {
    if (!isAuthConfigured) throw NOT_CONFIGURED;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!isAuthConfigured) throw NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo("/dashboard") },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!isAuthConfigured) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    if (!isAuthConfigured) throw NOT_CONFIGURED;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectTo("/reset-password"),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!isAuthConfigured) throw NOT_CONFIGURED;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(() => {
    if (user) return loadProfile(user.id);
    return Promise.resolve();
  }, [user, loadProfile]);

  // `local` = every feature unlocked (unconfigured build, or public browsing).
  const rawPlan = !isAuthConfigured || !user ? "local" : profile?.plan ?? "free";

  // Trial state: a 7-day Pro/Team trial granted at signup (see
  // handle_new_user() in supabase/migrations/0004_trial.sql). Mirrors
  // resolveEffectivePlan() in worker/src/http.ts — keep both in sync.
  const trialEndsAtMs = profile?.trial_ends_at
    ? new Date(profile.trial_ends_at).getTime()
    : null;
  const hasTrialHistory = Boolean(trialEndsAtMs && profile?.trial_plan);
  const trialActive = hasTrialHistory && trialEndsAtMs > Date.now();
  const trialExpired = hasTrialHistory && !trialActive && rawPlan === "free";
  const trialDaysLeft = trialActive
    ? Math.max(1, Math.ceil((trialEndsAtMs - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // `plan` is the effective plan used for feature-gating everywhere in the
  // app: a paid plan always wins, otherwise an active trial temporarily
  // unlocks its plan's features. `rawPlan` is the actual billing plan
  // (ignoring any trial) — use it for pricing/billing UI ("current plan",
  // trial eligibility) where the real subscription tier matters.
  const plan = rawPlan === "free" && trialActive ? profile.trial_plan : rawPlan;

  const value = useMemo(
    () => ({
      isAuthConfigured,
      loading,
      session,
      user,
      profile,
      plan,
      rawPlan,
      trialActive,
      trialExpired,
      trialDaysLeft,
      displayName:
        profile?.name || user?.user_metadata?.name || user?.email || "",
      signUp,
      signInWithPassword,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [
      loading,
      session,
      user,
      profile,
      plan,
      rawPlan,
      trialActive,
      trialExpired,
      trialDaysLeft,
      signUp,
      signInWithPassword,
      signInWithGoogle,
      signOut,
      sendPasswordReset,
      updatePassword,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
