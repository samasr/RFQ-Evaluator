import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthShell, { FormAlert, FieldError } from "../components/AuthShell";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-sm font-medium text-navy mb-1";

// Reached from the password-recovery email link. Supabase puts the app into a
// PASSWORD_RECOVERY session on load, so updateUser({ password }) works here.
export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isAuthConfigured, updatePassword } = useAuth();

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
    </AuthShell>
  );
}
