// Client for the Cloudflare Worker AI proxy (see /worker) — turns the
// entered/extracted supplier quotes into a per-supplier list of clarification
// questions the buyer can send back to each supplier before awarding.

function buildSupplierData(normalizedRows, aiResult) {
  const aiByName = new Map(
    (aiResult?.suppliers || []).map((s) => [
      (s.name || "").trim().toLowerCase(),
      s,
    ])
  );

  return normalizedRows.map((r) => {
    const ai = aiByName.get((r.name || "").trim().toLowerCase());
    const blankToNull = (v) => (v === "" || v === undefined ? null : v);
    return {
      name: r.name || "Unnamed supplier",
      country: r.country,
      currency: r.currency,
      unitPrice: blankToNull(r.unitPrice),
      landedCostSAR: r.totalLanded,
      leadTimeDays: blankToNull(r.leadTime),
      paymentTerms: r.paymentTerms,
      sasoStatus: r.sasoStatus,
      moq: blankToNull(r.moq),
      deliveryTerms: r.deliveryTerms,
      portCity: r.portCity || null,
      notes: r.notes || null,
      aiRedFlags: ai?.redFlags ?? [],
    };
  });
}

export function buildClarificationPrompt({ rfqHeader, normalizedRows, aiResult }) {
  const suppliers = buildSupplierData(normalizedRows, aiResult);

  return `You are a procurement analyst preparing clarification questions for suppliers who submitted quotes for an RFQ. For each supplier, produce the specific questions a buyer must resolve before that quote can be fairly compared or awarded.

Focus on:
- Missing or blank fields (price, lead time, MOQ, payment terms, certifications, delivery terms).
- Ambiguous or non-standard terms that need pinning down (vague Incoterms, "approx" lead times, payment terms that don't match a standard option, unclear currency).
- Anything in "notes" or "aiRedFlags" a buyer should challenge or verify (e.g. missing SASO for a regulated product, freight excluded, price validity, hidden costs).
- Commercial gaps: price validity period, what is included/excluded (freight, duties, VAT, packaging), warranty, sample availability, capacity to meet the annual volume.

Rules:
- 2 to 6 questions per supplier. Fewer when the quote is complete; more only if genuinely warranted.
- Each "question" is ONE clear sentence, written to send directly to the supplier — polite, specific, and answerable.
- Each "rationale" is a short internal note (NOT sent to the supplier) saying why it matters for the evaluation.
- If a supplier's quote is complete and unambiguous, return an empty "questions" array for them — never invent filler.
- Return ONLY valid JSON, no explanation, no markdown fences.

Shape:
{
  "suppliers": [
    { "name": string, "questions": [ { "topic": string (2-4 words), "question": string, "rationale": string } ] }
  ]
}
Return one entry per supplier below, in the same order, using the exact "name" given.

RFQ context: product "${rfqHeader?.product || "unspecified"}", title "${rfqHeader?.title || "untitled"}", estimated annual volume ${rfqHeader?.annualVolume || "unspecified"}.

Suppliers:
${JSON.stringify(suppliers, null, 2)}`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function generateClarificationQuestions({
  rfqHeader,
  normalizedRows,
  aiResult,
  proxyUrl,
}) {
  if (!proxyUrl) {
    throw new Error("AI isn't configured yet (no proxy URL set).");
  }

  const prompt = buildClarificationPrompt({ rfqHeader, normalizedRows, aiResult });

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens: 3072 }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status}).`);
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

  return parsed.suppliers.map((s) => ({
    name: s.name || "",
    questions: Array.isArray(s.questions) ? s.questions : [],
  }));
}

// Plain-text list of just the questions for one supplier, ready to paste into
// an email. The internal rationale is deliberately omitted.
export function formatSupplierQuestionsAsText(supplier, intro) {
  const lines = [];
  if (intro) {
    lines.push(intro.replace("{supplier}", supplier.name));
    lines.push("");
  }
  supplier.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`));
  return lines.join("\n");
}
