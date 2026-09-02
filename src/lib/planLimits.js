// Feature entitlements per plan. `local` is the sentinel plan used when
// Supabase auth isn't configured (or the user isn't logged in on an
// unconfigured build) — it unlocks everything so the app keeps working
// exactly as it did before Phase 7.

export const PLAN_IDS = ["free", "pro", "team"];

const FEATURES = {
  local: {
    maxSuppliers: Infinity,
    monthlyEvaluations: Infinity,
    aiScoring: true,
    decisionMemo: true,
    pdfExport: true,
    customWeights: true,
  },
  free: {
    maxSuppliers: 5,
    monthlyEvaluations: 3,
    aiScoring: false,
    decisionMemo: false,
    pdfExport: false,
    customWeights: false,
  },
  pro: {
    maxSuppliers: 10,
    monthlyEvaluations: Infinity,
    aiScoring: true,
    decisionMemo: true,
    pdfExport: true,
    customWeights: false,
  },
  team: {
    maxSuppliers: 10,
    monthlyEvaluations: Infinity,
    aiScoring: true,
    decisionMemo: true,
    pdfExport: true,
    customWeights: true,
    teamMembers: 5,
    sharedHistory: true,
  },
};

export function planFeatures(plan) {
  return FEATURES[plan] || FEATURES.free;
}

export function hasFeature(plan, feature) {
  return Boolean(planFeatures(plan)[feature]);
}

// Monthly price in SAR, for the pricing page and upgrade modal.
export const PLAN_PRICE_SAR = { free: 0, pro: 299, team: 799 };

// The minimum paid plan that unlocks a given feature — drives the upgrade
// modal's "Upgrade to X" call to action.
export function requiredPlanFor(feature) {
  if (hasFeature("pro", feature)) return "pro";
  if (hasFeature("team", feature)) return "team";
  return "pro";
}
