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
      .select("id, email, name, plan, evaluations_count, created_at")
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
  const plan = !isAuthConfigured || !user ? "local" : profile?.plan ?? "free";

  const value = useMemo(
    () => ({
      isAuthConfigured,
      loading,
      session,
      user,
      profile,
      plan,
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
