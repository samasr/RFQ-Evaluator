import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { verifyStripePayment } from "../lib/billing";

export default function CheckoutSuccess() {
  const { t } = useLanguage();
  const { refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: "verifying", plan: null, error: null });
  const ran = useRef(false);

  const sessionId = params.get("session_id"); // Stripe

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const verify = sessionId
      ? verifyStripePayment(sessionId)
      : Promise.reject(new Error(t("checkout.success.noReference")));

    verify
      .then(async ({ plan }) => {
        await refreshProfile();
        setState({ status: "done", plan, error: null });
      })
      .catch((err) => {
        setState({ status: "error", plan: null, error: err.message });
      });
  }, [sessionId, refreshProfile, t]);

  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      {state.status === "verifying" && (
        <div className="flex items-center justify-center gap-3 text-navy">
          <span className="inline-block h-5 w-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
          {t("checkout.success.verifying")}
        </div>
      )}

      {state.status === "done" && (
        <>
          <div className="text-4xl">🎉</div>
          <h1 className="mt-3 text-2xl font-bold text-navy">
            {t("checkout.success.title", {
              plan: t(`plan.names.${state.plan}`),
            })}
          </h1>
          <p className="mt-2 text-gray-600">
            {t("checkout.success.body")}
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-block bg-gold text-navy px-5 py-2.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t("checkout.success.toDashboard")}
          </Link>
        </>
      )}

      {state.status === "error" && (
        <>
          <h1 className="text-xl font-bold text-navy">
            {t("checkout.success.errorTitle")}
          </h1>
          <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {state.error}
          </p>
          <Link
            to="/pricing"
            className="mt-6 inline-block text-sm font-semibold text-navy hover:text-gold"
          >
            {t("checkout.backToPricing")}
          </Link>
        </>
      )}
    </div>
  );
}
