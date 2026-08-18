import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { listEvaluations } from "../utils/storage";
import { fetchExchangeRates, convertToBase } from "../utils/currency";
import { rankSuppliers } from "../utils/scoring";

const COMPLIANT_SASO_STATUSES = new Set(["SASO + ISO", "SASO only", "ISO only"]);

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-navy mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function EvaluationSummary({ evaluation }) {
  const { t } = useLanguage();
  const { rfqHeader, suppliers } = evaluation;
  const baseCurrency = rfqHeader?.baseCurrency || "SAR";
  const needsConversion = suppliers.some((s) => s.currency !== baseCurrency);

  const [fx, setFx] = useState({ status: needsConversion ? "loading" : "idle", rates: null });

  useEffect(() => {
    if (!needsConversion) return;
    let cancelled = false;
    fetchExchangeRates(baseCurrency)
      .then(({ rates }) => {
        if (!cancelled) setFx({ status: "success", rates });
      })
      .catch(() => {
        if (!cancelled) setFx({ status: "error", rates: null });
      });
    return () => {
      cancelled = true;
    };
  }, [baseCurrency, needsConversion]);

  const conversionActive = !needsConversion || fx.status === "success";

  const leadTimes = suppliers
    .map((s) => Number(s.leadTime))
    .filter((v) => Number.isFinite(v));
  const avgLeadTime = average(leadTimes);

  const compliantCount = suppliers.filter((s) =>
    COMPLIANT_SASO_STATUSES.has(s.sasoStatus)
  ).length;
  const complianceRate = suppliers.length
    ? Math.round((compliantCount / suppliers.length) * 100)
    : null;

  let topSupplier = null;
  if (conversionActive) {
    const suppliersForScoring = suppliers.map((s) => {
      const converted =
        needsConversion && fx.status === "success"
          ? convertToBase(s.unitPrice, s.currency, baseCurrency, fx.rates)
          : null;
      return { ...s, unitPrice: converted ?? s.unitPrice };
    });
    const ranked = rankSuppliers(suppliersForScoring, {
      annualVolume: rfqHeader?.annualVolume,
    });
    topSupplier = ranked[0] ?? null;
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy">
          {t("dashboard.summary.heading")}
        </h2>
        <Link
          to={`/results/${evaluation.id}`}
          className="text-sm font-medium text-navy hover:text-gold transition-colors"
        >
          {t("dashboard.summary.viewFullResults")} →
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {rfqHeader?.title || t("dashboard.summary.untitled")}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("dashboard.summary.suppliersEvaluated")}
          value={suppliers.length}
        />
        <StatCard
          label={t("dashboard.summary.topSupplier")}
          value={
            topSupplier
              ? topSupplier.name || "—"
              : fx.status === "error"
              ? "—"
              : "…"
          }
          sub={
            topSupplier
              ? `${t("dashboard.summary.score")}: ${topSupplier.score}`
              : undefined
          }
        />
        <StatCard
          label={t("dashboard.summary.avgLeadTime")}
          value={avgLeadTime !== null ? `${Math.round(avgLeadTime)} ${t("dashboard.summary.days")}` : "—"}
        />
        <StatCard
          label={t("dashboard.summary.complianceRate")}
          value={complianceRate !== null ? `${complianceRate}%` : "—"}
          sub={t("dashboard.summary.complianceSub")}
        />
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const evaluations = listEvaluations();
  const latest = evaluations[0] ?? null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-navy mb-8">
        {t("dashboard.heading")}
      </h1>

      {!latest && (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-6">{t("dashboard.emptyMessage")}</p>
          <Link
            to="/new-evaluation"
            className="inline-block bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t("dashboard.startNewEvaluation")}
          </Link>
        </div>
      )}

      {latest && <EvaluationSummary evaluation={latest} />}

      {evaluations.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-navy mb-4">
            {t("dashboard.history.heading")}
          </h2>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="py-2 px-3 font-medium">
                    {t("dashboard.history.rfqTitle")}
                  </th>
                  <th className="py-2 px-3 font-medium">
                    {t("dashboard.history.product")}
                  </th>
                  <th className="py-2 px-3 font-medium">
                    {t("dashboard.history.suppliers")}
                  </th>
                  <th className="py-2 px-3 font-medium">
                    {t("dashboard.history.baseCurrency")}
                  </th>
                  <th className="py-2 px-3 font-medium">
                    {t("dashboard.history.savedOn")}
                  </th>
                  <th className="py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <tr
                    key={evaluation.id}
                    className="border-b border-gray-200 last:border-0"
                  >
                    <td className="py-2 px-3 font-medium text-navy">
                      {evaluation.rfqHeader?.title || "—"}
                    </td>
                    <td className="py-2 px-3">
                      {evaluation.rfqHeader?.product || "—"}
                    </td>
                    <td className="py-2 px-3">
                      {evaluation.suppliers?.length ?? 0}
                    </td>
                    <td className="py-2 px-3">
                      {evaluation.rfqHeader?.baseCurrency || "—"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {new Date(evaluation.savedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Link
                        to={`/results/${evaluation.id}`}
                        className="font-medium text-navy hover:text-gold transition-colors whitespace-nowrap"
                      >
                        {t("dashboard.history.view")} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
