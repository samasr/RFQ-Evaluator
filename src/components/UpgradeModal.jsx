import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { PLAN_PRICE_SAR } from "../lib/planLimits";

const COMPARISON = [
  { key: "evaluations", free: "3 / mo", pro: "∞", team: "∞" },
  { key: "suppliers", free: "5", pro: "10", team: "10" },
  { key: "ai", free: "—", pro: "✓", team: "✓" },
  { key: "memo", free: "—", pro: "✓", team: "✓" },
  { key: "export", free: "—", pro: "✓", team: "✓" },
  { key: "weights", free: "—", pro: "—", team: "✓" },
  { key: "team", free: "—", pro: "—", team: "5" },
];

// `message`, when given, is shown verbatim as the subtitle (e.g. the AI proxy's
// own "… requires the Pro plan" text on a server-side 403). Otherwise `feature`
// drives the translated "… isn't available on your current plan" line.
export default function UpgradeModal({ open, onClose, feature, message }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (!open) return null;

  const goToPricing = () => {
    onClose?.();
    navigate("/pricing");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("plan.upgrade.title")}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-navy">
              {t("plan.upgrade.title")}
            </h2>
            {message ? (
              <p className="mt-1 text-sm text-gray-500">{message}</p>
            ) : feature ? (
              <p className="mt-1 text-sm text-gray-500">
                {t("plan.upgrade.featureLocked", {
                  feature: t(`plan.features.${feature}`),
                })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label={t("plan.upgrade.close")}
          >
            ×
          </button>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-navy">
                  <th className="py-2 pr-3 text-left rtl:text-right font-semibold" />
                  <th className="py-2 px-3 font-semibold">
                    {t("plan.names.free")}
                  </th>
                  <th className="py-2 px-3 font-semibold bg-gold/10 rounded-t">
                    {t("plan.names.pro")}
                    <span className="block text-[11px] font-normal text-gray-500">
                      {t("plan.perMonth", { price: PLAN_PRICE_SAR.pro })}
                    </span>
                  </th>
                  <th className="py-2 px-3 font-semibold">
                    {t("plan.names.team")}
                    <span className="block text-[11px] font-normal text-gray-500">
                      {t("plan.perMonth", { price: PLAN_PRICE_SAR.team })}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-gray-100 text-gray-700"
                  >
                    <td className="py-1.5 pr-3 text-left rtl:text-right">
                      {t(`plan.rows.${row.key}`)}
                    </td>
                    <td className="py-1.5 px-3 text-center">{row.free}</td>
                    <td className="py-1.5 px-3 text-center bg-gold/10 font-medium text-navy">
                      {row.pro}
                    </td>
                    <td className="py-1.5 px-3 text-center">{row.team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goToPricing}
              className="bg-gold text-navy px-5 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t("plan.upgrade.cta")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-semibold text-navy border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              {t("plan.upgrade.notNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
