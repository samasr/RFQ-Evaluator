// Client for the Cloudflare Worker AI proxy (see /worker) — turns a
// completed AI scoring result into a bilingual procurement decision memo.

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

export function buildMemoPrompt({ rfqHeader, normalizedRows, aiResult }) {
  const supplierData = buildSupplierData(normalizedRows, aiResult);

  return `You are a senior procurement consultant writing a formal decision memo for management review at a Saudi company.

Write a professional 1-page decision memo in BOTH English and Arabic.

Structure the memo exactly like this:

ENGLISH VERSION:
- Header: PROCUREMENT DECISION MEMO
- To: Procurement Director
- From: Procurement Planning Team
- Date: ${rfqHeader?.evaluationDate || "[today's date]"}
- Subject: Supplier Selection — ${rfqHeader?.title || "[RFQ Title]"}

1. EXECUTIVE SUMMARY (2-3 sentences)
   Who was selected, why, and the key benefit

2. EVALUATION METHODOLOGY
   Criteria used and weights (table format)

3. TOP 3 SUPPLIERS COMPARISON (table)
   Rank | Supplier | Landed Cost SAR | Score | Key Strength

4. SELECTION RATIONALE
   Why the winner was chosen over the runner-up (3-4 sentences)

5. RISKS & MITIGATION
   2-3 bullet points of risks and how to handle them

6. RECOMMENDED NEXT STEPS
   - Notify selected supplier within 2 working days
   - Request SASO certificate verification
   - Issue PO after payment terms confirmation
   - Schedule quality inspection before first delivery

ARABIC VERSION:
Full translation of the above memo in Arabic (RTL)

Return ONLY valid JSON, no explanation, no markdown fences, in this exact shape:
{
  "english": string (full memo in English, use \\n for line breaks),
  "arabic": string (full memo in Arabic, use \\n for line breaks),
  "winner": string,
  "winnerScore": number,
  "keyReason": string (one sentence)
}

Evaluation data: ${JSON.stringify(
    {
      rfqHeader: {
        title: rfqHeader?.title || "",
        product: rfqHeader?.product || "",
        annualVolume: rfqHeader?.annualVolume || "",
        baseCurrency: rfqHeader?.baseCurrency || "SAR",
        evaluationDate: rfqHeader?.evaluationDate || "",
      },
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

export async function generateDecisionMemo({ rfqHeader, normalizedRows, aiResult, proxyUrl }) {
  if (!proxyUrl) {
    throw new Error("AI memo generation isn't configured yet (no proxy URL set).");
  }

  const prompt = buildMemoPrompt({ rfqHeader, normalizedRows, aiResult });

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens: 8192 }),
  });

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

  if (!parsed || typeof parsed.english !== "string" || typeof parsed.arabic !== "string") {
    throw new Error("Unexpected response shape from Claude.");
  }

  return parsed;
}
