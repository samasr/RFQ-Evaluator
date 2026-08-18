import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { DEFAULT_ASSUMPTIONS } from "../utils/normalization";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-xs font-medium text-navy mb-1";

const ASSUMPTION_FIELDS = [
  { key: "fxUSD", labelKey: "fxUSD", step: 0.01 },
  { key: "fxCNY", labelKey: "fxCNY", step: 0.01 },
  { key: "fxEUR", labelKey: "fxEUR", step: 0.01 },
  { key: "customsPct", labelKey: "customsPct", step: 0.1 },
  { key: "vatPct", labelKey: "vatPct", step: 0.1 },
  { key: "freightJeddah", labelKey: "freightJeddah", step: 0.01 },
  { key: "freightDammam", labelKey: "freightDammam", step: 0.01 },
];

function formatSar(value) {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

export default function NormalizationTable({ rows, assumptions, onAssumptionsChange }) {
  const { t } = useLanguage();
  const [panelOpen, setPanelOpen] = useState(false);

  const validTotals = rows
    .map((r) => r.totalLanded)
    .filter((v) => v !== null);
  const minTotal = validTotals.length ? Math.min(...validTotals) : null;
  const maxTotal = validTotals.length ? Math.max(...validTotals) : null;
  const hasSpread = minTotal !== null && maxTotal !== null && minTotal !== maxTotal;

  const updateAssumption = (key) => (e) => {
    const value = e.target.value;
    onAssumptionsChange({
      ...assumptions,
      [key]: value === "" ? "" : Number(value),
    });
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-navy mb-1">
        {t("results.normalization.heading")}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {t("results.normalization.description")}
      </p>

      <div className="border border-gray-200 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-navy"
        >
          {t("results.normalization.assumptionsTitle")}
          <span className="text-xs font-medium text-navy">
            {panelOpen
              ? t("results.normalization.hideAssumptions")
              : t("results.normalization.showAssumptions")}
          </span>
        </button>

        {panelOpen && (
          <div className="border-t border-gray-200 px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {ASSUMPTION_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className={labelClass}>
                    {t(`results.normalization.${field.labelKey}`)}
                  </label>
                  <input
                    type="number"
                    step={field.step}
                    value={assumptions[field.key]}
                    onChange={updateAssumption(field.key)}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onAssumptionsChange(DEFAULT_ASSUMPTIONS)}
              className="mt-4 text-sm font-medium text-navy hover:text-gold transition-colors"
            >
              {t("results.normalization.resetDefaults")}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-navy text-white">
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.index")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.supplier")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.country")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.originalPrice")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.currency")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.sarEquivalent")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.freight")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.customs")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.vat")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.totalLanded")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.deliveryTerms")}</th>
              <th className="py-2 px-3 font-medium">{t("results.normalization.table.notes")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isLowest = hasSpread && row.totalLanded === minTotal;
              const isHighest = hasSpread && row.totalLanded === maxTotal;
              const rowClass = isLowest
                ? "bg-green-50"
                : isHighest
                ? "bg-red-50"
                : "";

              return (
                <tr
                  key={row.id}
                  className={`border-b border-gray-200 last:border-0 ${rowClass}`}
                >
                  <td className="py-2 px-3 font-semibold text-navy">{index + 1}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-navy">{row.name || "—"}</div>
                    {isLowest && (
                      <span className="inline-block mt-1 text-xs font-semibold text-green-700">
                        {t("results.normalization.bestPrice")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">{t(`options.countries.${row.country}`)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{row.unitPrice || "—"}</td>
                  <td className="py-2 px-3">{row.currency}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatSar(row.sarEquivalent)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatSar(row.freight)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatSar(row.customs)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatSar(row.vat)}</td>
                  <td className="py-2 px-3 font-semibold text-navy whitespace-nowrap">
                    {formatSar(row.totalLanded)}
                  </td>
                  <td className="py-2 px-3">{row.deliveryTerms}</td>
                  <td className="py-2 px-3">{row.notes || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
