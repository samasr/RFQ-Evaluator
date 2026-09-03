import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  generateClarificationQuestions,
  formatSupplierQuestionsAsText,
} from "../utils/clarificationQuestions";
import { PlanRequiredError } from "../lib/aiProxy";
import UpgradeModal from "./UpgradeModal";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

function SupplierCard({ supplier, rfqTitle, t }) {
  const [copied, setCopied] = useState(false);

  const intro = t("results.clarify.emailIntro");
  const bodyText = formatSupplierQuestionsAsText(supplier, intro);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; nothing more to do.
    }
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(
    t("results.clarify.emailSubject", { title: rfqTitle || "" })
  )}&body=${encodeURIComponent(bodyText)}`;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-navy">
          {supplier.name || "—"}
          <span className="ml-2 text-xs font-medium text-gray-400">
            {t("results.clarify.questionCount", {
              count: supplier.questions.length,
            })}
          </span>
        </h3>
        {supplier.questions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-medium text-navy hover:text-gold transition-colors"
            >
              {copied
                ? t("results.clarify.copied")
                : t("results.clarify.copyQuestions")}
            </button>
            <a
              href={mailtoHref}
              className="text-xs font-medium text-navy hover:text-gold transition-colors"
            >
              {t("results.clarify.emailSupplier")}
            </a>
          </div>
        )}
      </div>

      {supplier.questions.length === 0 ? (
        <p className="text-sm text-green-700">
          {t("results.clarify.noQuestions")}
        </p>
      ) : (
        <ol className="space-y-3">
          {supplier.questions.map((q, i) => (
            <li key={i} className="text-sm">
              <div className="flex gap-2">
                <span className="font-bold text-gold shrink-0">{i + 1}.</span>
                <div>
                  {q.topic && (
                    <span className="inline-block mb-1 rounded bg-navy/5 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy">
                      {q.topic}
                    </span>
                  )}
                  <p className="text-gray-800">{q.question}</p>
                  {q.rationale && (
                    <p className="mt-0.5 text-xs text-gray-500 italic">
                      {t("results.clarify.rationaleLabel")}: {q.rationale}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function ClarificationPanel({ rfqHeader, normalizedRows, aiResult }) {
  const { t } = useLanguage();
  const [state, setState] = useState({ status: "idle", data: null, error: null });
  const [planError, setPlanError] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const run = async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const suppliers = await generateClarificationQuestions({
        rfqHeader,
        normalizedRows,
        aiResult,
        proxyUrl: PROXY_URL,
      });
      setState({ status: "success", data: suppliers, error: null });
    } catch (err) {
      if (err instanceof PlanRequiredError) {
        setState({ status: "idle", data: null, error: null });
        setPlanError(err.message);
        return;
      }
      setState({ status: "error", data: null, error: err.message });
    }
  };

  const copyAll = async () => {
    if (!state.data) return;
    const blocks = state.data
      .filter((s) => s.questions.length > 0)
      .map((s) => {
        const header = `— ${s.name} —`;
        return `${header}\n${formatSupplierQuestionsAsText(s)}`;
      });
    try {
      await navigator.clipboard.writeText(blocks.join("\n\n"));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Clipboard access can be denied; nothing more to do.
    }
  };

  const totalQuestions =
    state.data?.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-1 gap-3">
        <h2 className="text-lg font-semibold text-navy">
          {t("results.clarify.heading")}
        </h2>
        <button
          type="button"
          onClick={run}
          disabled={
            state.status === "loading" ||
            !PROXY_URL ||
            normalizedRows.length === 0
          }
          className="bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {state.status === "success"
            ? t("results.clarify.regenerateButton")
            : t("results.clarify.generateButton")}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {t("results.clarify.description")}
      </p>

      {!PROXY_URL && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {t("results.clarify.notConfigured")}
        </p>
      )}

      <UpgradeModal
        open={planError !== null}
        onClose={() => setPlanError(null)}
        message={planError}
      />

      {state.status === "loading" && (
        <div className="flex items-center gap-3 text-sm text-navy bg-gray-50 border border-gray-200 rounded-md px-4 py-4 mb-4">
          <span
            role="status"
            aria-label={t("results.clarify.loading")}
            className="inline-block h-5 w-5 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0"
          />
          {t("results.clarify.loading")}
        </div>
      )}

      {state.status === "error" && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {t("results.clarify.error", { error: state.error })}
        </p>
      )}

      {state.status === "success" && state.data && (
        <>
          {totalQuestions > 0 && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={copyAll}
                className="bg-white text-navy border border-navy px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-navy/5 transition-colors"
              >
                {copiedAll
                  ? t("results.clarify.copied")
                  : t("results.clarify.copyAll")}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.data.map((s, i) => (
              <SupplierCard
                key={`${s.name}-${i}`}
                supplier={s}
                rfqTitle={rfqHeader?.title}
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
