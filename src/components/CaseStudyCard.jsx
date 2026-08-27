import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const INDUSTRY_STYLES = {
  manufacturing: "bg-blue-100 text-blue-700",
  fmcg: "bg-green-100 text-green-700",
  logistics: "bg-orange-100 text-orange-700",
};

const CRITERIA_KEYS = ["price", "leadTime", "payment", "saso", "moq", "completeness"];

function scoreCellClass(value) {
  if (value >= 8) return "text-green-700 bg-green-50";
  if (value >= 6) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function totalCellClass(value) {
  if (value >= 80) return "text-green-700 bg-green-50 border-green-200";
  if (value >= 60) return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export default function CaseStudyCard({ caseStudy }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const winner = caseStudy.scores.find((row) => row.isWinner);
  const industryClass = INDUSTRY_STYLES[caseStudy.industry] || "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span
              className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${industryClass}`}
            >
              {t(`portfolio.industries.${caseStudy.industry}`)}
            </span>
            <h3 className="text-xl font-bold text-navy mt-3">{caseStudy.title}</h3>
            <p className="text-sm text-gray-500">{caseStudy.companyType}</p>
          </div>
          {winner && (
            <div className="text-right rtl:text-left">
              <p className="text-xs text-gray-500">{t("portfolio.winnerLabel")}</p>
              <p className="font-semibold text-navy">
                👑 {winner.supplier}
              </p>
            </div>
          )}
        </div>

        <p className="text-gray-700 mb-3">{caseStudy.challenge}</p>
        <p className="text-xs text-gray-500 mb-6">
          {t("portfolio.stats.currencies")}: {caseStudy.currencies.join(", ")}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500">{t("portfolio.stats.suppliersEvaluated")}</p>
            <p className="text-xl font-bold text-navy mt-1">{caseStudy.suppliersEvaluated}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500">{t("portfolio.stats.timeSaved")}</p>
            <p className="text-xl font-bold text-navy mt-1">{caseStudy.timeSaved}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500">{t("portfolio.stats.result")}</p>
            <p className="text-xl font-bold text-gold mt-1">{caseStudy.result}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-center gap-2 border border-navy text-navy text-sm font-semibold px-4 py-2.5 rounded-md hover:bg-navy hover:text-white transition-colors"
        >
          {expanded ? t("portfolio.hideFull") : t("portfolio.viewFull")}
          <span
            aria-hidden="true"
            className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>

        <div
          className={`grid transition-all duration-500 ease-in-out ${
            expanded ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-6">
              <table className="w-full text-left rtl:text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-navy text-white">
                    <th className="py-2 px-3 font-medium">{t("portfolio.scoresTable.supplier")}</th>
                    {CRITERIA_KEYS.map((key) => (
                      <th key={key} className="py-2 px-3 font-medium whitespace-nowrap">
                        {t(`results.ai.criteria.${key}`)}
                      </th>
                    ))}
                    <th className="py-2 px-3 font-medium">{t("portfolio.scoresTable.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {caseStudy.scores.map((row) => (
                    <tr
                      key={row.supplier}
                      className={`border-b border-gray-200 last:border-0 ${
                        row.isWinner ? "bg-gold/10" : ""
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-navy whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          {row.supplier}
                          {row.isWinner && (
                            <span className="inline-flex items-center gap-1 bg-gold text-navy text-xs font-semibold px-2 py-0.5 rounded-full">
                              👑 {t("portfolio.winnerBadge")}
                            </span>
                          )}
                        </span>
                      </td>
                      {CRITERIA_KEYS.map((key) => (
                        <td key={key} className="py-2 px-3">
                          <span className={`inline-block w-8 text-center rounded px-1.5 py-0.5 ${scoreCellClass(row[key])}`}>
                            {row[key]}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block font-bold rounded px-2 py-0.5 border ${totalCellClass(row.total)}`}
                        >
                          {row.total}/100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-l-4 rtl:border-l-0 rtl:border-r-4 border-gold bg-amber-50 rounded-r-md rtl:rounded-r-none rtl:rounded-l-md p-4">
              <p className="text-xs font-semibold text-gold uppercase tracking-wide mb-1">
                {t("portfolio.keyInsightLabel")}
              </p>
              <p className="italic text-gray-700">{caseStudy.keyInsight}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
