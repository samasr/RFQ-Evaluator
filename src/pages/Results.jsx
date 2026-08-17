// Placeholder data until real evaluation results are wired up.
const sampleResults = [
  { supplier: "Al Rajhi Supplies Co.", price: 125000, deliveryDays: 14, score: 92 },
  { supplier: "Gulf Trading Est.", price: 118500, deliveryDays: 21, score: 87 },
  { supplier: "Riyadh Industrial Group", price: 131200, deliveryDays: 10, score: 89 },
];

function exportToCsv(rows) {
  const headers = ["Supplier", "Price (SAR)", "Delivery (days)", "Score"];
  const csvRows = rows.map((r) =>
    [r.supplier, r.price, r.deliveryDays, r.score]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csvContent = [headers.join(","), ...csvRows].join("\r\n");

  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rfq-evaluation-results.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Results() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-navy">Results</h1>
        <button
          type="button"
          onClick={() => exportToCsv(sampleResults)}
          className="bg-gold text-navy px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Export to Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-navy">
              <th className="py-2 pr-4 text-navy">Supplier</th>
              <th className="py-2 pr-4 text-navy">Price (SAR)</th>
              <th className="py-2 pr-4 text-navy">Delivery (days)</th>
              <th className="py-2 pr-4 text-navy">Score</th>
            </tr>
          </thead>
          <tbody>
            {sampleResults.map((r) => (
              <tr key={r.supplier} className="border-b border-gray-200">
                <td className="py-2 pr-4">{r.supplier}</td>
                <td className="py-2 pr-4">{r.price.toLocaleString()}</td>
                <td className="py-2 pr-4">{r.deliveryDays}</td>
                <td className="py-2 pr-4">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
