import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import NewEvaluation from "./pages/NewEvaluation";
import Results from "./pages/Results";

function AppShell() {
  const { dir } = useLanguage();

  return (
    <div dir={dir} className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-evaluation" element={<NewEvaluation />} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:id" element={<Results />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
