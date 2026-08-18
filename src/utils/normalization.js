// Landed-cost normalization: converts every supplier's quoted price to a
// SAR, DDP-Riyadh landed cost (currency conversion + freight + customs) so
// quotes with different Incoterms and currencies can be compared like-for-like.

export const DEFAULT_ASSUMPTIONS = {
  fxUSD: 3.75,
  fxCNY: 0.52,
  fxEUR: 4.1,
  customsPct: 5,
  vatPct: 15,
  freightJeddah: 0.3, // CIF Jeddah -> Riyadh land freight
  freightDammam: 0.45, // CFR Dammam -> Riyadh land freight
};

function fxRates(assumptions) {
  return { SAR: 1, USD: assumptions.fxUSD, CNY: assumptions.fxCNY, EUR: assumptions.fxEUR };
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Freight is keyed by Incoterm + (for FOB/EXW) the origin port/city, since
// "FOB Shenzhen" and "FOB Ningbo" carry different estimated freight. The
// optional `portCity` field lets suppliers be precise; unrecognized or
// missing ports fall back to the "other" rate for that Incoterm.
function resolveFreight(supplier, assumptions) {
  const term = supplier.deliveryTerms;
  const country = supplier.country;
  const port = (supplier.portCity || "").trim().toLowerCase();

  switch (term) {
    case "DDP":
      return 0;
    case "DAP":
      return 0.18;
    case "CIF":
      return assumptions.freightJeddah;
    case "CFR":
      return assumptions.freightDammam;
    case "FOB":
      if (country === "China") {
        if (port.includes("shenzhen")) return 1.4;
        if (port.includes("ningbo")) return 1.5;
      }
      return 1.2;
    case "EXW":
      if (country === "Saudi Arabia") {
        return port.includes("jeddah") ? 0.5 : 0.3;
      }
      // Not specified for non-Saudi EXW suppliers; use the general "FOB
      // other" estimate as a stand-in until a rate is defined for this case.
      return 1.2;
    default:
      return 1.2;
  }
}

function resolveCustoms(supplier, sarEquivalent, assumptions) {
  if (sarEquivalent === null) return null;
  if (supplier.deliveryTerms === "DDP") return 0;
  if (supplier.country === "Saudi Arabia") return 0;
  return sarEquivalent * (assumptions.customsPct / 100);
}

// Saudi VAT (15% standard rate) applies to the delivered value regardless of
// Incoterm or supplier origin — unlike customs duty, it isn't limited to
// non-Saudi/non-DDP suppliers. Charged on goods + freight + customs.
function resolveVat(sarEquivalent, freight, customs, assumptions) {
  if (sarEquivalent === null || customs === null) return null;
  return (sarEquivalent + freight + customs) * (assumptions.vatPct / 100);
}

// Returns suppliers augmented with normalization figures, sorted by total
// landed cost ascending (nulls, i.e. missing/invalid price, sort last).
export function normalizeSuppliers(suppliers, assumptions) {
  const rates = fxRates(assumptions);

  const rows = suppliers.map((supplier) => {
    const price = toNumber(supplier.unitPrice);
    const rate = rates[supplier.currency] ?? null;
    const sarEquivalent = price !== null && rate !== null ? price * rate : null;
    const freight = resolveFreight(supplier, assumptions);
    const customs = resolveCustoms(supplier, sarEquivalent, assumptions);
    const vat = resolveVat(sarEquivalent, freight, customs, assumptions);
    const totalLanded =
      sarEquivalent !== null && customs !== null && vat !== null
        ? sarEquivalent + freight + customs + vat
        : null;

    return { ...supplier, sarEquivalent, freight, customs, vat, totalLanded };
  });

  return rows.sort((a, b) => {
    if (a.totalLanded === null && b.totalLanded === null) return 0;
    if (a.totalLanded === null) return 1;
    if (b.totalLanded === null) return -1;
    return a.totalLanded - b.totalLanded;
  });
}
