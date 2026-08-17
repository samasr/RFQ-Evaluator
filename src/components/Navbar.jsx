import { Link } from "react-router-dom";

export default function Navbar({ language, setLanguage }) {
  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ar" : "en"));
  };

  return (
    <nav className="bg-navy text-white shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-wide">
          RFQ Evaluator
        </Link>

        <div className="flex items-center gap-8">
          <Link to="/" className="hover:text-gold transition-colors">
            Home
          </Link>
          <Link to="/dashboard" className="hover:text-gold transition-colors">
            Dashboard
          </Link>
          <Link
            to="/new-evaluation"
            className="hover:text-gold transition-colors"
          >
            New Evaluation
          </Link>
          <Link to="/results" className="hover:text-gold transition-colors">
            Results
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            className="border border-gold text-gold px-3 py-1 rounded-md text-sm font-medium hover:bg-gold hover:text-navy transition-colors"
          >
            {language === "en" ? "EN | AR" : "AR | EN"}
          </button>
        </div>
      </div>
    </nav>
  );
}
