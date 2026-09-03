import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { PLAN_PRICE_SAR } from "../lib/planLimits";
import {
  BILLING_ENABLED,
  STRIPE_ENABLED,
  createStripeSession,
} from "../lib/billing";

export default function Checkout() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const plan = params.get("plan") === "team" ? "team" : "pro";

  const [stripeBusy, setStripeBusy] = useState(false);
  const [error, setError] = useState(null);

  const payWithStripe = async () => {
    setError(null);
    setStripeBusy(true);
    try {
      const { url } = await createStripeSession(plan);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setStripeBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold text-navy">
        {t("checkout.title", { plan: t(`plan.names.${plan}`) })}
      </h1>
      <p className="mt-1 text-gray-600">
        {t("checkout.priceLine", { price: PLAN_PRICE_SAR[plan] })}
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!BILLING_ENABLED ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          {t("checkout.comingSoon")}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {STRIPE_ENABLED && (
            <section>
              <h2 className="text-sm font-semibold text-navy mb-3">
                {t("checkout.payInternational")}
              </h2>
              <button
                type="button"
                onClick={payWithStripe}
                disabled={stripeBusy}
                className="w-full bg-navy text-white px-4 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stripeBusy
                  ? t("checkout.redirecting")
                  : t("checkout.payWithStripe")}
              </button>
            </section>
          )}
        </div>
      )}

      <Link
        to="/pricing"
        className="mt-8 inline-block text-sm font-semibold text-navy hover:text-gold"
      >
        {t("checkout.backToPricing")}
      </Link>
    </div>
  );
}
