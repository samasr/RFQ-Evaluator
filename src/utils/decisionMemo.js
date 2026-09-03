// Client for the Cloudflare Worker AI proxy (see /worker) — turns a
// completed AI scoring result into a bilingual procurement decision memo.
//
// Claude returns structured JSON (not free-text with embedded markdown
// tables) so the UI can render real tables and keep the memo tight enough
// for a senior-leadership skim rather than a wall of prose.

import { aiProxyHeaders, throwIfUnauthorized } from "../lib/aiProxy";

function buildSupplierData(normalizedRows, aiResult) {
  const aiByName = new Map(
    (aiResult.suppliers || []).map((s) => [(s.name || "").trim().toLowerCase(), s])
  );

  return normalizedRows.map((r) => {
    const ai = aiByName.get((r.name || "").trim().toLowerCase());
    return {
      name: r.name || "Unnamed supplier",
      country: r.country,
      landedCostSAR: r.totalLanded,
      leadTimeDays: r.leadTime,
      paymentTerms: r.paymentTerms,
      sasoStatus: r.sasoStatus,
      moq: r.moq,
      deliveryTerms: r.deliveryTerms,
      aiScore: ai?.weightedTotal ?? null,
      aiRank: ai?.rank ?? null,
      redFlags: ai?.redFlags ?? [],
      recommendation: ai?.recommendation ?? "",
    };
  });
}

const MEMO_SHAPE = `{
  "subject": string ("Supplier Selection — <RFQ title>"),
  "executiveSummary": string (max 2 sentences — who was selected, why, key benefit),
  "methodology": [ { "criterion": string, "weight": string (e.g. "30%") } ] (5-6 rows, no extra commentary),
  "topSuppliers": [ { "rank": number, "supplier": string, "landedCostSAR": string, "score": string, "keyStrength": string (max 6 words) } ] (top 3 only),
  "rationale": string (max 2 sentences — why the winner beat the runner-up),
  "risks": [ { "risk": string (one short clause), "mitigation": string (one short clause) } ] (max 2 items),
  "nextSteps": [ string ] (3-4 short imperative bullets, no sub-clauses)
}`;

export function buildMemoPrompt({ rfqHeader, normalizedRows, aiResult }) {
  const supplierData = buildSupplierData(normalizedRows, aiResult);

  return `You are a senior procurement consultant writing a 1-page decision memo for a company's executive leadership. They skim, they do not read — every field must be as short as possible while staying specific (use real numbers and names, never vague filler like "various factors").

Write the memo in BOTH English and Arabic, each following this exact JSON shape:
${MEMO_SHAPE}

Return ONLY valid JSON, no explanation, no markdown fences, in this exact top-level shape:
{
  "english": ${MEMO_SHAPE},
  "arabic": ${MEMO_SHAPE} (all string values translated to Arabic; numbers stay numerals),
  "winner": string,
  "winnerScore": number,
  "keyReason": string (one short sentence, the single biggest reason the winner was chosen)
}

Context:
- RFQ title: ${rfqHeader?.title || "[RFQ Title]"}
- Memo date: ${rfqHeader?.evaluationDate || "[today's date]"}
- Product: ${rfqHeader?.product || "unspecified"}

Evaluation data: ${JSON.stringify(
    {
      aiSummary: aiResult?.summary || "",
      aiWinner: aiResult?.winner || "",
      suppliers: supplierData,
    },
    null,
    2
  )}`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidMemoSide(side) {
  return (
    side &&
    typeof side.executiveSummary === "string" &&
    Array.isArray(side.methodology) &&
    Array.isArray(side.topSuppliers) &&
    Array.isArray(side.risks) &&
    Array.isArray(side.nextSteps)
  );
}

export async function generateDecisionMemo({ rfqHeader, normalizedRows, aiResult, proxyUrl }) {
  if (!proxyUrl) {
    throw new Error("AI memo generation isn't configured yet (no proxy URL set).");
  }

  const prompt = buildMemoPrompt({ rfqHeader, normalizedRows, aiResult });

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: await aiProxyHeaders(),
    body: JSON.stringify({ prompt, maxTokens: 4096 }),
  });
  throwIfUnauthorized(response);

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Memo generation request failed (${response.status}).`);
  }

  let parsed;
  try {
    parsed = extractJson(data?.text);
  } catch {
    throw new Error("Claude's response wasn't valid JSON.");
  }

  if (!isValidMemoSide(parsed?.english) || !isValidMemoSide(parsed?.arabic)) {
    throw new Error("Unexpected response shape from Claude.");
  }

  return parsed;
}

// Flattens the structured memo into plain text for the clipboard/email
// export paths, which can't render the HTML tables the on-screen view uses.
export function formatMemoAsPlainText(memo, labels) {
  const lines = [];
  lines.push(labels.subjectPrefix ? `${labels.subjectPrefix}: ${memo.subject}` : memo.subject);
  lines.push("");
  lines.push(labels.executiveSummaryHeading);
  lines.push(memo.executiveSummary);
  lines.push("");
  lines.push(labels.methodologyHeading);
  memo.methodology.forEach((row) => lines.push(`- ${row.criterion}: ${row.weight}`));
  lines.push("");
  lines.push(labels.topSuppliersHeading);
  memo.topSuppliers.forEach((row) =>
    lines.push(
      `${row.rank}. ${row.supplier} — ${row.landedCostSAR} SAR, ${labels.scoreLabel} ${row.score} — ${row.keyStrength}`
    )
  );
  lines.push("");
  lines.push(labels.rationaleHeading);
  lines.push(memo.rationale);
  lines.push("");
  lines.push(labels.risksHeading);
  memo.risks.forEach((row) => lines.push(`- ${row.risk} → ${row.mitigation}`));
  lines.push("");
  lines.push(labels.nextStepsHeading);
  memo.nextSteps.forEach((step) => lines.push(`- ${step}`));
  return lines.join("\n");
}
