import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { generateDecisionMemo } from "../utils/decisionMemo";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

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

  const memoText = state.data ? (memoLang === "ar" ? state.data.arabic : state.data.english) : "";

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; nothing more we can do.
    }
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(
    t("results.memo.emailSubject", { title: rfqHeader?.title || "" })
  )}&body=${encodeURIComponent(memoText)}`;

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

      {state.status === "success" && state.data && (
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
            dir={memoLang === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between border-b-2 border-gold pb-4 mb-6">
              <span className="text-xl font-bold text-navy">{t("results.memo.logoName")}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {t("results.memo.heading")}
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-800">
              {memoText}
            </pre>
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
