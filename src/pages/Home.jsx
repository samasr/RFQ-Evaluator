import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { getLatestEvaluation } from "../utils/storage";

const FEATURE_KEYS = ["scoring", "currency", "compliance", "bilingual"];

export default function Home() {
  const { t } = useLanguage();
  const hasHistory = Boolean(getLatestEvaluation());

  return (
    <div>
      <section className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl font-bold mb-4">{t("home.heading")}</h1>
          <p className="text-white/80 max-w-2xl mx-auto mb-8">
            {t("home.tagline")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/new-evaluation"
              className="bg-gold text-navy px-6 py-3 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t("home.startEvaluation")}
            </Link>
            <Link
              to="/dashboard"
              className="border border-white/40 text-white px-6 py-3 rounded-md text-sm font-semibold hover:border-gold hover:text-gold transition-colors"
            >
              {hasHistory ? t("home.viewDashboard") : t("home.learnMore")}
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURE_KEYS.map((key) => (
            <div key={key} className="border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-navy mb-2">
                {t(`home.features.${key}.title`)}
              </h3>
              <p className="text-sm text-gray-600">
                {t(`home.features.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
