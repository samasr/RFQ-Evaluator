import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthShell, {
  FormAlert,
  FieldError,
  GoogleButton,
} from "../components/AuthShell";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-sm font-medium text-navy mb-1";

export default function Signup() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isAuthConfigured, signUp, signInWithGoogle } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = t("auth.errors.nameRequired");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("auth.errors.emailInvalid");
    if (password.length < 8) next.password = t("auth.errors.passwordShort");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      // With email confirmation on, there's no session yet — tell the user to check their inbox.
      if (res?.session) {
        navigate("/dashboard", { replace: true });
      } else {
        setAlert({ kind: "success", text: t("auth.signup.confirmEmail") });
      }
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

  return (
    <AuthShell
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={
        <>
          {t("auth.signup.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-navy hover:text-gold">
            {t("auth.signup.loginLink")}
          </Link>
        </>
      }
    >
      {!isAuthConfigured && (
        <FormAlert kind="error">{t("auth.notConfigured")}</FormAlert>
      )}
      {alert && <FormAlert kind={alert.kind}>{alert.text}</FormAlert>}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className={labelClass} htmlFor="signup-name">
            {t("auth.fields.fullName")}
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            disabled={!isAuthConfigured || busy}
          />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <label className={labelClass} htmlFor="signup-email">
            {t("auth.fields.email")}
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={!isAuthConfigured || busy}
          />
          <FieldError>{errors.email}</FieldError>
        </div>
        <div>
          <label className={labelClass} htmlFor="signup-password">
            {t("auth.fields.password")}
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={!isAuthConfigured || busy}
          />
          <FieldError>{errors.password}</FieldError>
          {!errors.password && (
            <p className="mt-1 text-xs text-gray-400">
              {t("auth.signup.passwordHint")}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!isAuthConfigured || busy}
          className="w-full bg-navy text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? t("auth.signup.submitting") : t("auth.signup.submit")}
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
