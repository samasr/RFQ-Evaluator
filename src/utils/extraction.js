// Extracts one supplier's structured quote data from an uploaded PDF/image
// via the same Cloudflare Worker proxy used by aiScoring.js.

import {
  COUNTRIES,
  CURRENCIES,
  PAYMENT_TERMS,
  SASO_STATUSES,
  DELIVERY_TERMS,
} from "../components/SupplierRow";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

function matchEnum(value, options) {
  if (!value) return null;
  return (
    options.find((o) => o.toLowerCase() === String(value).trim().toLowerCase()) || null
  );
}

function toFieldString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildExtractionPrompt(rfqHeader) {
  return `You are a procurement data-extraction assistant. Below is a supplier's price quotation (document or image). Extract the following fields and return ONLY valid JSON, no explanation, no markdown fences.

Format:
{
  "name": string,
  "country": one of ["Saudi Arabia","UAE","China","Egypt","India","Other"],
  "currency": one of ["SAR","USD","CNY","EUR"],
  "unitPrice": number or null,
  "leadTime": number or null,
  "paymentTerms": one of ["100% upfront","50% advance","Net 30","Net 60","LC at sight"],
  "moq": number or null,
  "sasoStatus": one of ["SASO + ISO","SASO only","ISO only","None","Not stated"],
  "deliveryTerms": one of ["DDP","DAP","CIF","FOB","EXW","CFR"],
  "portCity": string,
  "freightCost": number or null,
  "notes": string
}

Rules:
- If a field is not stated in the document, use null for the numeric fields (unitPrice, leadTime, moq, freightCost), "Not stated" for sasoStatus, "" for portCity, and the closest option from the allowed lists for the other enum fields — never invent a value outside the given lists.
- Detect "currency" from the document (symbols, ISO codes, or the supplier's country).
- Do not guess numeric prices, lead times, MOQ, or freight if they are not present — use null and mention it in "notes".
- "leadTime" is in days — convert ranges (e.g. "45-60 days") to their midpoint and note the original range in "notes".
- "freightCost" is any separately-stated shipping / freight charge, in the quote's currency; use null if freight is bundled into the unit price or not mentioned.
- For "sasoStatus", look for any mention of SASO, ISO, CE, or other quality certificates.
- Use "notes" for special conditions, red flags, unusual terms, or fields you had to estimate or could not map to the allowed lists.

RFQ context: product "${rfqHeader?.product || "unspecified"}".`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

// Maps Claude's raw extraction onto our fixed option lists, falling back to a
// sensible default (and a note) when the model's answer doesn't exactly match
// — real documents are messy, so this never throws on a near-miss.
//
// Returns the row-shaped `supplier` plus `filledFields`: the row columns the
// document actually supplied a value for, so the UI can highlight the cells
// that were auto-filled and leave the rest for the user to complete.
export function normalizeExtractedSupplier(raw) {
  const notes = [];
  if (raw.notes) notes.push(String(raw.notes));
  const filled = new Set();

  if (raw.name && String(raw.name).trim()) filled.add("name");

  const country = matchEnum(raw.country, COUNTRIES);
  if (raw.country) {
    filled.add("country");
    if (!country) notes.push(`Country as quoted: "${raw.country}".`);
  }

  const currency = matchEnum(raw.currency, CURRENCIES);
  if (raw.currency) {
    filled.add("currency");
    if (!currency) notes.push(`Currency as quoted: "${raw.currency}".`);
  }

  const paymentTerms = matchEnum(raw.paymentTerms, PAYMENT_TERMS);
  if (raw.paymentTerms) {
    filled.add("paymentTerms");
    if (!paymentTerms) notes.push(`Payment terms as quoted: "${raw.paymentTerms}".`);
  }

  const sasoStatus = matchEnum(raw.sasoStatus, SASO_STATUSES);
  if (raw.sasoStatus && sasoStatus && sasoStatus !== "Not stated") {
    filled.add("sasoStatus");
  }

  const deliveryTerms = matchEnum(raw.deliveryTerms, DELIVERY_TERMS);
  if (raw.deliveryTerms) {
    filled.add("deliveryTerms");
    if (!deliveryTerms) notes.push(`Delivery terms as quoted: "${raw.deliveryTerms}".`);
  }

  const unitPrice = toFiniteNumber(raw.unitPrice);
  if (unitPrice !== null) filled.add("unitPrice");

  const leadTime = toFiniteNumber(raw.leadTime);
  if (leadTime !== null) filled.add("leadTime");

  const moq = toFiniteNumber(raw.moq);
  if (moq !== null) filled.add("moq");

  const freightCost = toFiniteNumber(raw.freightCost);
  if (freightCost !== null) {
    const unit = currency || raw.currency || "";
    notes.push(`Freight cost stated in quote: ${freightCost} ${unit}`.trim() + ".");
  }

  if (raw.portCity && String(raw.portCity).trim()) filled.add("portCity");

  const noteText = notes.join(" ").trim();
  if (noteText) filled.add("notes");

  return {
    supplier: {
      id: crypto.randomUUID(),
      name: raw.name || "",
      country: country || "Other",
      currency: currency || "SAR",
      unitPrice: toFieldString(unitPrice),
      leadTime: toFieldString(leadTime),
      paymentTerms: paymentTerms || "100% upfront",
      moq: toFieldString(moq),
      sasoStatus: sasoStatus || "Not stated",
      deliveryTerms: deliveryTerms || "DDP",
      portCity: raw.portCity || "",
      notes: noteText,
    },
    filledFields: [...filled],
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function isSupportedQuoteFile(file) {
  return file.type === "application/pdf" || file.type.startsWith("image/");
}

// Resolves to { supplier, filledFields }. Throws with a user-facing message
// on any failure so callers can show it and fall back to manual entry.
export async function extractSupplierFromFile({ file, rfqHeader, proxyUrl }) {
  if (!proxyUrl) {
    throw new Error("AI extraction isn't configured yet (no proxy URL set).");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 8MB).");
  }
  if (!isSupportedQuoteFile(file)) {
    throw new Error("Only PDF and image files are supported.");
  }

  const data = await fileToBase64(file);
  const prompt = buildExtractionPrompt(rfqHeader);

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      documents: [{ mediaType: file.type, data }],
      maxTokens: 1024,
    }),
  });

  const responseData = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(responseData?.error || `Extraction failed (${response.status}).`);
  }

  let parsed;
  try {
    parsed = extractJson(responseData?.text);
  } catch {
    throw new Error("Claude's response wasn't valid JSON.");
  }

  return normalizeExtractedSupplier(parsed);
}
