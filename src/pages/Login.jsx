import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthShell, { FormAlert, GoogleButton } from "../components/AuthShell";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-sm font-medium text-navy mb-1";

export default function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthConfigured, signInWithPassword, signInWithGoogle, sendPasswordReset } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null); // { kind, text }

  const dest = location.state?.from || "/dashboard";

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setBusy(true);
    try {
      await signInWithPassword({ email: email.trim(), password });
      navigate(dest, { replace: true });
    } catch (err) {
      setAlert({ kind: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setAlert(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAlert({ kind: "error", text: err.message });
    }
  };

  const forgot = async () => {
    setAlert(null);
    if (!email.trim()) {
      setAlert({ kind: "error", text: t("auth.enterEmailFirst") });
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setAlert({ kind: "success", text: t("auth.resetSent") });
    } catch (err) {
      setAlert({ kind: "error", text: err.message });
    }
  };

  return (
    <AuthShell
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link to="/signup" className="font-semibold text-navy hover:text-gold">
            {t("auth.login.signupLink")}
          </Link>
        </>
      }
    >
      {!isAuthConfigured && (
        <FormAlert kind="error">{t("auth.notConfigured")}</FormAlert>
      )}
      {alert && <FormAlert kind={alert.kind}>{alert.text}</FormAlert>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="login-email">
            {t("auth.fields.email")}
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={!isAuthConfigured || busy}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor="login-password">
              {t("auth.fields.password")}
            </label>
            <button
              type="button"
              onClick={forgot}
              className="text-xs font-medium text-navy hover:text-gold mb-1"
              disabled={!isAuthConfigured}
            >
              {t("auth.login.forgot")}
            </button>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={!isAuthConfigured || busy}
          />
        </div>
        <button
          type="submit"
          disabled={!isAuthConfigured || busy}
          className="w-full bg-navy text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <GoogleButton
        onClick={google}
        label={t("auth.google")}
        disabled={!isAuthConfigured}
      />
    </AuthShell>
  );
}
