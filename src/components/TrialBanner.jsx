import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

// Shown below the navbar while a user's trial is running or just ran out.
// Silent for logged-out visitors, paid Pro/Team accounts, and free accounts
// that never had a trial.
export default function TrialBanner() {
  const { t } = useLanguage();
  const { isAuthConfigured, user, trialActive, trialExpired, trialDaysLeft } =
    useAuth();

  if (!isAuthConfigured || !user) return null;
  if (!trialActive && !trialExpired) return null;

  return (
    <div className="bg-gold text-navy px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
        <span>
          {trialActive
            ? t("trial.banner.active", { days: trialDaysLeft })
            : t("trial.banner.expired")}
        </span>
        <Link to="/pricing" className="font-semibold underline underline-offset-2 hover:opacity-80">
          {t("trial.banner.cta")}
        </Link>
      </div>
    </div>
  );
}
