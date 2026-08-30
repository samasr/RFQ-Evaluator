// Weighted supplier scoring. One canonical criteria set + default weights,
// shared by the local heuristic here and the AI rubric in aiScoring.js so a
// single "Scoring Weights" control drives both. Criterion keys match
// CRITERIA_KEYS in aiScoring.js.

export const SCORING_CRITERIA = [
  { key: "price", defaultWeight: 30 },
  { key: "leadTime", defaultWeight: 20 },
  { key: "payment", defaultWeight: 15 },
  { key: "saso", defaultWeight: 15 },
  { key: "moq", defaultWeight: 10 },
  { key: "completeness", defaultWeight: 10 },
];

export const DEFAULT_WEIGHTS = Object.fromEntries(
  SCORING_CRITERIA.map((c) => [c.key, c.defaultWeight])
);

// Turns a weight map (any non-negative numbers keyed by criterion, e.g. the
// raw percentages from the UI) into fractions that sum to 1. Empty, all-zero,
// or invalid input falls back to the defaults so scoring never divides by zero.
export function normalizeWeights(weights) {
  const raw = SCORING_CRITERIA.map((c) => {
    const n = Number(weights?.[c.key]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const source = raw.some((n) => n > 0)
    ? raw
    : SCORING_CRITERIA.map((c) => c.defaultWeight);
  const total = source.reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    SCORING_CRITERIA.map((c, i) => [c.key, source[i] / total])
  );
}

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

// Fields a complete quote must carry — mirrors REQUIRED_FIELDS in aiScoring.js.
const REQUIRED_FIELDS = ["name", "unitPrice", "leadTime", "moq"];
// Score by how many required fields are missing (0, 1, 2, 3+).
const COMPLETENESS_BY_MISSING = [100, 70, 45, 20];

function completenessScore(supplier) {
  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = supplier[field];
    return value === "" || value === null || value === undefined;
  }).length;
  return COMPLETENESS_BY_MISSING[Math.min(missing, 3)];
}

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

export function scoreSuppliers(suppliers, { annualVolume, weights } = {}) {
  const priceScores = normalizeLowerIsBetter(suppliers, "unitPrice");
  const leadTimeScores = normalizeLowerIsBetter(suppliers, "leadTime");

  // With a known annual volume, score MOQ by how well it fits that volume
  // rather than just favoring the lowest MOQ in the set.
  const hasVolume = toNumber(annualVolume) !== null && toNumber(annualVolume) > 0;
  const moqScores = hasVolume
    ? suppliers.map((s) => moqFitScore(s.moq, annualVolume) ?? 0)
    : normalizeLowerIsBetter(suppliers, "moq");

  const w = normalizeWeights(weights);

  return suppliers.map((supplier, i) => {
    const breakdown = {
      price: priceScores[i],
      leadTime: leadTimeScores[i],
      payment: PAYMENT_TERMS_SCORES[supplier.paymentTerms] ?? 0,
      saso: SASO_SCORES[supplier.sasoStatus] ?? 0,
      moq: moqScores[i],
      completeness: completenessScore(supplier),
    };

    const overall = SCORING_CRITERIA.reduce(
      (sum, c) => sum + breakdown[c.key] * w[c.key],
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
