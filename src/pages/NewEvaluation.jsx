import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SupplierRow, { CURRENCIES } from "../components/SupplierRow";
import { useLanguage } from "../context/LanguageContext";
import { fetchExchangeRates } from "../utils/currency";
import { saveEvaluation } from "../utils/storage";

const MAX_SUPPLIERS = 10;

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
  const { t } = useLanguage();

  const [rfqHeader, setRfqHeader] = useState({
    title: "",
    product: "",
    annualVolume: "",
    baseCurrency: "SAR",
    evaluationDate: todayIsoDate(),
  });

  const [suppliers, setSuppliers] = useState([emptySupplier()]);

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
  };

  const addSupplier = () => {
    setSuppliers((prev) =>
      prev.length >= MAX_SUPPLIERS ? prev : [...prev, emptySupplier()]
    );
  };

  const removeSupplier = (id) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveAndContinue = () => {
    const id = saveEvaluation(rfqHeader, suppliers);
    navigate(`/results/${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-navy mb-8">
        {t("newEvaluation.heading")}
      </h1>

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

      {/* PART B — Supplier Entry Table */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">
            {t("newEvaluation.suppliers")}
          </h2>
          <span className="text-sm font-medium text-gray-600">
            {t("newEvaluation.suppliersAdded")}: {suppliers.length}/
            {MAX_SUPPLIERS}
          </span>
        </div>

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
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addSupplier}
          disabled={suppliers.length >= MAX_SUPPLIERS}
          className="bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("newEvaluation.addSupplier")}
        </button>

        <button
          type="button"
          onClick={handleSaveAndContinue}
          className="bg-gold text-navy px-5 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t("newEvaluation.saveContinue")}
        </button>
      </div>
    </div>
  );
}
