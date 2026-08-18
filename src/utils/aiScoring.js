// Client for the Cloudflare Worker AI proxy (see /worker) — the browser
// never holds an Anthropic API key, only this proxy's public URL.

export const CRITERIA_KEYS = ["price", "leadTime", "payment", "saso", "moq", "completeness"];

const REQUIRED_FIELDS = ["name", "unitPrice", "leadTime", "moq"];

function countMissingFields(supplier) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = supplier[field];
    return value === "" || value === null || value === undefined;
  }).length;
}

export function buildScoringPrompt(rfqHeader, normalizedRows) {
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

  return `You are a procurement evaluation assistant. Score these suppliers 1-10 on each criterion. Return ONLY valid JSON, no explanation.

Scoring rubric:
- Unit Price / Landed Cost SAR: 30% weight (lowest landed cost among these suppliers = 10, highest = 2, others scaled proportionally)
- Lead Time: 20% weight (under 14 days = 10, 15-21 = 8, 22-30 = 6, 31-45 = 4, 46+ days = 2)
- Payment Terms: 15% weight (Net 60+ = 10, Net 30 = 7, LC at sight = 5, 50% advance = 4, 100% upfront = 1)
- SASO / Quality Certs: 15% weight (SASO + ISO = 10, SASO only = 7, ISO only = 5, None = 1, Not stated = 3)
- MOQ Flexibility: 10% weight (MOQ under 1000 = 10, 1000-5000 = 7, 5000-10000 = 4, above 10000 = 2)
- Quote Completeness: 10% weight (all fields filled = 10, 1-2 missing = 6, 3+ missing = 2). Use missingFieldCount as the signal for this criterion.

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

export async function scoreSuppliersWithAI({ rfqHeader, normalizedRows, proxyUrl }) {
  if (!proxyUrl) {
    throw new Error("AI scoring isn't configured yet (no proxy URL set).");
  }

  const prompt = buildScoringPrompt(rfqHeader, normalizedRows);

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens: 4096 }),
  });

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
