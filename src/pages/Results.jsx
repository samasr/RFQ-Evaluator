import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { rankSuppliers, SCORE_CRITERIA } from "../utils/scoring";
import { fetchExchangeRates, convertToBase } from "../utils/currency";
import { useLanguage } from "../context/LanguageContext";

function loadEvaluation() {
  try {
    const raw = localStorage.getItem("rfqEvaluation");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function exportToCsv(rfqHeader, rankedSuppliers, baseCurrency, conversionActive) {
  const headers = [
    "Rank",
    "Score",
    "Supplier",
    "Country",
    "Unit Price",
    "Currency",
    ...(conversionActive ? [`Price (${baseCurrency})`] : []),
    "Lead Time (days)",
    "Payment Terms",
    "MOQ",
    "SASO Status",
    "Delivery Terms",
    "Notes",
  ];
  const csvRows = rankedSuppliers.map((s, i) =>
    [
      i + 1,
      s.score,
      s.name,
      s.country,
      s.unitPriceOriginal,
      s.currencyOriginal,
      ...(conversionActive
        ? [s.unitPrice != null ? Math.round(s.unitPrice * 100) / 100 : ""]
        : []),
      s.leadTime,
      s.paymentTerms,
      s.moq,
      s.sasoStatus,
      s.deliveryTerms,
      s.notes,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csvContent = [headers.join(","), ...csvRows].join("\r\n");

  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileTitle = rfqHeader?.title?.trim() || "rfq-evaluation";
  link.download = `${fileTitle.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function scoreBadgeClass(score) {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function ScoreBadge({ score, breakdown }) {
  const { t } = useLanguage();
  const badgeRef = useRef(null);
  // Positioned via getBoundingClientRect + position:fixed so the tooltip
  // escapes the table's overflow-x-auto wrapper instead of being clipped by it.
  const [tooltipPos, setTooltipPos] = useState(null);

  const showTooltip = () => {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  };
  const hideTooltip = () => setTooltipPos(null);

  return (
    <>
      <span
        ref={badgeRef}
        tabIndex={0}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold cursor-default focus:outline-none focus:ring-2 focus:ring-navy ${scoreBadgeClass(
          score
        )}`}
      >
        {score}
      </span>

      {tooltipPos && (
        <div
          style={{
            position: "fixed",
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: "translateX(-50%)",
          }}
          className="z-50 w-60 rounded-md bg-navy text-white text-xs shadow-lg p-3 pointer-events-none"
        >
          <p className="font-semibold mb-2">
            {t("results.scoreBreakdown.title")}
          </p>
          <ul className="space-y-1">
            {SCORE_CRITERIA.map((c) => (
              <li key={c.key} className="flex justify-between gap-2">
                <span className="text-white/80">
                  {t(`results.scoreBreakdown.${c.key}`)} (
                  {Math.round(c.weight * 100)}%)
                </span>
                <span className="font-medium">
                  {Math.round(breakdown[c.key])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function Results() {
  const { t } = useLanguage();
  const evaluation = loadEvaluation();
  const rfqHeader = evaluation?.rfqHeader;
  const suppliers = evaluation?.suppliers ?? [];
  const baseCurrency = rfqHeader?.baseCurrency || "SAR";

  const needsConversion = suppliers.some((s) => s.currency !== baseCurrency);

  const [fx, setFx] = useState({ status: "idle", rates: null, error: null });

  useEffect(() => {
    if (!needsConversion) {
      setFx({ status: "idle", rates: null, error: null });
      return;
    }
    let cancelled = false;
    setFx({ status: "loading", rates: null, error: null });
    fetchExchangeRates(baseCurrency)
      .then(({ rates }) => {
        if (!cancelled) setFx({ status: "success", rates, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setFx({ status: "error", rates: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [baseCurrency, needsConversion]);

  if (!evaluation || suppliers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-navy mb-4">
          {t("results.heading")}
        </h1>
        <p className="text-gray-600 mb-6">{t("results.emptyMessage")}</p>
        <Link
          to="/new-evaluation"
          className="inline-block bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t("results.startNewEvaluation")}
        </Link>
      </div>
    );
  }

  const conversionActive = needsConversion && fx.status === "success";

  const suppliersForScoring = suppliers.map((s) => {
    const converted = conversionActive
      ? convertToBase(s.unitPrice, s.currency, baseCurrency, fx.rates)
      : null;
    return {
      ...s,
      unitPriceOriginal: s.unitPrice,
      currencyOriginal: s.currency,
      unitPrice: converted ?? s.unitPrice,
    };
  });

  const rankedSuppliers = rankSuppliers(suppliersForScoring);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-navy">{t("results.heading")}</h1>
        <button
          type="button"
          onClick={() =>
            exportToCsv(rfqHeader, rankedSuppliers, baseCurrency, conversionActive)
          }
          className="bg-gold text-navy px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t("results.exportToExcel")}
        </button>
      </div>

      {rfqHeader && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">{t("results.rfqTitle")}</p>
            <p className="font-medium text-navy">{rfqHeader.title || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("results.product")}</p>
            <p className="font-medium text-navy">{rfqHeader.product || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("results.annualVolume")}</p>
            <p className="font-medium text-navy">{rfqHeader.annualVolume || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("results.baseCurrency")}</p>
            <p className="font-medium text-navy">{rfqHeader.baseCurrency}</p>
          </div>
          <div>
            <p className="text-gray-500">{t("results.evaluationDate")}</p>
            <p className="font-medium text-navy">{rfqHeader.evaluationDate}</p>
          </div>
        </div>
      )}

      {needsConversion && fx.status === "loading" && (
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-6">
          {t("results.fxLoading", { currency: baseCurrency })}
        </p>
      )}
      {needsConversion && fx.status === "error" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
          {t("results.fxError", { error: fx.error })}
        </p>
      )}
      {conversionActive && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-6">
          {t("results.fxSuccess", { currency: baseCurrency })}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-navy">
              <th className="py-2 pr-4 text-navy">{t("results.table.rank")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.score")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.supplier")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.country")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.unitPrice")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.leadTime")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.paymentTerms")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.moq")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.sasoStatus")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.deliveryTerms")}</th>
              <th className="py-2 pr-4 text-navy">{t("results.table.notes")}</th>
            </tr>
          </thead>
          <tbody>
            {rankedSuppliers.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-200">
                <td className="py-2 pr-4 font-semibold text-navy">{i + 1}</td>
                <td className="py-2 pr-4">
                  <ScoreBadge score={s.score} breakdown={s.scoreBreakdown} />
                </td>
                <td className="py-2 pr-4">{s.name || "—"}</td>
                <td className="py-2 pr-4">
                  {t(`options.countries.${s.country}`)}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {s.unitPriceOriginal || "—"}{" "}
                  <span className="text-gray-400">{s.currencyOriginal}</span>
                  {conversionActive &&
                    s.currencyOriginal !== baseCurrency &&
                    s.unitPrice != null && (
                      <span className="text-gray-400">
                        {" "}
                        ({s.unitPrice.toFixed(2)} {baseCurrency})
                      </span>
                    )}
                </td>
                <td className="py-2 pr-4">{s.leadTime || "—"}</td>
                <td className="py-2 pr-4">
                  {t(`options.paymentTerms.${s.paymentTerms}`)}
                </td>
                <td className="py-2 pr-4">{s.moq || "—"}</td>
                <td className="py-2 pr-4">
                  {t(`options.sasoStatuses.${s.sasoStatus}`)}
                </td>
                <td className="py-2 pr-4">{s.deliveryTerms}</td>
                <td className="py-2 pr-4">{s.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
