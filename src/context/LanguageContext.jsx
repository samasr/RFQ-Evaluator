import { createContext, useContext, useMemo, useState } from "react";
import translations from "../i18n/translations";

const LanguageContext = createContext(null);

function resolvePath(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.replaceAll(`{${key}}`, value),
    template
  );
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");
  const dir = language === "ar" ? "rtl" : "ltr";

  const value = useMemo(() => {
    const toggleLanguage = () =>
      setLanguage((prev) => (prev === "en" ? "ar" : "en"));

    const t = (path, vars) => {
      const template = resolvePath(translations[language], path);
      return template ? interpolate(template, vars) : path;
    };

    return { language, dir, toggleLanguage, t };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
