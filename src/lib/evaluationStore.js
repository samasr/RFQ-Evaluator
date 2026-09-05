// Async facade over evaluation persistence. Logged-in users (with Supabase
// configured) read/write the `evaluations` table; everyone else falls back to
// the original localStorage layer in utils/storage.js. The shape handed back
// to the app is unchanged: { id, savedAt, rfqHeader, suppliers, weights?, assumptions? }

import { supabase, isAuthConfigured } from "./supabase";
import * as local from "../utils/storage";

const remoteFor = (user) => isAuthConfigured && Boolean(user);

function rowToEvaluation(row) {
  return {
    id: row.id,
    savedAt: new Date(row.created_at).getTime(),
    ...(row.data || {}),
  };
}

export async function listEvaluations(user) {
  if (!remoteFor(user)) return local.listEvaluations();
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, title, data, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToEvaluation);
}

export async function getEvaluation(user, id) {
  if (!remoteFor(user)) return local.getEvaluation(id);
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, title, data, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEvaluation(data) : null;
}

export async function getLatestEvaluation(user) {
  if (!remoteFor(user)) return local.getLatestEvaluation();
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, title, data, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEvaluation(data) : null;
}

export async function saveEvaluation(user, rfqHeader, suppliers) {
  if (!remoteFor(user)) return local.saveEvaluation(rfqHeader, suppliers);
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      user_id: user.id,
      title: rfqHeader?.title || null,
      data: { rfqHeader, suppliers },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Shallow-merges `patch` into the stored evaluation payload (weights,
// assumptions, …). Low volume, so a read-merge-write is fine.
async function writeEvaluationUpdate(user, id, patch) {
  if (!remoteFor(user)) return local.updateEvaluation(id, patch);
  const { data: row, error: readErr } = await supabase
    .from("evaluations")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) return;
  const merged = { ...(row.data || {}), ...patch };
  const { error } = await supabase
    .from("evaluations")
    .update({ data: merged })
    .eq("id", id);
  if (error) throw error;
}

// updateEvaluation is called on every weights/assumptions change while the
// user drags a slider on the Results page, which without debouncing fires a
// full read-merge-write per tick — wasteful, and each one is a race window
// against the others. Calls for the same evaluation id within 500ms are
// coalesced into a single write of the merged patch (last value per field
// wins, same as firing them sequentially, just without the extra round
// trips). Keyed by id so concurrent edits to different evaluations don't
// interfere with each other.
const pendingPatchByEvaluation = new Map();
const pendingTimerByEvaluation = new Map();
const DEBOUNCE_MS = 500;

export function updateEvaluation(user, id, patch) {
  return new Promise((resolve, reject) => {
    const merged = { ...(pendingPatchByEvaluation.get(id) || {}), ...patch };
    pendingPatchByEvaluation.set(id, merged);

    clearTimeout(pendingTimerByEvaluation.get(id));
    const timer = setTimeout(() => {
      const toWrite = pendingPatchByEvaluation.get(id);
      pendingPatchByEvaluation.delete(id);
      pendingTimerByEvaluation.delete(id);
      writeEvaluationUpdate(user, id, toWrite).then(resolve, reject);
    }, DEBOUNCE_MS);
    pendingTimerByEvaluation.set(id, timer);
  });
}

export async function deleteEvaluation(user, id) {
  if (!remoteFor(user)) return local.deleteEvaluation(id);
  const { error } = await supabase.from("evaluations").delete().eq("id", id);
  if (error) throw error;
}

// Evaluations created since the start of the current UTC month — drives the
// free-plan monthly cap. For local mode there's no cap, so the lifetime count
// is returned for display only.
export async function countEvaluationsThisMonth(user) {
  if (!remoteFor(user)) return local.listEvaluations().length;
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
