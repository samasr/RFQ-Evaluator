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

export function buildExtractionPrompt(rfqHeader) {
  return `You are a procurement data-extraction assistant. Below is a supplier's price quotation (document or pasted text). Extract the following fields and return ONLY valid JSON, no explanation, no markdown fences.

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
  "notes": string
}

Rules:
- If a field is not stated in the document, use "Not stated" for sasoStatus, "" for portCity, null for numeric fields, and the closest option from the allowed lists for other enum fields — never invent a value outside the given lists.
- Do not guess numeric prices, lead times, or MOQ if they are not present — use null and mention it in "notes".
- "leadTime" is in days — convert ranges (e.g. "45-60 days") to their midpoint and note the original range in "notes".
- Use "notes" for any red flags, unusual terms, or fields you had to estimate or could not map to the allowed lists.

RFQ context: product "${rfqHeader?.product || "unspecified"}".`;
}

function extractJson(text) {
  const trimmed = (text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

// Maps Claude's raw extraction onto our fixed option lists, falling back to
// a sensible default (and a note) when the model's answer doesn't exactly
// match — real documents are messy, so this never throws on a near-miss.
export function normalizeExtractedSupplier(raw) {
  const notes = [];
  if (raw.notes) notes.push(raw.notes);

  const country = matchEnum(raw.country, COUNTRIES);
  if (!country && raw.country) notes.push(`Country as quoted: "${raw.country}".`);

  const currency = matchEnum(raw.currency, CURRENCIES);
  if (!currency && raw.currency) notes.push(`Currency as quoted: "${raw.currency}".`);

  const paymentTerms = matchEnum(raw.paymentTerms, PAYMENT_TERMS);
  if (!paymentTerms && raw.paymentTerms)
    notes.push(`Payment terms as quoted: "${raw.paymentTerms}".`);

  const sasoStatus = matchEnum(raw.sasoStatus, SASO_STATUSES);

  const deliveryTerms = matchEnum(raw.deliveryTerms, DELIVERY_TERMS);
  if (!deliveryTerms && raw.deliveryTerms)
    notes.push(`Delivery terms as quoted: "${raw.deliveryTerms}".`);

  return {
    id: crypto.randomUUID(),
    name: raw.name || "",
    country: country || "Other",
    currency: currency || "SAR",
    unitPrice: toFieldString(raw.unitPrice),
    leadTime: toFieldString(raw.leadTime),
    paymentTerms: paymentTerms || "100% upfront",
    moq: toFieldString(raw.moq),
    sasoStatus: sasoStatus || "Not stated",
    deliveryTerms: deliveryTerms || "DDP",
    portCity: raw.portCity || "",
    notes: notes.join(" "),
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
