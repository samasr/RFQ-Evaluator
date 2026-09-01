import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { hasFeature } from "../lib/planLimits";
import UpgradeModal from "./UpgradeModal";

// Wraps a Results/NewEvaluation section. If the current plan includes
// `feature`, the children render untouched. Otherwise a locked placeholder
// with the same section heading is shown, and clicking it opens the upgrade
// modal. `local` plan (unconfigured build / public browsing) always passes.
export default function FeatureGate({ feature, title, children }) {
  const { t } = useLanguage();
  const { plan } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (hasFeature(plan, feature)) return children;

  return (
    <section className="mt-10">
      {title && (
        <h2 className="text-lg font-semibold text-navy mb-3">{title}</h2>
      )}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-dashed border-gold bg-gold/5 px-4 py-4 text-left rtl:text-right hover:bg-gold/10 transition-colors"
      >
        <span className="text-sm text-navy">
          <span className="mr-2 rtl:mr-0 rtl:ml-2">🔒</span>
          {t("plan.gate.locked", { feature: t(`plan.features.${feature}`) })}
        </span>
        <span className="shrink-0 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-navy">
          {t("plan.gate.cta")}
        </span>
      </button>
      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        feature={feature}
      />
    </section>
  );
}
