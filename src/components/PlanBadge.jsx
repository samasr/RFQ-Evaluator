import { useLanguage } from "../context/LanguageContext";

const STYLES = {
  free: "bg-gray-200 text-gray-700",
  pro: "bg-gold text-navy",
  team: "bg-navy text-white border border-gold",
};

// Renders nothing for the `local` sentinel plan (no account / unconfigured build).
export default function PlanBadge({ plan, className = "" }) {
  const { t } = useLanguage();
  if (!plan || plan === "local") return null;
  const style = STYLES[plan] || STYLES.free;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${style} ${className}`}
    >
      {t(`plan.names.${plan}`)}
    </span>
  );
}
