import { useLanguage } from "../context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-navy">{t("home.heading")}</h1>
    </div>
  );
}
