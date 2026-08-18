import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { CRITERIA_KEYS, scoreSuppliersWithAI } from "../utils/aiScoring";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

function barColor(score) {
  if (score >= 8) return "bg-green-500";
  if (score >= 5) return "bg-yellow-500";
  return "bg-red-500";
}

function isSameSupplier(name, winner) {
  if (!name || !winner) return false;
  return name.trim().toLowerCase() === winner.trim().toLowerCase();
}

function ScoreBar({ label, score }) {
  const value = Number.isFinite(score) ? score : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
        <span>{label}</span>
        <span className="font-medium">{value}/10</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(value)}`}
          style={{ width: `${Math.max(0, Math.min(10, value)) * 10}%` }}
        />
      </div>
    </div>
  );
}

export default function AIScoringPanel({ rfqHeader, normalizedRows, onResult }) {
  const { t } = useLanguage();
  const [state, setState] = useState({ status: "idle", data: null, error: null });

  const runScoring = async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const result = await scoreSuppliersWithAI({ rfqHeader, normalizedRows, proxyUrl: PROXY_URL });
      setState({ status: "success", data: result, error: null });
      onResult?.(result);
    } catch (err) {
      setState({ status: "error", data: null, error: err.message });
      onResult?.(null);
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy">{t("results.ai.heading")}</h2>
        <button
          type="button"
          onClick={runScoring}
          disabled={state.status === "loading" || !PROXY_URL}
          className="bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("results.ai.scoreButton")}
        </button>
      </div>

      {!PROXY_URL && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {t("results.ai.notConfigured")}
        </p>
      )}

      {state.status === "loading" && (
        <div className="flex items-center gap-3 text-sm text-navy bg-gray-50 border border-gray-200 rounded-md px-4 py-4 mb-4">
          <span
            role="status"
            aria-label={t("results.ai.loading")}
            className="inline-block h-5 w-5 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0"
          />
          {t("results.ai.loading")}
        </div>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {t("results.ai.error", { error: state.error })}
        </p>
      )}

      {state.status === "success" && state.data && (
        <>
          <div className="bg-navy text-white rounded-lg px-5 py-4 mb-6">
            <p className="text-xs uppercase tracking-wide text-white/70 mb-1">
              {t("results.ai.summaryLabel")}
            </p>
            <p className="text-sm leading-relaxed">{state.data.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.data.suppliers.map((s, i) => {
              const isWinner = isSameSupplier(s.name, state.data.winner);
              return (
                <div
                  key={`${s.name}-${i}`}
                  className={`border rounded-lg p-4 ${
                    isWinner ? "border-gold bg-gold/5" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="font-semibold text-navy">
                      {isWinner && <span className="mr-1">👑</span>}
                      {s.name}
                    </h3>
                    <span className="text-sm font-bold text-navy whitespace-nowrap">
                      {t("results.ai.weightedTotal")}: {s.weightedTotal}
                    </span>
                  </div>

                  {CRITERIA_KEYS.map((key) => (
                    <ScoreBar
                      key={key}
                      label={t(`results.ai.criteria.${key}`)}
                      score={s.scores?.[key]}
                    />
                  ))}

                  {s.redFlags?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">
                        {t("results.ai.redFlags")}
                      </p>
                      <ul className="text-xs text-red-700 list-disc list-inside space-y-0.5">
                        {s.redFlags.map((flag, flagIndex) => (
                          <li key={flagIndex}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {s.recommendation && (
                    <p className="mt-3 text-xs text-gray-600 italic">{s.recommendation}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
