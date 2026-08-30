import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  rankSuppliers,
  SCORING_CRITERIA,
  DEFAULT_WEIGHTS,
  normalizeWeights,
} from "../utils/scoring";
import { fetchExchangeRates, convertToBase } from "../utils/currency";
import { useLanguage } from "../context/LanguageContext";
import {
  getEvaluation,
  getLatestEvaluation,
  updateEvaluation,
} from "../utils/storage";
import { DEFAULT_ASSUMPTIONS, normalizeSuppliers } from "../utils/normalization";
import { CRITERIA_KEYS } from "../utils/aiScoring";
import NormalizationTable from "../components/NormalizationTable";
import ScoringWeights from "../components/ScoringWeights";
import AIScoringPanel from "../components/AIScoringPanel";
import DecisionMemoPanel from "../components/DecisionMemoPanel";

function scoreBadgeClass(score) {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function aiScoreBadgeClass(score) {
  if (score >= 8) return "bg-green-100 text-green-800";
  if (score >= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

// Generic tooltip badge shared by the local heuristic score and the AI
// score — only the displayed number, color thresholds, and breakdown rows
// differ between the two.
function Badge({ score, badgeClass, title, rows }) {
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
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold cursor-default focus:outline-none focus:ring-2 focus:ring-navy ${badgeClass}`}
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
          <p className="font-semibold mb-2">{title}</p>
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.label} className="flex justify-between gap-2">
                <span className="text-white/80">{row.label}</span>
                <span className="font-medium">{row.value}</span>
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
  const { id } = useParams();
  const evaluation = id ? getEvaluation(id) : getLatestEvaluation();
  const rfqHeader = evaluation?.rfqHeader;
  const suppliers = evaluation?.suppliers ?? [];
  const baseCurrency = rfqHeader?.baseCurrency || "SAR";

  const needsConversion = suppliers.some((s) => s.currency !== baseCurrency);

  const [fx, setFx] = useState({ status: "idle", rates: null, error: null });
  const [assumptions, setAssumptions] = useState(
    () => evaluation?.assumptions ?? DEFAULT_ASSUMPTIONS
  );
  const [weights, setWeights] = useState(
    () => evaluation?.weights ?? DEFAULT_WEIGHTS
  );
  const normWeights = normalizeWeights(weights);
  const normalizedRows = useMemo(
    () => normalizeSuppliers(suppliers, assumptions),
    [suppliers, assumptions]
  );
  const [aiResult, setAiResult] = useState(null);

  const evaluationId = evaluation?.id;
  const storedWeights = evaluation?.weights;
  const storedAssumptions = evaluation?.assumptions;

  // Switching to a different evaluation (id param change) without unmounting:
  // drop the stale AI result and re-seed weights/assumptions from that record.
  useEffect(() => {
    setAiResult(null);
    setWeights(storedWeights ?? DEFAULT_WEIGHTS);
    setAssumptions(storedAssumptions ?? DEFAULT_ASSUMPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  // Persist tuned weights + assumptions onto the stored evaluation so they
  // survive a reload and reopening this evaluation later.
  useEffect(() => {
    if (evaluationId) updateEvaluation(evaluationId, { weights, assumptions });
  }, [evaluationId, weights, assumptions]);

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

  const rankedSuppliers = rankSuppliers(suppliersForScoring, {
    annualVolume: rfqHeader?.annualVolume,
    weights,
  });

  // Once AI scoring has run, the table switches to AI-ranked order; suppliers
  // Claude didn't return (name mismatch) fall back to the end, keyed by the
  // local heuristic score so the table never silently drops a row.
  const aiByName = aiResult
    ? new Map(aiResult.suppliers.map((s) => [(s.name || "").trim().toLowerCase(), s]))
    : null;
  const displaySuppliers = aiByName
    ? [...rankedSuppliers]
        .map((s) => {
          const ai = aiByName.get((s.name || "").trim().toLowerCase());
          return {
            ...s,
            aiScore: ai ? ai.weightedTotal : null,
            aiScores: ai ? ai.scores : null,
            isAiWinner:
              ai && (ai.name || "").trim().toLowerCase() ===
                (aiResult.winner || "").trim().toLowerCase(),
          };
        })
        .sort((a, b) => {
          if (a.aiScore == null && b.aiScore == null) return 0;
          if (a.aiScore == null) return 1;
          if (b.aiScore == null) return -1;
          return b.aiScore - a.aiScore;
        })
    : rankedSuppliers;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-navy">{t("results.heading")}</h1>
        <button
          type="button"
          onClick={async () => {
            const { exportEvaluationWorkbook } = await import(
              "../utils/exportWorkbook"
            );
            exportEvaluationWorkbook({
              rfqHeader,
              suppliers,
              rankedSuppliers,
              normalizedRows,
              assumptions,
              scoreCriteria: SCORING_CRITERIA.map((c) => ({
                key: c.key,
                label: t(`results.ai.criteria.${c.key}`),
                weight: normWeights[c.key],
              })),
              t,
            });
          }}
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
              <th className="py-2 pr-4 text-navy">
                {t("results.table.score")}
                {aiByName && (
                  <span className="ml-1 text-[10px] font-bold text-gold align-top">
                    AI
                  </span>
                )}
              </th>
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
            {displaySuppliers.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-200">
                <td className="py-2 pr-4 font-semibold text-navy">{i + 1}</td>
                <td className="py-2 pr-4">
                  {s.aiScore != null ? (
                    <Badge
                      score={s.aiScore}
                      badgeClass={aiScoreBadgeClass(s.aiScore)}
                      title={t("results.ai.heading")}
                      rows={CRITERIA_KEYS.map((key) => ({
                        label: t(`results.ai.criteria.${key}`),
                        value: s.aiScores?.[key] ?? "—",
                      }))}
                    />
                  ) : (
                    <Badge
                      score={s.score}
                      badgeClass={scoreBadgeClass(s.score)}
                      title={t("results.scoreBreakdown.title")}
                      rows={SCORING_CRITERIA.map((c) => ({
                        label: `${t(`results.ai.criteria.${c.key}`)} (${Math.round(
                          normWeights[c.key] * 100
                        )}%)`,
                        value: Math.round(s.scoreBreakdown[c.key]),
                      }))}
                    />
                  )}
                </td>
                <td className="py-2 pr-4">
                  {s.isAiWinner && <span className="mr-1">👑</span>}
                  {s.name || "—"}
                </td>
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

      <ScoringWeights weights={weights} onWeightsChange={setWeights} />

      <NormalizationTable
        rows={normalizedRows}
        assumptions={assumptions}
        onAssumptionsChange={setAssumptions}
      />

      <AIScoringPanel
        rfqHeader={rfqHeader}
        normalizedRows={normalizedRows}
        weights={weights}
        onResult={setAiResult}
      />

      <DecisionMemoPanel
        rfqHeader={rfqHeader}
        normalizedRows={normalizedRows}
        aiResult={aiResult}
      />
    </div>
  );
}
