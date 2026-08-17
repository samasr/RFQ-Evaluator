import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import NewEvaluation from "./pages/NewEvaluation";
import Results from "./pages/Results";

function App() {
  // Language state is ready for RTL support; defaults to English/LTR.
  const [language, setLanguage] = useState("en");
  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <BrowserRouter>
      <div dir={dir} className="min-h-screen flex flex-col bg-white">
        <Navbar language={language} setLanguage={setLanguage} />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/new-evaluation" element={<NewEvaluation />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
