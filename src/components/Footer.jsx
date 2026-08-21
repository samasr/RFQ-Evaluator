import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function Footer() {
  const { language, toggleLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const handlePricingClick = (e) => {
    e.preventDefault();
    if (location.pathname === "/") {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/", { state: { scrollTo: "pricing" } });
    }
  };

  return (
    <footer className="bg-navy text-white/70 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left rtl:sm:text-right">
            <Link to="/" className="text-lg font-bold text-white tracking-wide">
              RFQ Evaluator
            </Link>
            <p className="text-xs text-white/50 mt-1">{t("footer.byline")}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/" className="hover:text-gold transition-colors">
              {t("nav.home")}
            </Link>
            <Link to="/dashboard" className="hover:text-gold transition-colors">
              {t("nav.dashboard")}
            </Link>
            <Link to="/new-evaluation" className="hover:text-gold transition-colors">
              {t("nav.newEvaluation")}
            </Link>
            <button
              type="button"
              onClick={handlePricingClick}
              className="hover:text-gold transition-colors"
            >
              {t("footer.linkPricing")}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleLanguage}
            className="border border-gold text-gold px-3 py-1 rounded-md text-sm font-medium hover:bg-gold hover:text-navy transition-colors"
          >
            {language === "en" ? "EN | AR" : "AR | EN"}
          </button>
        </div>

        <p className="text-center text-xs text-white/50 mt-8">
          &copy; {new Date().getFullYear()} RFQ Evaluator. {t("footer.tagline")}
        </p>
      </div>
    </footer>
  );
}
