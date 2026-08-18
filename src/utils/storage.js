const STORAGE_KEY = "rfqEvaluations";
const LEGACY_KEY = "rfqEvaluation";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(evaluations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluations));
}

// One-time upgrade from the old single-evaluation key so evaluations saved
// before history tracking existed still show up.
function migrateLegacyEvaluation() {
  const existing = readAll();
  if (existing.length > 0) return existing;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return existing;
    const legacy = JSON.parse(raw);
    if (!legacy?.rfqHeader) return existing;

    const migrated = [
      {
        id: crypto.randomUUID(),
        savedAt: Date.now(),
        rfqHeader: legacy.rfqHeader,
        suppliers: legacy.suppliers ?? [],
      },
    ];
    writeAll(migrated);
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return existing;
  }
}

// Newest first.
export function listEvaluations() {
  return migrateLegacyEvaluation().sort((a, b) => b.savedAt - a.savedAt);
}

export function getEvaluation(id) {
  return listEvaluations().find((e) => e.id === id) ?? null;
}

export function getLatestEvaluation() {
  return listEvaluations()[0] ?? null;
}

export function saveEvaluation(rfqHeader, suppliers) {
  const evaluations = migrateLegacyEvaluation();
  const entry = {
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    rfqHeader,
    suppliers,
  };
  writeAll([...evaluations, entry]);
  return entry.id;
}

export function deleteEvaluation(id) {
  writeAll(migrateLegacyEvaluation().filter((e) => e.id !== id));
}
