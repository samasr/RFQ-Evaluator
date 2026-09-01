import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { PLAN_PRICE_SAR } from "../lib/planLimits";
import {
  BILLING_ENABLED,
  MOYASAR_ENABLED,
  STRIPE_ENABLED,
  MOYASAR_PUBLISHABLE_KEY,
  PLAN_AMOUNT_HALALAS,
  createStripeSession,
} from "../lib/billing";

export default function Checkout() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const plan = params.get("plan") === "team" ? "team" : "pro";

  const moyasarRef = useRef(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [error, setError] = useState(null);

  // Mount the Moyasar hosted card form (mada / Visa / Apple Pay).
  useEffect(() => {
    if (!MOYASAR_ENABLED || !user) return;
    const el = moyasarRef.current;
    const Moyasar = window.Moyasar;
    if (!el || !Moyasar) return;
    el.innerHTML = "";
    Moyasar.init({
      element: ".mysr-form",
      amount: PLAN_AMOUNT_HALALAS[plan],
      currency: "SAR",
      description: `RFQ Ranker ${plan} — monthly`,
      publishable_api_key: MOYASAR_PUBLISHABLE_KEY,
      callback_url: `${window.location.origin}${window.location.pathname}#/checkout/success`,
      methods: ["creditcard", "applepay", "stcpay"],
      supported_networks: ["mada", "visa", "mastercard", "amex"],
      language,
      metadata: { user_id: user.id, plan },
    });
  }, [plan, language, user]);

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
          {MOYASAR_ENABLED && (
            <section>
              <h2 className="text-sm font-semibold text-navy mb-3">
                {t("checkout.payCard")}
              </h2>
              <div ref={moyasarRef} className="mysr-form" />
            </section>
          )}

          {MOYASAR_ENABLED && STRIPE_ENABLED && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              {t("auth.or")}
              <span className="h-px flex-1 bg-gray-200" />
            </div>
          )}

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
