import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import FadeInSection from "../components/FadeInSection";

const INDUSTRY_KEYS = ["procurement", "construction", "government", "logistics", "manufacturing"];
const PROBLEM_KEYS = ["formats", "currency", "time"];
const STEP_KEYS = ["enter", "normalize", "score", "memo"];
const FEATURE_ITEM_KEYS = ["scoring", "currency", "compliance", "memo", "arabic", "history"];
const PRICING_KEYS = ["free", "pro", "team"];
const PRICING_HIGHLIGHT = { free: false, pro: true, team: false };
const CONTACT_EMAIL = "sales@rfqevaluator.com";

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Lets other pages (e.g. the footer's Pricing link) navigate here and
  // land on a specific section instead of always the top of the page.
  useEffect(() => {
    const targetId = location.state?.scrollTo;
    if (!targetId) return;
    const frame = requestAnimationFrame(() => scrollToId(targetId));
    navigate(location.pathname, { replace: true, state: {} });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* SECTION 1 — Hero */}
      <section className="bg-navy text-white min-h-screen flex items-center">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <FadeInSection>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6">
              {t("home.hero.headline")}
            </h1>
            <p className="text-white/80 max-w-2xl mx-auto mb-10 text-lg">
              {t("home.hero.subheadline")}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/new-evaluation"
                className="bg-gold text-navy px-8 py-3 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {t("home.hero.ctaPrimary")}
              </Link>
              <button
                type="button"
                onClick={() => scrollToId("how-it-works")}
                className="border border-white/40 text-white px-8 py-3 rounded-md text-sm font-semibold hover:border-gold hover:text-gold transition-colors"
              >
                {t("home.hero.ctaSecondary")}
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* SECTION 2 — Industries We Serve */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy text-center mb-12">
              {t("home.industries.heading")}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INDUSTRY_KEYS.map((key) => (
              <FadeInSection key={key}>
                <div className="h-full border border-gray-200 rounded-lg p-6">
                  <span className="text-3xl block mb-3">
                    {t(`home.industries.items.${key}.icon`)}
                  </span>
                  <h3 className="font-semibold text-navy mb-2">
                    {t(`home.industries.items.${key}.name`)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t(`home.industries.items.${key}.description`)}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
          <FadeInSection>
            <p className="text-center text-gold font-semibold mt-10">
              {t("home.industries.footnote")}
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* SECTION 3 — Problem Statement */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy text-center mb-12">
              {t("home.problem.heading")}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PROBLEM_KEYS.map((key) => (
              <FadeInSection key={key}>
                <div className="h-full bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <span className="text-4xl block mb-4">
                    {t(`home.problem.cards.${key}.icon`)}
                  </span>
                  <p className="text-gray-700">{t(`home.problem.cards.${key}.text`)}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
          <FadeInSection>
            <p className="text-center font-bold text-navy mt-10 text-lg">
              {t("home.problem.solvedSuffix")}
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* SECTION 4 — How It Works */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy text-center mb-12">
              {t("home.howItWorks.heading")}
            </h2>
          </FadeInSection>
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-4">
            {STEP_KEYS.map((key, i) => (
              <FadeInSection key={key} className="flex-1 flex flex-col md:flex-row md:items-center gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center flex-1 w-full">
                  <span className="text-4xl block mb-3">
                    {t(`home.howItWorks.steps.${key}.icon`)}
                  </span>
                  <h3 className="font-semibold text-navy mb-1">
                    {t(`home.howItWorks.steps.${key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t(`home.howItWorks.steps.${key}.description`)}
                  </p>
                </div>
                {i < STEP_KEYS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="hidden md:block text-2xl text-gold shrink-0 rtl:rotate-180"
                  >
                    →
                  </span>
                )}
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — Features Grid */}
      <section className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy text-center mb-12">
              {t("home.featuresGrid.heading")}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_ITEM_KEYS.map((key) => (
              <FadeInSection key={key}>
                <div className="h-full bg-white border border-gray-200 rounded-lg p-6">
                  <span className="text-3xl block mb-3">
                    {t(`home.featuresGrid.items.${key}.icon`)}
                  </span>
                  <h3 className="font-semibold text-navy mb-2">
                    {t(`home.featuresGrid.items.${key}.title`)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t(`home.featuresGrid.items.${key}.description`)}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — Pricing */}
      <section id="pricing" className="bg-navy">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              {t("home.pricing.heading")}
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {PRICING_KEYS.map((key) => {
              const highlight = PRICING_HIGHLIGHT[key];
              const cta = t(`home.pricing.plans.${key}.cta`);
              return (
                <FadeInSection key={key} className="h-full">
                  <div
                    className={`h-full flex flex-col bg-white rounded-lg p-8 ${
                      highlight
                        ? "border-2 border-gold shadow-lg relative"
                        : "border border-gray-200"
                    }`}
                  >
                    {highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-navy text-xs font-semibold px-3 py-1 rounded-full">
                        {t("home.pricing.mostPopular")}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-navy mb-1">
                      {t(`home.pricing.plans.${key}.name`)}
                    </h3>
                    <p className="mb-6">
                      <span className="text-3xl font-bold text-navy">
                        {t(`home.pricing.plans.${key}.price`)}
                      </span>{" "}
                      <span className="text-gray-500 text-sm">
                        {t("home.pricing.period")}
                      </span>
                    </p>
                    <ul className="text-sm text-gray-700 space-y-2 mb-8 flex-1">
                      {t(`home.pricing.plans.${key}.features`).map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="text-gold font-bold shrink-0">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {key === "team" ? (
                      <a
                        href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                          t("home.pricing.contactSubject")
                        )}`}
                        className="text-center px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 bg-navy text-white"
                      >
                        {cta}
                      </a>
                    ) : (
                      <Link
                        to="/new-evaluation"
                        className={`text-center px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 ${
                          highlight ? "bg-gold text-navy" : "bg-navy text-white"
                        }`}
                      >
                        {cta}
                      </Link>
                    )}
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 7 — Final CTA */}
      <section className="bg-gold">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <FadeInSection>
            <h2 className="text-3xl font-bold text-navy mb-4">{t("home.finalCta.heading")}</h2>
            <p className="text-navy/80 mb-10">{t("home.finalCta.subheading")}</p>
            <Link
              to="/new-evaluation"
              className="inline-block bg-navy text-white px-10 py-4 rounded-md text-base font-semibold hover:opacity-90 transition-opacity"
            >
              {t("home.finalCta.cta")}
            </Link>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
