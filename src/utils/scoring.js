// Weighted supplier scoring. Weights sum to 100.
const WEIGHTS = {
  price: 0.4,
  leadTime: 0.2,
  compliance: 0.2,
  paymentTerms: 0.1,
  moq: 0.1,
};

const SASO_SCORES = {
  "SASO + ISO": 100,
  "SASO only": 75,
  "ISO only": 60,
  "Not stated": 30,
  None: 0,
};

// Ranked by favorability to the buyer's cash flow (longer deferral = better).
const PAYMENT_TERMS_SCORES = {
  "Net 60": 100,
  "Net 30": 80,
  "LC at sight": 60,
  "50% advance": 40,
  "100% upfront": 0,
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && value !== "" ? n : null;
}

// How well a supplier's MOQ fits the RFQ's estimated annual volume: a MOQ at
// or under the annual volume fully covers demand without over-committing
// inventory (score 100). A MOQ above the volume forces overbuying, penalized
// proportionally to how far it overshoots.
function moqFitScore(moq, annualVolume) {
  const moqNum = toNumber(moq);
  const volumeNum = toNumber(annualVolume);
  if (moqNum === null || moqNum <= 0 || volumeNum === null || volumeNum <= 0) {
    return null;
  }
  return Math.min(100, (volumeNum / moqNum) * 100);
}

// Normalizes a numeric field across all suppliers: lower raw value -> higher score.
// Suppliers missing the field score 0 for that criterion; they don't affect the min/max range.
function normalizeLowerIsBetter(suppliers, field) {
  const values = suppliers
    .map((s) => toNumber(s[field]))
    .filter((v) => v !== null);

  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;

  return suppliers.map((s) => {
    const value = toNumber(s[field]);
    if (value === null || min === null) return 0;
    if (max === min) return 100;
    return ((max - value) / (max - min)) * 100;
  });
}

export function scoreSuppliers(suppliers, { annualVolume } = {}) {
  const priceScores = normalizeLowerIsBetter(suppliers, "unitPrice");
  const leadTimeScores = normalizeLowerIsBetter(suppliers, "leadTime");

  // With a known annual volume, score MOQ by how well it fits that volume
  // rather than just favoring the lowest MOQ in the set.
  const hasVolume = toNumber(annualVolume) !== null && toNumber(annualVolume) > 0;
  const moqScores = hasVolume
    ? suppliers.map((s) => moqFitScore(s.moq, annualVolume) ?? 0)
    : normalizeLowerIsBetter(suppliers, "moq");

  return suppliers.map((supplier, i) => {
    const complianceScore = SASO_SCORES[supplier.sasoStatus] ?? 0;
    const paymentScore = PAYMENT_TERMS_SCORES[supplier.paymentTerms] ?? 0;

    const breakdown = {
      price: priceScores[i],
      leadTime: leadTimeScores[i],
      compliance: complianceScore,
      paymentTerms: paymentScore,
      moq: moqScores[i],
    };

    const overall = Object.entries(WEIGHTS).reduce(
      (sum, [key, weight]) => sum + breakdown[key] * weight,
      0
    );

    return {
      ...supplier,
      score: Math.round(overall),
      scoreBreakdown: breakdown,
    };
  });
}

export function rankSuppliers(suppliers, options) {
  return scoreSuppliers(suppliers, options).sort((a, b) => b.score - a.score);
}

// Labeled view of WEIGHTS for rendering a score breakdown in the UI.
export const SCORE_CRITERIA = [
  { key: "price", label: "Price", weight: WEIGHTS.price },
  { key: "leadTime", label: "Lead Time", weight: WEIGHTS.leadTime },
  { key: "compliance", label: "SASO/ISO Compliance", weight: WEIGHTS.compliance },
  { key: "paymentTerms", label: "Payment Terms", weight: WEIGHTS.paymentTerms },
  { key: "moq", label: "MOQ Fit", weight: WEIGHTS.moq },
];
