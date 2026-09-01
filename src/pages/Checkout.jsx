import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { PLAN_PRICE_SAR } from "../lib/planLimits";

// Phase 7a placeholder. Phase 7b wires Moyasar (mada / Visa / Apple Pay) and
// Stripe here, plus the Cloudflare Worker endpoint that verifies payment and
// promotes the user's plan in Supabase.
export default function Checkout() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const planId = params.get("plan") === "team" ? "team" : "pro";

  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-navy">
        {t("checkout.title", { plan: t(`plan.names.${planId}`) })}
      </h1>
      <p className="mt-2 text-gray-600">
        {t("checkout.priceLine", {
          price: PLAN_PRICE_SAR[planId],
        })}
      </p>
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        {t("checkout.comingSoon")}
      </div>
      <Link
        to="/pricing"
        className="mt-6 inline-block text-sm font-semibold text-navy hover:text-gold"
      >
        {t("checkout.backToPricing")}
      </Link>
    </div>
  );
}
