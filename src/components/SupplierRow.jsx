import { useMemo, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { convertToBase, formatRate } from "../utils/currency";
import { extractSupplierFromFile, isSupportedQuoteFile } from "../utils/extraction";
import { PlanRequiredError } from "../lib/aiProxy";

const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL;

const COUNTRIES = ["Saudi Arabia", "UAE", "China", "Egypt", "India", "Other"];
const CURRENCIES = ["SAR", "USD", "CNY", "EUR"];
const PAYMENT_TERMS = [
  "100% upfront",
  "50% advance",
  "Net 30",
  "Net 60",
  "LC at sight",
];
const SASO_STATUSES = [
  "SASO + ISO",
  "SASO only",
  "ISO only",
  "None",
  "Not stated",
];
const DELIVERY_TERMS = ["DDP", "DAP", "CIF", "FOB", "EXW", "CFR"];

const inputClass =
  "w-full min-w-[7rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy";
const autoFilledClass = "bg-cream border-gold/60";

function Select({ value, onChange, options, labels, className }) {
  return (
    <select value={value} onChange={onChange} className={className ?? inputClass}>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function buildLabels(t, category, options) {
  return Object.fromEntries(
    options.map((option) => [option, t(`options.${category}.${option}`)])
  );
}

export default function SupplierRow({
  supplier,
  index,
  onChange,
  onRemove,
  onApplyExtraction,
  autoFilled,
  rfqHeader,
  baseCurrency,
  fxRates,
  onPlanRequired,
}) {
  const { t } = useLanguage();
  const set = (field) => (e) => onChange(supplier.id, field, e.target.value);

  const fileRef = useRef(null);
  const [extract, setExtract] = useState({ status: "idle", error: null });

  const autoSet = useMemo(() => new Set(autoFilled || []), [autoFilled]);
  const fieldClass = (field) =>
    `${inputClass} ${autoSet.has(field) ? autoFilledClass : ""}`;

  const countryLabels = buildLabels(t, "countries", COUNTRIES);
  const paymentTermsLabels = buildLabels(t, "paymentTerms", PAYMENT_TERMS);
  const sasoStatusLabels = buildLabels(t, "sasoStatuses", SASO_STATUSES);

  const showRate =
    baseCurrency && fxRates && supplier.currency !== baseCurrency;
  const rateValue = showRate
    ? convertToBase(1, supplier.currency, baseCurrency, fxRates)
    : null;
  const rateLabel = formatRate(rateValue);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isSupportedQuoteFile(file)) {
      setExtract({ status: "error", error: t("newEvaluation.quoteUnsupported") });
      return;
    }
    setExtract({ status: "reading", error: null });
    try {
      const { supplier: extracted, filledFields } = await extractSupplierFromFile({
        file,
        rfqHeader,
        proxyUrl: PROXY_URL,
      });
      onApplyExtraction(supplier.id, extracted, filledFields);
      setExtract({ status: "success", error: null });
    } catch (err) {
      if (err instanceof PlanRequiredError) {
        setExtract({ status: "idle", error: null });
        onPlanRequired?.(err.message);
        return;
      }
      setExtract({ status: "error", error: err.message });
    }
  };

  return (
    <tr className="border-b border-gray-200 align-top">
      <td className="py-2 pr-2 text-sm text-gray-500">{index + 1}</td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={supplier.name}
          onChange={set("name")}
          placeholder={t("newEvaluation.supplierNamePlaceholder")}
          className={fieldClass("name")}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*,application/pdf"
          className="hidden"
          onChange={handleFile}
        />
        <div className="mt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!PROXY_URL || extract.status === "reading"}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-navy hover:text-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {extract.status === "reading" ? (
              <>
                <span
                  role="status"
                  className="inline-block h-3 w-3 border-2 border-navy border-t-transparent rounded-full animate-spin"
                />
                {t("newEvaluation.readingQuote")}
              </>
            ) : (
              t("newEvaluation.uploadQuote")
            )}
          </button>
          {extract.status === "success" && (
            <p className="mt-0.5 text-[11px] text-green-600">
              {t("newEvaluation.quoteExtracted")}
            </p>
          )}
          {extract.status === "error" && (
            <p className="mt-0.5 text-[11px] text-red-600" title={extract.error}>
              {t("newEvaluation.quoteFailed")}: {extract.error}
            </p>
          )}
        </div>
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.country}
          onChange={set("country")}
          options={COUNTRIES}
          labels={countryLabels}
          className={fieldClass("country")}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.currency}
          onChange={set("currency")}
          options={CURRENCIES}
          className={fieldClass("currency")}
        />
        {rateLabel && (
          <p className="mt-1 text-[11px] text-gray-500 whitespace-nowrap">
            1 {supplier.currency} ≈ {rateLabel} {baseCurrency}
          </p>
        )}
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.unitPrice}
          onChange={set("unitPrice")}
          className={fieldClass("unitPrice")}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.leadTime}
          onChange={set("leadTime")}
          className={fieldClass("leadTime")}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.paymentTerms}
          onChange={set("paymentTerms")}
          options={PAYMENT_TERMS}
          labels={paymentTermsLabels}
          className={fieldClass("paymentTerms")}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.moq}
          onChange={set("moq")}
          className={fieldClass("moq")}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.sasoStatus}
          onChange={set("sasoStatus")}
          options={SASO_STATUSES}
          labels={sasoStatusLabels}
          className={fieldClass("sasoStatus")}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.deliveryTerms}
          onChange={set("deliveryTerms")}
          options={DELIVERY_TERMS}
          className={fieldClass("deliveryTerms")}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={supplier.portCity ?? ""}
          onChange={set("portCity")}
          placeholder={t("newEvaluation.portCityPlaceholder")}
          className={fieldClass("portCity")}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={supplier.notes}
          onChange={set("notes")}
          placeholder={t("newEvaluation.notesPlaceholder")}
          className={fieldClass("notes")}
        />
      </td>
      <td className="py-2 pr-2">
        <button
          type="button"
          onClick={() => onRemove(supplier.id)}
          className="text-sm font-medium text-red-600 hover:text-red-800 whitespace-nowrap"
        >
          {t("newEvaluation.remove")}
        </button>
      </td>
    </tr>
  );
}

export { COUNTRIES, CURRENCIES, PAYMENT_TERMS, SASO_STATUSES, DELIVERY_TERMS };
