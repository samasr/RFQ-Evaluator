import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { PLAN_PRICE_SAR } from "../lib/planLimits";

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-gold"
    >
      <path
        d="M5 10.5l3.5 3.5L15 6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanCard({ planId, popular, featureKeys, ctaLabel, onCta, trialBadge, showNoCard }) {
  const { t } = useLanguage();
  const price = PLAN_PRICE_SAR[planId];
  return (
    <div
      className={`relative flex flex-col rounded-xl bg-white p-6 sm:p-8 ${
        popular
          ? "border-2 border-gold shadow-xl"
          : "border border-gray-200 shadow-sm"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-navy">
          {t("pricing.mostPopular")}
        </span>
      )}
      {trialBadge && (
        <span className="absolute -top-3 right-4 rounded-full border-2 border-gold bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
          {t("pricing.trialBadge")}
        </span>
      )}
      <h3 className="text-lg font-bold text-navy">{t(`plan.names.${planId}`)}</h3>
      <p className="mt-2">
        <span className="text-3xl font-bold text-navy">
          {t("pricing.priceSar", { price })}
        </span>
        <span className="text-sm text-gray-500"> / {t("pricing.month")}</span>
      </p>
      <ul className="mt-6 space-y-2 text-sm text-gray-700 flex-1">
        {featureKeys.map((k) => (
          <li key={k} className="flex gap-2">
            <CheckIcon />
            <span>{t(`pricing.features.${k}`)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCta}
        className={`mt-8 w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
          popular
            ? "bg-gold text-navy"
            : "bg-navy text-white"
        }`}
      >
        {ctaLabel}
      </button>
      {showNoCard && (
        <p className="mt-2 text-center text-xs text-gray-400">
          {t("pricing.noCardRequired")}
        </p>
      )}
    </div>
  );
}

export default function Pricing() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, isAuthConfigured, rawPlan } = useAuth();
  const loggedIn = Boolean(isAuthConfigured && user);

  // Logged out → send to signup (which auto-starts the 7-day Pro trial).
  // Logged in → go to checkout for the chosen plan.
  const startPlan = (planId) => {
    if (loggedIn) navigate(`/checkout?plan=${planId}`);
    else navigate("/signup");
  };

  // The free trial is only ever granted at signup, so "Start 7-Day Free
  // Trial" only makes sense for logged-out visitors; a signed-in user's
  // trial has already started, is running, or is over.
  const ctaFor = (planId) => {
    if (rawPlan === planId) return t("pricing.currentPlan");
    if (!loggedIn) return t("pricing.cta.trial");
    return t(`pricing.cta.${planId}`);
  };

  return (
    <div>
      <section className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold">
            {t("pricing.header.title")}
          </h1>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">
            {t("pricing.header.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-16 grid gap-6 md:grid-cols-3 items-start">
          <PlanCard
            planId="free"
            featureKeys={[
              "free_evaluations",
              "free_suppliers",
              "free_normalization",
            ]}
            ctaLabel={
              rawPlan === "free"
                ? t("pricing.currentPlan")
                : t("pricing.cta.free")
            }
            onCta={() => navigate("/signup")}
          />
          <PlanCard
            planId="pro"
            popular
            trialBadge
            showNoCard={!loggedIn && rawPlan !== "pro"}
            featureKeys={[
              "pro_evaluations",
              "pro_suppliers",
              "pro_ai",
              "pro_bilingual",
              "pro_export",
            ]}
            ctaLabel={ctaFor("pro")}
            onCta={() => startPlan("pro")}
          />
          <PlanCard
            planId="team"
            trialBadge
            showNoCard={!loggedIn && rawPlan !== "team"}
            featureKeys={[
              "team_everything",
              "team_members",
              "team_shared",
              "team_criteria",
            ]}
            ctaLabel={ctaFor("team")}
            onCta={() => startPlan("team")}
          />
        </div>
        <p className="pb-16 text-center text-xs text-gray-400">
          {t("pricing.vatNote")}{" "}
          <Link to="/" className="underline hover:text-navy">
            {t("pricing.backHome")}
          </Link>
        </p>
      </section>
    </div>
  );
}
