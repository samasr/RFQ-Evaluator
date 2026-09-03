// Client for the Cloudflare Worker AI proxy (see /worker) — the browser
// never holds an Anthropic API key, only this proxy's public URL.

import { SCORING_CRITERIA, normalizeWeights } from "./scoring";
import { aiProxyHeaders, assertProxyResponseOk } from "../lib/aiProxy";

export const CRITERIA_KEYS = ["price", "leadTime", "payment", "saso", "moq", "completeness"];

const REQUIRED_FIELDS = ["name", "unitPrice", "leadTime", "moq"];

// The rubric wording for each criterion; the "{weight}% weight" prefix is
// filled in from the caller's weights so the AI scores on the same emphasis
// the user set in the Scoring Weights panel.
const RUBRIC_TEXT = {
  price:
    "Unit Price / Landed Cost SAR: {weight}% weight (lowest landed cost among these suppliers = 10, highest = 2, others scaled proportionally)",
  leadTime:
    "Lead Time: {weight}% weight (under 14 days = 10, 15-21 = 8, 22-30 = 6, 31-45 = 4, 46+ days = 2)",
  payment:
    "Payment Terms: {weight}% weight (Net 60+ = 10, Net 30 = 7, LC at sight = 5, 50% advance = 4, 100% upfront = 1)",
  saso:
    "SASO / Quality Certs: {weight}% weight (SASO + ISO = 10, SASO only = 7, ISO only = 5, None = 1, Not stated = 3)",
  moq:
    "MOQ Flexibility: {weight}% weight (MOQ under 1000 = 10, 1000-5000 = 7, 5000-10000 = 4, above 10000 = 2)",
  completeness:
    "Quote Completeness: {weight}% weight (all fields filled = 10, 1-2 missing = 6, 3+ missing = 2). Use missingFieldCount as the signal for this criterion.",
};

function countMissingFields(supplier) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = supplier[field];
    return value === "" || value === null || value === undefined;
  }).length;
}

// Integer percentages per criterion that always sum to exactly 100 (largest
// remainder), for readable weights in the rubric prompt.
function toPercentMap(weights) {
  const w = normalizeWeights(weights);
  const parts = SCORING_CRITERIA.map((c) => {
    const exact = w[c.key] * 100;
    const floor = Math.floor(exact);
    return { key: c.key, p: floor, rem: exact - floor };
  });
  let deficit = 100 - parts.reduce((sum, e) => sum + e.p, 0);
  [...parts]
    .sort((a, b) => b.rem - a.rem)
    .slice(0, Math.max(0, deficit))
    .forEach((e) => {
      e.p += 1;
    });
  return Object.fromEntries(parts.map((e) => [e.key, e.p]));
}

export function buildScoringPrompt(rfqHeader, normalizedRows, weights) {
  const supplierData = normalizedRows.map((r) => ({
    name: r.name || "Unnamed supplier",
    landedCostSAR: r.totalLanded,
    originalPrice: r.unitPrice,
    originalCurrency: r.currency,
    leadTimeDays: r.leadTime,
    paymentTerms: r.paymentTerms,
    sasoStatus: r.sasoStatus,
    moq: r.moq,
    deliveryTerms: r.deliveryTerms,
    missingFieldCount: countMissingFields(r),
  }));

  const percents = toPercentMap(weights);
  const rubric = SCORING_CRITERIA.map(
    (c) => `- ${RUBRIC_TEXT[c.key].replace("{weight}", percents[c.key])}`
  ).join("\n");

  return `You are a procurement evaluation assistant. Score these suppliers 1-10 on each criterion. Return ONLY valid JSON, no explanation.

Scoring rubric:
${rubric}

Format:
{
  "suppliers": [
    {
      "name": string,
      "scores": { "price": number, "leadTime": number, "payment": number, "saso": number, "moq": number, "completeness": number },
      "weightedTotal": number,
      "rank": number,
      "redFlags": string[],
      "recommendation": string
    }
  ],
  "winner": string,
  "summary": string
}

Return exactly one entry in "suppliers" for every supplier below, in the same order, using the exact "name" given. "weightedTotal" is 0-10, computed from the weighted scores above. "winner" must exactly match the name of the top-ranked supplier. "summary" is 2-3 sentences.

Supplier data:
${JSON.stringify(supplierData, null, 2)}

RFQ context: product "${rfqHeader?.product || "unspecified"}", estimated annual volume ${rfqHeader?.annualVolume || "unspecified"}.`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function scoreSuppliersWithAI({ rfqHeader, normalizedRows, weights, proxyUrl }) {
  if (!proxyUrl) {
    throw new Error("AI scoring isn't configured yet (no proxy URL set).");
  }

  const prompt = buildScoringPrompt(rfqHeader, normalizedRows, weights);

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: await aiProxyHeaders(),
    body: JSON.stringify({ prompt, maxTokens: 4096, feature: "aiScoring" }),
  });
  await assertProxyResponseOk(response);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `AI scoring request failed (${response.status}).`);
  }

  let parsed;
  try {
    parsed = extractJson(data?.text);
  } catch {
    throw new Error("Claude's response wasn't valid JSON.");
  }

  if (!parsed || !Array.isArray(parsed.suppliers)) {
    throw new Error("Unexpected response shape from Claude.");
  }

  return parsed;
}
