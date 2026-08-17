import { useLanguage } from "../context/LanguageContext";

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

function Select({ value, onChange, options, labels }) {
  return (
    <select value={value} onChange={onChange} className={inputClass}>
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

export default function SupplierRow({ supplier, index, onChange, onRemove }) {
  const { t } = useLanguage();
  const set = (field) => (e) => onChange(supplier.id, field, e.target.value);

  const countryLabels = buildLabels(t, "countries", COUNTRIES);
  const paymentTermsLabels = buildLabels(t, "paymentTerms", PAYMENT_TERMS);
  const sasoStatusLabels = buildLabels(t, "sasoStatuses", SASO_STATUSES);

  return (
    <tr className="border-b border-gray-200 align-top">
      <td className="py-2 pr-2 text-sm text-gray-500">{index + 1}</td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={supplier.name}
          onChange={set("name")}
          placeholder={t("newEvaluation.supplierNamePlaceholder")}
          className={inputClass}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.country}
          onChange={set("country")}
          options={COUNTRIES}
          labels={countryLabels}
        />
      </td>
      <td className="py-2 pr-2">
        <Select value={supplier.currency} onChange={set("currency")} options={CURRENCIES} />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.unitPrice}
          onChange={set("unitPrice")}
          className={inputClass}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.leadTime}
          onChange={set("leadTime")}
          className={inputClass}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.paymentTerms}
          onChange={set("paymentTerms")}
          options={PAYMENT_TERMS}
          labels={paymentTermsLabels}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min="0"
          value={supplier.moq}
          onChange={set("moq")}
          className={inputClass}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.sasoStatus}
          onChange={set("sasoStatus")}
          options={SASO_STATUSES}
          labels={sasoStatusLabels}
        />
      </td>
      <td className="py-2 pr-2">
        <Select
          value={supplier.deliveryTerms}
          onChange={set("deliveryTerms")}
          options={DELIVERY_TERMS}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="text"
          value={supplier.notes}
          onChange={set("notes")}
          placeholder={t("newEvaluation.notesPlaceholder")}
          className={inputClass}
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
