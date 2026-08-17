import { Link } from "react-router-dom";
import { rankSuppliers } from "../utils/scoring";

function loadEvaluation() {
  try {
    const raw = localStorage.getItem("rfqEvaluation");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function exportToCsv(rfqHeader, rankedSuppliers) {
  const headers = [
    "Rank",
    "Score",
    "Supplier",
    "Country",
    "Currency",
    "Unit Price",
    "Lead Time (days)",
    "Payment Terms",
    "MOQ",
    "SASO Status",
    "Delivery Terms",
    "Notes",
  ];
  const csvRows = rankedSuppliers.map((s, i) =>
    [
      i + 1,
      s.score,
      s.name,
      s.country,
      s.currency,
      s.unitPrice,
      s.leadTime,
      s.paymentTerms,
      s.moq,
      s.sasoStatus,
      s.deliveryTerms,
      s.notes,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csvContent = [headers.join(","), ...csvRows].join("\r\n");

  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileTitle = rfqHeader?.title?.trim() || "rfq-evaluation";
  link.download = `${fileTitle.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function scoreBadgeClass(score) {
  if (score >= 75) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export default function Results() {
  const evaluation = loadEvaluation();
  const rfqHeader = evaluation?.rfqHeader;
  const suppliers = evaluation?.suppliers ?? [];

  if (!evaluation || suppliers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-navy mb-4">Results</h1>
        <p className="text-gray-600 mb-6">
          No evaluation data found yet. Start a new evaluation to see results here.
        </p>
        <Link
          to="/new-evaluation"
          className="inline-block bg-navy text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start New Evaluation
        </Link>
      </div>
    );
  }

  const rankedSuppliers = rankSuppliers(suppliers);
  const hasMixedCurrencies =
    new Set(suppliers.map((s) => s.currency)).size > 1;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-navy">Results</h1>
        <button
          type="button"
          onClick={() => exportToCsv(rfqHeader, rankedSuppliers)}
          className="bg-gold text-navy px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Export to Excel
        </button>
      </div>

      {rfqHeader && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">RFQ Title</p>
            <p className="font-medium text-navy">{rfqHeader.title || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Product / Material</p>
            <p className="font-medium text-navy">{rfqHeader.product || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Est. Annual Volume</p>
            <p className="font-medium text-navy">{rfqHeader.annualVolume || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Base Currency</p>
            <p className="font-medium text-navy">{rfqHeader.baseCurrency}</p>
          </div>
          <div>
            <p className="text-gray-500">Evaluation Date</p>
            <p className="font-medium text-navy">{rfqHeader.evaluationDate}</p>
          </div>
        </div>
      )}

      {hasMixedCurrencies && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
          Suppliers quoted in different currencies — prices and scores compare
          raw quoted amounts without FX conversion. Treat the price score as
          directional, not exact, until currency conversion is added.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-navy">
              <th className="py-2 pr-4 text-navy">Rank</th>
              <th className="py-2 pr-4 text-navy">Score</th>
              <th className="py-2 pr-4 text-navy">Supplier</th>
              <th className="py-2 pr-4 text-navy">Country</th>
              <th className="py-2 pr-4 text-navy">Unit Price</th>
              <th className="py-2 pr-4 text-navy">Lead Time (days)</th>
              <th className="py-2 pr-4 text-navy">Payment Terms</th>
              <th className="py-2 pr-4 text-navy">MOQ</th>
              <th className="py-2 pr-4 text-navy">SASO Status</th>
              <th className="py-2 pr-4 text-navy">Delivery Terms</th>
              <th className="py-2 pr-4 text-navy">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rankedSuppliers.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-200">
                <td className="py-2 pr-4 font-semibold text-navy">{i + 1}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${scoreBadgeClass(
                      s.score
                    )}`}
                  >
                    {s.score}
                  </span>
                </td>
                <td className="py-2 pr-4">{s.name || "—"}</td>
                <td className="py-2 pr-4">{s.country}</td>
                <td className="py-2 pr-4">
                  {s.unitPrice || "—"}{" "}
                  <span className="text-gray-400">{s.currency}</span>
                </td>
                <td className="py-2 pr-4">{s.leadTime || "—"}</td>
                <td className="py-2 pr-4">{s.paymentTerms}</td>
                <td className="py-2 pr-4">{s.moq || "—"}</td>
                <td className="py-2 pr-4">{s.sasoStatus}</td>
                <td className="py-2 pr-4">{s.deliveryTerms}</td>
                <td className="py-2 pr-4">{s.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
