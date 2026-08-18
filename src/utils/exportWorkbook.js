import ExcelJS from "exceljs";
import { SCORE_CRITERIA } from "./scoring";

// Styling modeled on the reference "Supplier Evaluation Practice Kit" —
// same navy title band / blue header row / zebra striping / gold total
// column so exports look like the source workbook this app is based on.
const NAVY = "FF1F3864";
const HEADER_BLUE = "FF2E75B6";
const NOTE_YELLOW = "FFFFF3CD";
const ZEBRA_GRAY = "FFF2F2F2";
const GOLD = "FFC9A227";
const GREEN = "FFE2EFDA";
const RED = "FFFCE4E4";
const WHITE = "FFFFFFFF";

function titleRow(sheet, text, columnCount) {
  sheet.mergeCells(1, 1, 1, columnCount);
  const cell = sheet.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: WHITE }, size: 13 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 22;
}

function noteRow(sheet, rowNumber, text, columnCount) {
  sheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { bold: true, color: { argb: NAVY }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NOTE_YELLOW } };
  cell.alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(rowNumber).height = 18;
}

function headerRow(sheet, rowNumber, labels) {
  const row = sheet.getRow(rowNumber);
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: WHITE }, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  row.height = 28;
}

function zebraFill(sheet, rowNumber, columnCount, argb) {
  const row = sheet.getRow(rowNumber);
  for (let c = 1; c <= columnCount; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
}

function buildRawQuotesSheet(workbook, rfqHeader, suppliers, t) {
  const sheet = workbook.addWorksheet("Raw Quotes (Input)");
  const columns = 12;
  sheet.columns = [
    { width: 4 }, { width: 26 }, { width: 14 }, { width: 10 },
    { width: 12 }, { width: 12 }, { width: 22 }, { width: 10 },
    { width: 20 }, { width: 14 }, { width: 16 }, { width: 30 },
  ];

  titleRow(sheet, `${rfqHeader?.title || "RFQ"} — Raw Supplier Quotes (As Entered)`, columns);
  noteRow(
    sheet,
    2,
    `Product: ${rfqHeader?.product || "—"}  |  Est. Annual Volume: ${rfqHeader?.annualVolume || "—"}  |  Base Currency: ${rfqHeader?.baseCurrency || "—"}  |  Evaluation Date: ${rfqHeader?.evaluationDate || "—"}`,
    columns
  );
  headerRow(sheet, 3, [
    "#", "Supplier Name", "Country", "Currency", "Unit Price",
    "Lead Time (days)", "Payment Terms", "MOQ", "SASO / Cert Status",
    "Delivery Terms", "Port / City", "Notes / Issues",
  ]);

  suppliers.forEach((s, i) => {
    const rowNumber = 4 + i;
    const row = sheet.getRow(rowNumber);
    row.values = [
      i + 1,
      s.name || "—",
      t(`options.countries.${s.country}`),
      s.currency,
      s.unitPrice || "",
      s.leadTime || "",
      t(`options.paymentTerms.${s.paymentTerms}`),
      s.moq || "",
      t(`options.sasoStatuses.${s.sasoStatus}`),
      s.deliveryTerms,
      s.portCity || "—",
      s.notes || "—",
    ];
    row.font = { size: 9 };
    if (i % 2 === 0) zebraFill(sheet, rowNumber, columns, ZEBRA_GRAY);
  });

  return sheet;
}

function buildNormalizationSheet(workbook, rfqHeader, normalizedRows, assumptions) {
  const sheet = workbook.addWorksheet("Normalization Worksheet");
  const columns = 11;
  sheet.columns = [
    { width: 4 }, { width: 26 }, { width: 12 }, { width: 12 },
    { width: 13 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 15 }, { width: 14 }, { width: 30 },
  ];

  titleRow(sheet, `${rfqHeader?.title || "RFQ"} — Landed Cost Normalization (SAR, DDP Riyadh)`, columns);
  noteRow(
    sheet,
    2,
    `USD→SAR: ${assumptions.fxUSD}  |  CNY→SAR: ${assumptions.fxCNY}  |  EUR→SAR: ${assumptions.fxEUR}  |  Customs Duty: ${assumptions.customsPct}%  |  VAT: ${assumptions.vatPct}%  |  Freight Jeddah→Riyadh: SAR ${assumptions.freightJeddah}  |  Freight Dammam→Riyadh: SAR ${assumptions.freightDammam}`,
    columns
  );
  headerRow(sheet, 3, [
    "#", "Supplier", "Quoted\nCurrency", "Original\nPrice/Unit", "SAR\nEquivalent",
    "Freight\nAdjust (SAR)", "Customs\n(SAR)", "VAT\n(SAR)", "TOTAL LANDED\nCOST SAR",
    "Delivery\nTerms", "Notes",
  ]);

  const validTotals = normalizedRows.map((r) => r.totalLanded).filter((v) => v !== null);
  const minTotal = validTotals.length ? Math.min(...validTotals) : null;
  const maxTotal = validTotals.length ? Math.max(...validTotals) : null;
  const hasSpread = minTotal !== null && maxTotal !== null && minTotal !== maxTotal;

  normalizedRows.forEach((r, i) => {
    const rowNumber = 4 + i;
    const row = sheet.getRow(rowNumber);
    const isLowest = hasSpread && r.totalLanded === minTotal;
    const isHighest = hasSpread && r.totalLanded === maxTotal;
    row.values = [
      i + 1,
      r.name || "—",
      r.currency,
      Number(r.unitPrice) || 0,
      r.sarEquivalent ?? "",
      r.freight ?? "",
      r.customs ?? "",
      r.vat ?? "",
      r.totalLanded ?? "",
      r.deliveryTerms,
      (isLowest ? "Best Price. " : "") + (r.notes || ""),
    ];
    row.font = { size: 9 };
    for (const colLetter of ["D", "E", "F", "G", "H", "I"]) {
      row.getCell(colLetter).numFmt = "#,##0.00";
    }
    row.getCell(9).font = { size: 9, bold: true };
    const fillColor = isLowest ? GREEN : isHighest ? RED : i % 2 === 0 ? ZEBRA_GRAY : null;
    if (fillColor) zebraFill(sheet, rowNumber, columns, fillColor);
  });

  return sheet;
}

function buildScoringSheet(workbook, rfqHeader, rankedSuppliers) {
  const sheet = workbook.addWorksheet("Scoring Matrix");
  const columns = 2 + SCORE_CRITERIA.length + 1;
  sheet.columns = [
    { width: 4 }, { width: 26 },
    ...SCORE_CRITERIA.map(() => ({ width: 14 })),
    { width: 14 },
  ];

  titleRow(sheet, `${rfqHeader?.title || "RFQ"} — Weighted Supplier Scoring Matrix`, columns);
  const criteriaSummary = SCORE_CRITERIA.map(
    (c) => `${c.label} ${Math.round(c.weight * 100)}%`
  ).join("  |  ");
  noteRow(sheet, 2, `Criteria weights: ${criteriaSummary}. Scores are 0-100 per criterion; ranked best first.`, columns);

  headerRow(sheet, 3, [
    "#", "Supplier",
    ...SCORE_CRITERIA.map((c) => `${c.label}\n(${Math.round(c.weight * 100)}%)`),
    "WEIGHTED\nTOTAL",
  ]);
  sheet.getCell(3, columns).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
  sheet.getCell(3, columns).font = { bold: true, color: { argb: NAVY }, size: 9 };

  rankedSuppliers.forEach((s, i) => {
    const rowNumber = 4 + i;
    const row = sheet.getRow(rowNumber);
    row.values = [
      i + 1,
      s.name || "—",
      ...SCORE_CRITERIA.map((c) => Math.round(s.scoreBreakdown[c.key])),
      s.score,
    ];
    row.font = { size: 9 };
    if (i % 2 === 0) zebraFill(sheet, rowNumber, columns, ZEBRA_GRAY);
    row.getCell(columns).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    row.getCell(columns).font = { bold: true, color: { argb: NAVY }, size: 10 };
  });

  return sheet;
}

export async function exportEvaluationWorkbook({
  rfqHeader,
  suppliers,
  rankedSuppliers,
  normalizedRows,
  assumptions,
  t,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RFQ Evaluator";
  workbook.created = new Date();

  buildRawQuotesSheet(workbook, rfqHeader, suppliers, t);
  buildNormalizationSheet(workbook, rfqHeader, normalizedRows, assumptions);
  buildScoringSheet(workbook, rfqHeader, rankedSuppliers);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileTitle = rfqHeader?.title?.trim() || "rfq-evaluation";
  link.download = `${fileTitle.replace(/\s+/g, "-").toLowerCase()}-evaluation.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
