const CACHE_KEY_PREFIX = "fxRates:";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function readCache(baseCurrency) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + baseCurrency);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(baseCurrency, rates, fetchedAt) {
  try {
    sessionStorage.setItem(
      CACHE_KEY_PREFIX + baseCurrency,
      JSON.stringify({ rates, fetchedAt })
    );
  } catch {
    // Ignore storage errors (e.g. private browsing / quota).
  }
}

// Free, no-API-key exchange rate service. Rates are base -> currency
// (e.g. baseCurrency "SAR" gives rates.USD = USD per 1 SAR).
export async function fetchExchangeRates(baseCurrency) {
  const cached = readCache(baseCurrency);
  if (cached) return cached;

  const response = await fetch(
    `https://open.er-api.com/v6/latest/${baseCurrency}`
  );
  if (!response.ok) {
    throw new Error(`Exchange rate API responded with ${response.status}`);
  }

  const data = await response.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("Exchange rate API returned an unexpected response");
  }

  const fetchedAt = Date.now();
  writeCache(baseCurrency, data.rates, fetchedAt);
  return { rates: data.rates, fetchedAt };
}

// Converts `amount` quoted in `fromCurrency` into `baseCurrency` using
// base->currency rates. Returns null if the amount or rate is unavailable.
export function convertToBase(amount, fromCurrency, baseCurrency, rates) {
  if (amount === null || amount === undefined || amount === "") return null;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  if (fromCurrency === baseCurrency) return numeric;

  const rate = rates?.[fromCurrency];
  if (!rate) return null;
  return numeric / rate;
}
