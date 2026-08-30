import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { SCORING_CRITERIA, DEFAULT_WEIGHTS } from "../utils/scoring";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-xs font-medium text-navy mb-1";

// Collapsible panel (styled like NormalizationTable's assumptions panel) for
// tuning the criterion weights that drive both the local heuristic score and
// the AI scoring rubric. Weights are relative — the scorer normalizes them —
// so they don't have to sum to 100, but a 100 total keeps them readable.
export default function ScoringWeights({ weights, onWeightsChange }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const total = SCORING_CRITERIA.reduce((sum, c) => {
    const n = Number(weights?.[c.key]);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const balanced = Math.round(total) === 100;

  const update = (key) => (e) => {
    const value = e.target.value;
    onWeightsChange({ ...weights, [key]: value === "" ? "" : Number(value) });
  };

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-navy mb-1">
        {t("results.weights.heading")}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {t("results.weights.description")}
      </p>

      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-navy"
        >
          <span>
            {t("results.weights.panelTitle")}
            <span
              className={`ml-2 text-xs font-medium ${
                balanced ? "text-green-700" : "text-amber-700"
              }`}
            >
              {t("results.weights.total", { total: Math.round(total) })}
            </span>
          </span>
          <span className="text-xs font-medium text-navy">
            {open ? t("results.weights.hide") : t("results.weights.show")}
          </span>
        </button>

        {open && (
          <div className="border-t border-gray-200 px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {SCORING_CRITERIA.map((c) => (
                <div key={c.key}>
                  <label className={labelClass} htmlFor={`weight-${c.key}`}>
                    {t(`results.ai.criteria.${c.key}`)}
                  </label>
                  <div className="relative">
                    <input
                      id={`weight-${c.key}`}
                      type="number"
                      min="0"
                      step="1"
                      value={weights?.[c.key] ?? ""}
                      onChange={update(c.key)}
                      className={inputClass}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!balanced && (
              <p className="mt-3 text-xs text-amber-700">
                {t("results.weights.rebalanceHint")}
              </p>
            )}
            <button
              type="button"
              onClick={() => onWeightsChange({ ...DEFAULT_WEIGHTS })}
              className="mt-4 text-sm font-medium text-navy hover:text-gold transition-colors"
            >
              {t("results.weights.resetDefaults")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
