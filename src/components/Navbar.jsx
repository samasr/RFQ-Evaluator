import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import PlanBadge from "./PlanBadge";

export default function Navbar() {
  const { language, toggleLanguage, t } = useLanguage();
  const { isAuthConfigured, user, plan, displayName, signOut } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="bg-navy text-white shadow-md">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-y-2 px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-wide">
          RFQ Evaluator
        </Link>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/" className="hover:text-gold transition-colors">
            {t("nav.home")}
          </Link>
          <Link to="/dashboard" className="hover:text-gold transition-colors">
            {t("nav.dashboard")}
          </Link>
          <Link to="/portfolio" className="hover:text-gold transition-colors">
            {t("nav.portfolio")}
          </Link>
          <Link
            to="/new-evaluation"
            className="hover:text-gold transition-colors"
          >
            {t("nav.newEvaluation")}
          </Link>
          <Link to="/pricing" className="hover:text-gold transition-colors">
            {t("nav.pricing")}
          </Link>

          {isAuthConfigured && user ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-white/90">{displayName}</span>
              <PlanBadge plan={plan} />
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium hover:text-gold transition-colors"
              >
                {t("nav.logout")}
              </button>
            </span>
          ) : isAuthConfigured ? (
            <span className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-medium hover:text-gold transition-colors"
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/signup"
                className="bg-gold text-navy px-3 py-1 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t("nav.signup")}
              </Link>
            </span>
          ) : null}

          <button
            type="button"
            onClick={toggleLanguage}
            className="border border-gold text-gold px-3 py-1 rounded-md text-sm font-medium hover:bg-gold hover:text-navy transition-colors"
          >
            {language === "en" ? "EN | AR" : "AR | EN"}
          </button>
        </div>
      </div>
    </nav>
  );
}
