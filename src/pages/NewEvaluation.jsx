import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SupplierRow, { CURRENCIES } from "../components/SupplierRow";
import QuoteUpload from "../components/QuoteUpload";
import UpgradeModal from "../components/UpgradeModal";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { fetchExchangeRates } from "../utils/currency";
import {
  saveEvaluation,
  countEvaluationsThisMonth,
} from "../lib/evaluationStore";
import { planFeatures } from "../lib/planLimits";
import { SAMPLE_RFQ_HEADER, getSampleSuppliers } from "../utils/sampleData";

// Hard ceiling on the array regardless of plan (prevents a runaway table);
// the per-plan cap is applied on top of this.
export const MAX_SUPPLIERS = 10;

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const emptySupplier = () => ({
  id: crypto.randomUUID(),
  name: "",
  country: "Saudi Arabia",
  currency: "SAR",
  unitPrice: "",
  leadTime: "",
  paymentTerms: "100% upfront",
  moq: "",
  sasoStatus: "Not stated",
  deliveryTerms: "DDP",
  portCity: "",
  notes: "",
});

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const labelClass = "block text-sm font-medium text-navy mb-1";

export default function NewEvaluation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user, plan } = useAuth();

  const limits = planFeatures(plan);
  const supplierCap = Math.min(MAX_SUPPLIERS, limits.maxSuppliers);
  const monthlyLimit = limits.monthlyEvaluations;

  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [upgradeFeature, setUpgradeFeature] = useState(null); // null | "suppliers" | "evaluations"

  useEffect(() => {
    let cancelled = false;
    countEvaluationsThisMonth(user)
      .then((n) => {
        if (!cancelled) setMonthlyUsed(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [rfqHeader, setRfqHeader] = useState({
    title: "",
    product: "",
    annualVolume: "",
    baseCurrency: "SAR",
    evaluationDate: todayIsoDate(),
  });

  const [suppliers, setSuppliers] = useState(() => {
    const incoming = location.state?.extractedSuppliers;
    return Array.isArray(incoming) && incoming.length > 0
      ? incoming.slice(0, MAX_SUPPLIERS)
      : [emptySupplier()];
  });

  // Per-row record of which fields Claude auto-filled from an uploaded quote,
  // keyed by supplier id — drives the light-gold highlight on those cells.
  const [autoFilledByRow, setAutoFilledByRow] = useState({});

  // Clear the handoff state once consumed so navigating back here later
  // (browser back/forward, or a plain link) doesn't re-seed the table.
  useEffect(() => {
    if (location.state?.extractedSuppliers) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fx, setFx] = useState({ status: "idle", rates: null });

  useEffect(() => {
    let cancelled = false;
    setFx({ status: "loading", rates: null });
    fetchExchangeRates(rfqHeader.baseCurrency)
      .then(({ rates }) => {
        if (!cancelled) setFx({ status: "success", rates });
      })
      .catch(() => {
        if (!cancelled) setFx({ status: "error", rates: null });
      });
    return () => {
      cancelled = true;
    };
  }, [rfqHeader.baseCurrency]);

  const updateHeaderField = (field) => (e) =>
    setRfqHeader((prev) => ({ ...prev, [field]: e.target.value }));

  const updateSupplierField = (id, field, value) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
    // A manual edit means the user has reviewed that cell — drop its highlight.
    setAutoFilledByRow((prev) => {
      const current = prev[id];
      if (!current || !current.includes(field)) return prev;
      return { ...prev, [id]: current.filter((f) => f !== field) };
    });
  };

  const addSupplier = () => {
    if (suppliers.length >= supplierCap) {
      if (supplierCap < MAX_SUPPLIERS) setUpgradeFeature("suppliers");
      return;
    }
    setSuppliers((prev) => [...prev, emptySupplier()]);
  };

  const removeSupplier = (id) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    setAutoFilledByRow((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Single-row upload: replace that row's fields with the extraction (keeping
  // its id and table position) and record which cells were auto-filled.
  const handleApplyExtraction = (id, extracted, filledFields) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...extracted, id } : s))
    );
    setAutoFilledByRow((prev) => ({ ...prev, [id]: filledFields }));
  };

  // Bulk upload: each result is { supplier, filledFields }. Extracted rows
  // replace any still-blank rows first, then append, capped at MAX_SUPPLIERS
  // so an upload batch can't overflow the table.
  const handleSuppliersExtracted = (results) => {
    setSuppliers((prev) => {
      const nonEmpty = prev.filter(
        (s) => s.name.trim() !== "" || s.unitPrice !== ""
      );
      return [...nonEmpty, ...results.map((r) => r.supplier)].slice(
        0,
        supplierCap
      );
    });
    setAutoFilledByRow((prev) => {
      const next = { ...prev };
      for (const r of results) next[r.supplier.id] = r.filledFields;
      return next;
    });
  };

  const handleSaveAndContinue = async () => {
    setSaveError(null);
    if (suppliers.length > supplierCap) {
      setUpgradeFeature("suppliers");
      return;
    }
    if (monthlyLimit !== Infinity && monthlyUsed >= monthlyLimit) {
      setUpgradeFeature("evaluations");
      return;
    }
    setSaving(true);
    try {
      const id = await saveEvaluation(user, rfqHeader, suppliers);
      navigate(`/results/${id}`);
    } catch (err) {
      setSaveError(err.message || t("newEvaluation.saveError"));
      setSaving(false);
    }
  };

  const loadSampleData = () => {
    setRfqHeader({ ...SAMPLE_RFQ_HEADER });
    setSuppliers(getSampleSuppliers());
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-navy">
          {t("newEvaluation.heading")}
        </h1>
        <button
          type="button"
          onClick={loadSampleData}
          className="text-sm font-medium text-navy border border-navy/30 rounded-md px-3 py-1.5 hover:bg-navy/5 transition-colors"
        >
          {t("newEvaluation.loadSample")}
        </button>
      </div>

      {/* PART A — RFQ Header */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-navy mb-4">
          {t("newEvaluation.rfqDetails")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className={labelClass}>{t("newEvaluation.rfqTitle")}</label>
            <input
              type="text"
              value={rfqHeader.title}
              onChange={updateHeaderField("title")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("newEvaluation.product")}</label>
            <input
              type="text"
              value={rfqHeader.product}
              onChange={updateHeaderField("product")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {t("newEvaluation.annualVolume")}
            </label>
            <input
              type="number"
              min="0"
              value={rfqHeader.annualVolume}
              onChange={updateHeaderField("annualVolume")}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {t("newEvaluation.baseCurrency")}
            </label>
            <select
              value={rfqHeader.baseCurrency}
              onChange={updateHeaderField("baseCurrency")}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              {t("newEvaluation.evaluationDate")}
            </label>
            <input
              type="date"
              value={rfqHeader.evaluationDate}
              onChange={updateHeaderField("evaluationDate")}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <QuoteUpload
        rfqHeader={rfqHeader}
        maxFiles={supplierCap}
        onSuppliersExtracted={handleSuppliersExtracted}
      />

      {/* PART B — Supplier Entry Table */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">
            {t("newEvaluation.suppliers")}
          </h2>
          <span className="text-sm font-medium text-gray-600">
            {t("newEvaluation.suppliersAdded")}: {suppliers.length}/{supplierCap}
          </span>
        </div>
        {monthlyLimit !== Infinity && (
          <p className="mb-4 text-xs text-gray-500">
            {t("newEvaluation.monthlyUsage", {
              used: monthlyUsed,
              limit: monthlyLimit,
            })}
          </p>
        )}

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy text-white text-sm">
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.index")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.supplierName")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.country")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.currency")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.unitPrice")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.leadTime")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.paymentTerms")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.moq")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.sasoStatus")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.deliveryTerms")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.portCity")}
                </th>
                <th className="py-2 px-2 font-medium">
                  {t("newEvaluation.table.notes")}
                </th>
                <th className="py-2 px-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, index) => (
                <SupplierRow
                  key={supplier.id}
                  supplier={supplier}
                  index={index}
                  onChange={updateSupplierField}
                  onRemove={removeSupplier}
                  onApplyExtraction={handleApplyExtraction}
                  autoFilled={autoFilledByRow[supplier.id]}
                  rfqHeader={rfqHeader}
                  baseCurrency={rfqHeader.baseCurrency}
                  fxRates={fx.status === "success" ? fx.rates : null}
                />
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-sm text-gray-500">
                    {t("newEvaluation.noSuppliers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PART C — Actions */}
      {saveError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {saveError}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={addSupplier}
          disabled={suppliers.length >= supplierCap && supplierCap >= MAX_SUPPLIERS}
          className="bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("newEvaluation.addSupplier")}
        </button>

        <button
          type="button"
          onClick={handleSaveAndContinue}
          disabled={saving}
          className="bg-gold text-navy px-5 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? t("newEvaluation.saving")
            : t("newEvaluation.saveContinue")}
        </button>
      </div>

      <UpgradeModal
        open={upgradeFeature !== null}
        onClose={() => setUpgradeFeature(null)}
        feature={
          upgradeFeature === "suppliers"
            ? "maxSuppliers"
            : upgradeFeature === "evaluations"
            ? "monthlyEvaluations"
            : null
        }
      />
    </div>
  );
}
