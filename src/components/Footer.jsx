import { useLanguage } from "../context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-navy text-white/70 text-sm text-center py-4 mt-auto">
      <p>
        &copy; {new Date().getFullYear()} RFQ Evaluator. {t("footer.rights")}
      </p>
    </footer>
  );
}
