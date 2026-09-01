import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

// Gates a route behind login — but only when Supabase auth is actually
// configured. On the preview build (no Supabase env) `isAuthConfigured` is
// false and every route stays public, so nothing regresses for anonymous users.
export default function ProtectedRoute({ children }) {
  const { isAuthConfigured, loading, user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (!isAuthConfigured) return children;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-24 flex items-center justify-center gap-3 text-navy">
        <span className="inline-block h-5 w-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
        {t("auth.checkingSession")}
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return children;
}
