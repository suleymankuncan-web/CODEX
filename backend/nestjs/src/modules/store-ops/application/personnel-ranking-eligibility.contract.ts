export const officialPersonnelRankingMinimumNetSalesValue = 50_000;
export const officialPersonnelRankingMinimumStoreSalesShare = 0.02;

export type PersonnelRankingEligibilityReason =
  | "eligible"
  | "store_manager_excluded"
  | "missing_net_sales"
  | "below_minimum_net_sales"
  | "missing_store_sales"
  | "below_minimum_store_share";

export type PersonnelRankingEligibilityResult = {
  isEligible: boolean;
  reason: PersonnelRankingEligibilityReason;
  netSalesValue: number | null;
  storeNetSalesValue: number | null;
  storeSalesShare: number | null;
};

export function resolvePersonnelRankingEligibility(input: {
  positionCode?: string | null;
  netSalesValue?: number | null;
  storeNetSalesValue?: number | null;
}): PersonnelRankingEligibilityResult {
  const normalizedPositionCode = input.positionCode?.trim().toUpperCase() ?? null;
  const netSalesValue = toFiniteNumberOrNull(input.netSalesValue);
  const storeNetSalesValue = toFiniteNumberOrNull(input.storeNetSalesValue);

  if (normalizedPositionCode === "STORE_MANAGER") {
    return {
      isEligible: false,
      reason: "store_manager_excluded",
      netSalesValue,
      storeNetSalesValue,
      storeSalesShare: null,
    };
  }

  if (netSalesValue === null) {
    return {
      isEligible: false,
      reason: "missing_net_sales",
      netSalesValue: null,
      storeNetSalesValue,
      storeSalesShare: null,
    };
  }

  if (netSalesValue < officialPersonnelRankingMinimumNetSalesValue) {
    return {
      isEligible: false,
      reason: "below_minimum_net_sales",
      netSalesValue,
      storeNetSalesValue,
      storeSalesShare: null,
    };
  }

  if (storeNetSalesValue === null || storeNetSalesValue <= 0) {
    return {
      isEligible: false,
      reason: "missing_store_sales",
      netSalesValue,
      storeNetSalesValue,
      storeSalesShare: null,
    };
  }

  const storeSalesShare = netSalesValue / storeNetSalesValue;

  if (storeSalesShare < officialPersonnelRankingMinimumStoreSalesShare) {
    return {
      isEligible: false,
      reason: "below_minimum_store_share",
      netSalesValue,
      storeNetSalesValue,
      storeSalesShare,
    };
  }

  return {
    isEligible: true,
    reason: "eligible",
    netSalesValue,
    storeNetSalesValue,
    storeSalesShare,
  };
}

function toFiniteNumberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
