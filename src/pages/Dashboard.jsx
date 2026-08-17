import { useLanguage } from "../context/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">{t("dashboard.heading")}</h1>
    </div>
  );
}
