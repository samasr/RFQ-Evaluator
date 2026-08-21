import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { generateDecisionMemo, formatMemoAsPlainText } from "../utils/decisionMemo";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

function MetaRow({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 shrink-0">{label}:</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}

export default function DecisionMemoPanel({ rfqHeader, normalizedRows, aiResult }) {
  const { t } = useLanguage();
  const [state, setState] = useState({ status: "idle", data: null, error: null });
  const [memoLang, setMemoLang] = useState("en");
  const [copied, setCopied] = useState(false);

  // The memo button only makes sense once AI scoring has produced a result —
  // there's nothing to summarize into a memo before that.
  if (!aiResult) return null;

  const runGeneration = async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const result = await generateDecisionMemo({
        rfqHeader,
        normalizedRows,
        aiResult,
        proxyUrl: PROXY_URL,
      });
      setState({ status: "success", data: result, error: null });
    } catch (err) {
      setState({ status: "error", data: null, error: err.message });
    }
  };

  const memo = state.data ? (memoLang === "ar" ? state.data.arabic : state.data.english) : null;
  const isRtl = memoLang === "ar";

  const plainTextMemo = () => {
    if (!memo) return "";
    const header = [
      `${t("results.memo.subjectLabel")}: ${memo.subject}`,
      `${t("results.memo.to")}: ${t("results.memo.toValue")}`,
      `${t("results.memo.from")}: ${t("results.memo.fromValue")}`,
      `${t("results.memo.dateLabel")}: ${rfqHeader?.evaluationDate || ""}`,
      "",
      `${t("results.memo.winnerBanner")}: ${state.data.winner} (${state.data.winnerScore}/10)`,
      state.data.keyReason,
      "",
    ].join("\n");
    return (
      header +
      formatMemoAsPlainText(memo, {
        executiveSummaryHeading: t("results.memo.executiveSummaryHeading"),
        methodologyHeading: t("results.memo.methodologyHeading"),
        topSuppliersHeading: t("results.memo.topSuppliersHeading"),
        rationaleHeading: t("results.memo.rationaleHeading"),
        risksHeading: t("results.memo.risksHeading"),
        nextStepsHeading: t("results.memo.nextStepsHeading"),
        scoreLabel: t("results.memo.table.score"),
      })
    );
  };

  const mailtoHref = memo
    ? `mailto:?subject=${encodeURIComponent(
        t("results.memo.emailSubject", { title: rfqHeader?.title || "" })
      )}&body=${encodeURIComponent(plainTextMemo())}`
    : "#";

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainTextMemo());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; nothing more we can do.
    }
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy">{t("results.memo.heading")}</h2>
        <button
          type="button"
          onClick={runGeneration}
          disabled={state.status === "loading" || !PROXY_URL}
          className="no-print bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("results.memo.generateButton")}
        </button>
      </div>

      {!PROXY_URL && (
        <p className="no-print text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {t("results.memo.notConfigured")}
        </p>
      )}

      {state.status === "loading" && (
        <div className="no-print flex items-center gap-3 text-sm text-navy bg-gray-50 border border-gray-200 rounded-md px-4 py-4 mb-4">
          <span
            role="status"
            aria-label={t("results.memo.loading")}
            className="inline-block h-5 w-5 border-2 border-navy border-t-transparent rounded-full animate-spin shrink-0"
          />
          {t("results.memo.loading")}
        </div>
      )}

      {state.status === "error" && (
        <p className="no-print text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {t("results.memo.error", { error: state.error })}
        </p>
      )}

      {state.status === "success" && memo && (
        <>
          <div className="no-print flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMemoLang("en")}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${
                memoLang === "en"
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-navy border-gray-300 hover:border-navy"
              }`}
            >
              {t("results.memo.languageEnglish")}
            </button>
            <button
              type="button"
              onClick={() => setMemoLang("ar")}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${
                memoLang === "ar"
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-navy border-gray-300 hover:border-navy"
              }`}
            >
              {t("results.memo.languageArabic")}
            </button>
          </div>

          <div
            className="memo-print-area bg-white shadow-lg border border-gray-200 rounded-lg p-8 sm:p-10 max-w-3xl mx-auto"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Letterhead */}
            <div className="flex items-center justify-between border-b-2 border-gold pb-4 mb-5">
              <span className="text-xl font-bold text-navy">{t("results.memo.logoName")}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {t("results.memo.heading")}
              </span>
            </div>

            {/* Meta block */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-2">
              <MetaRow label={t("results.memo.to")} value={t("results.memo.toValue")} />
              <MetaRow label={t("results.memo.dateLabel")} value={rfqHeader?.evaluationDate || "—"} />
              <MetaRow label={t("results.memo.from")} value={t("results.memo.fromValue")} />
            </div>
            <p className="text-sm mb-5">
              <span className="text-gray-400">{t("results.memo.subjectLabel")}: </span>
              <span className="font-semibold text-navy">{memo.subject}</span>
            </p>

            {/* Winner banner — the headline an executive actually needs */}
            <div className="bg-navy text-white rounded-lg px-5 py-4 mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70 mb-1">
                  {t("results.memo.winnerBanner")}
                </p>
                <p className="text-lg font-bold">
                  👑 {state.data.winner}
                  <span className="ml-2 text-gold font-semibold text-base">
                    {state.data.winnerScore}/10
                  </span>
                </p>
                <p className="text-sm text-white/90 mt-1">{state.data.keyReason}</p>
              </div>
            </div>

            {/* Executive Summary */}
            <MemoSection heading={t("results.memo.executiveSummaryHeading")}>
              <p className="text-sm leading-relaxed text-gray-800">{memo.executiveSummary}</p>
            </MemoSection>

            {/* Methodology */}
            <MemoSection heading={t("results.memo.methodologyHeading")}>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {memo.methodology.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 text-gray-800">{row.criterion}</td>
                      <td className="py-1.5 text-navy font-semibold text-right rtl:text-left w-16">
                        {row.weight}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MemoSection>

            {/* Top 3 suppliers */}
            <MemoSection heading={t("results.memo.topSuppliersHeading")}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-navy text-xs text-navy">
                      <th className="py-1.5 pr-2 text-left rtl:text-right font-semibold">
                        {t("results.memo.table.rank")}
                      </th>
                      <th className="py-1.5 pr-2 text-left rtl:text-right font-semibold">
                        {t("results.memo.table.supplier")}
                      </th>
                      <th className="py-1.5 pr-2 text-left rtl:text-right font-semibold">
                        {t("results.memo.table.landedCost")}
                      </th>
                      <th className="py-1.5 pr-2 text-left rtl:text-right font-semibold">
                        {t("results.memo.table.score")}
                      </th>
                      <th className="py-1.5 text-left rtl:text-right font-semibold">
                        {t("results.memo.table.strength")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {memo.topSuppliers.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 last:border-0 ${
                          row.rank === 1 ? "bg-gold/10" : ""
                        }`}
                      >
                        <td className="py-1.5 pr-2 text-gray-800">{row.rank}</td>
                        <td className="py-1.5 pr-2 text-gray-800 font-medium">
                          {row.rank === 1 && "👑 "}
                          {row.supplier}
                        </td>
                        <td className="py-1.5 pr-2 text-gray-800 whitespace-nowrap">
                          {row.landedCostSAR}
                        </td>
                        <td className="py-1.5 pr-2 text-gray-800">{row.score}</td>
                        <td className="py-1.5 text-gray-600">{row.keyStrength}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MemoSection>

            {/* Rationale */}
            <MemoSection heading={t("results.memo.rationaleHeading")}>
              <p className="text-sm leading-relaxed text-gray-800">{memo.rationale}</p>
            </MemoSection>

            {/* Risks & mitigation */}
            <MemoSection heading={t("results.memo.risksHeading")}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="py-1 text-left rtl:text-right font-semibold w-1/2">
                      {t("results.memo.table.risk")}
                    </th>
                    <th className="py-1 text-left rtl:text-right font-semibold w-1/2">
                      {t("results.memo.table.mitigation")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memo.risks.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-1.5 pr-3 text-gray-800">{row.risk}</td>
                      <td className="py-1.5 text-gray-800">{row.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </MemoSection>

            {/* Next steps */}
            <MemoSection heading={t("results.memo.nextStepsHeading")} last>
              <ul className="text-sm text-gray-800 space-y-1.5">
                {memo.nextSteps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gold font-bold shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </MemoSection>

            <div className="border-t border-gray-200 mt-6 pt-3 text-xs text-gray-400">
              <p>{t("results.memo.preparedBy")}</p>
              <p>{t("results.memo.classification")}</p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-3 mt-6 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-gold text-navy px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t("results.memo.downloadPdf")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="bg-white text-navy border border-navy px-4 py-2 rounded-md text-sm font-semibold hover:bg-navy/5 transition-colors"
            >
              {copied ? t("results.memo.copied") : t("results.memo.copyClipboard")}
            </button>
            <a
              href={mailtoHref}
              className="bg-white text-navy border border-navy px-4 py-2 rounded-md text-sm font-semibold hover:bg-navy/5 transition-colors inline-block"
            >
              {t("results.memo.emailMemo")}
            </a>
          </div>
        </>
      )}
    </section>
  );
}

function MemoSection({ heading, children, last }) {
  return (
    <div className={`mb-5 ${last ? "" : "pb-5 border-b border-gray-100"}`}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-navy mb-2">{heading}</h3>
      {children}
    </div>
  );
}
