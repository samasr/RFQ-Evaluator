import { useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { extractSupplierFromFile, isSupportedQuoteFile } from "../utils/extraction";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

export default function QuoteUpload({ rfqHeader, maxFiles, onSuppliersExtracted }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]); // { id, file, status, error }
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [summary, setSummary] = useState(null); // { succeeded, failed }
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList).filter(isSupportedQuoteFile);
    setSummary(null);
    setFiles((prev) => {
      const room = Math.max(0, maxFiles - prev.length);
      return [
        ...prev,
        ...incoming.slice(0, room).map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: "pending",
          error: null,
        })),
      ];
    });
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const runExtraction = async () => {
    setProcessing(true);
    setSummary(null);
    let succeeded = 0;
    let failed = 0;
    const extracted = [];

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      setProgress({ done: i, total: files.length });
      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: "extracting" } : f))
      );
      try {
        const supplier = await extractSupplierFromFile({
          file: entry.file,
          rfqHeader,
          proxyUrl: PROXY_URL,
        });
        extracted.push(supplier);
        succeeded += 1;
        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, status: "done" } : f))
        );
      } catch (err) {
        failed += 1;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, status: "error", error: err.message } : f
          )
        );
      }
    }

    setProgress(null);
    setProcessing(false);
    setSummary({ succeeded, failed });
    if (extracted.length > 0) {
      onSuppliersExtracted(extracted);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-navy mb-1">
        {t("newEvaluation.upload.heading")}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {t("newEvaluation.upload.description")}
      </p>

      {!PROXY_URL && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
          {t("newEvaluation.upload.notConfigured")}
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive ? "border-navy bg-navy/5" : "border-gray-300 hover:border-navy"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-gray-600">{t("newEvaluation.upload.dropzone")}</p>
        <p className="text-xs text-gray-400 mt-1">
          {t("newEvaluation.upload.fileTypes", { max: maxFiles })}
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{f.file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {(f.file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {f.status === "pending" && (
                  <>
                    <span className="text-xs text-gray-400">
                      {t("newEvaluation.upload.statusPending")}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="text-gray-400 hover:text-red-600 leading-none text-base"
                      aria-label={t("newEvaluation.upload.remove")}
                    >
                      ×
                    </button>
                  </>
                )}
                {f.status === "extracting" && (
                  <span
                    role="status"
                    className="inline-block h-3.5 w-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin"
                  />
                )}
                {f.status === "done" && (
                  <span className="text-green-600 font-semibold">✓</span>
                )}
                {f.status === "error" && (
                  <span className="text-red-600 text-xs" title={f.error}>
                    ✕ {f.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={runExtraction}
          disabled={processing || files.length === 0 || !PROXY_URL}
          className="bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing
            ? t("newEvaluation.upload.extracting")
            : t("newEvaluation.upload.extractButton")}
        </button>
        {progress && (
          <span className="text-xs text-gray-500">
            {t("newEvaluation.upload.progress", {
              done: progress.done + 1,
              total: progress.total,
            })}
          </span>
        )}
      </div>

      {summary && (
        <p
          className={`mt-3 text-sm rounded-md px-3 py-2 border ${
            summary.failed > 0
              ? "text-amber-700 bg-amber-50 border-amber-200"
              : "text-green-700 bg-green-50 border-green-200"
          }`}
        >
          {t("newEvaluation.upload.summary", {
            succeeded: summary.succeeded,
            total: summary.succeeded + summary.failed,
          })}
        </p>
      )}
    </section>
  );
}
