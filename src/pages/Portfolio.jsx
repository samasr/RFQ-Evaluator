import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import FadeInSection from "../components/FadeInSection";
import CaseStudyCard from "../components/CaseStudyCard";

export default function Portfolio() {
  const { t } = useLanguage();
  const caseStudies = t("portfolio.caseStudies");

  return (
    <div>
      {/* Header */}
      <section className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <FadeInSection>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-6">
              {t("portfolio.header.title")}
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto text-lg">
              {t("portfolio.header.subtitle")}
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* Case studies */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
          {caseStudies.map((caseStudy) => (
            <FadeInSection key={caseStudy.id}>
              <CaseStudyCard caseStudy={caseStudy} />
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gold">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy mb-4">{t("portfolio.cta.title")}</h2>
            <p className="text-navy/80 mb-10">{t("portfolio.cta.subtitle")}</p>
            <Link
              to="/new-evaluation"
              className="inline-block bg-navy text-white px-10 py-4 rounded-md text-base font-semibold hover:opacity-90 transition-opacity"
            >
              {t("portfolio.cta.button")}
            </Link>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
