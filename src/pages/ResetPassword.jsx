import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthShell, { FormAlert, FieldError } from "../components/AuthShell";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-sm font-medium text-navy mb-1";

// The recovery link lands on /#/reset-password#access_token=…&refresh_token=…
// (HashRouter's "#" plus Supabase's own). supabase-js only parses the first
// fragment, so read every "?"/"#"-delimited segment of the full href instead.
function readRecoveryParams(href) {
  const params = new URLSearchParams();
  for (const part of href.split(/[?#]/).slice(1)) {
    new URLSearchParams(part).forEach((value, key) => params.set(key, value));
  }
  return params;
}

// Reached from the password-recovery email link. Establishes the recovery
// session from the URL tokens before showing the form, so that
// updateUser({ password }) has a session to act on.
export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isAuthConfigured, setRecoverySession, updatePassword } = useAuth();

  // Read once: the effect below strips the tokens from the address bar, and
  // StrictMode re-runs effects in dev.
  const [params] = useState(() => readRecoveryParams(window.location.href));
  // "verifying" → "ready" | "invalid"
  const [status, setStatus] = useState("verifying");
  const [linkError, setLinkError] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (!isAuthConfigured || started.current) return;
    started.current = true;

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    // Keep tokens out of history / screenshots / referrers.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#/reset-password`
    );

    if (!access_token || !refresh_token) {
      setLinkError(params.get("error_description"));
      setStatus("invalid");
      return;
    }
    setRecoverySession({ access_token, refresh_token })
      .then(() => setStatus("ready"))
      .catch((err) => {
        setLinkError(err.message);
        setStatus("invalid");
      });
  }, [isAuthConfigured, params, setRecoverySession]);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setError(null);
    if (password.length < 8) {
      setError(t("auth.errors.passwordShort"));
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setAlert({ kind: "success", text: t("auth.reset.done") });
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    } catch (err) {
      setAlert({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.reset.title")}
      subtitle={t("auth.reset.subtitle")}
      footer={
        <Link to="/login" className="font-semibold text-navy hover:text-gold">
          {t("auth.reset.backToLogin")}
        </Link>
      }
    >
      {!isAuthConfigured && (
        <FormAlert kind="error">{t("auth.notConfigured")}</FormAlert>
      )}
      {alert && <FormAlert kind={alert.kind}>{alert.text}</FormAlert>}

      {isAuthConfigured && status === "verifying" && (
        <p className="text-sm text-gray-500">{t("auth.reset.verifying")}</p>
      )}

      {isAuthConfigured && status === "invalid" && (
        <>
          <FormAlert kind="error">
            {t("auth.reset.invalidLink")}
            {linkError && <span className="block mt-1 text-xs">{linkError}</span>}
          </FormAlert>
          <Link
            to="/login"
            className="block w-full text-center bg-navy text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t("auth.reset.requestNew")}
          </Link>
        </>
      )}

      {(!isAuthConfigured || status === "ready") && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className={labelClass} htmlFor="reset-password">
              {t("auth.reset.newPassword")}
            </label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              disabled={!isAuthConfigured || busy}
            />
            <FieldError>{error}</FieldError>
          </div>
          <button
            type="submit"
            disabled={!isAuthConfigured || busy}
            className="w-full bg-navy text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t("auth.reset.submitting") : t("auth.reset.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
