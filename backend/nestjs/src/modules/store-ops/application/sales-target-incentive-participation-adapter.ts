import type { SalesTargetIncentiveAdjustmentSummaryRow } from "../infrastructure/sales-target-incentive-correction.repository";

export function effectiveParticipationAmount(calculatedFinalAmount: string | null, participation: SalesTargetIncentiveAdjustmentSummaryRow["participation"]) {
  return {
    finalAmount: participation?.included === false ? "0.00" : calculatedFinalAmount,
    calculatedFinalAmount,
    ...(participation ? { participation } : {}),
  };
}

export function definedParticipationReviewInput<T extends { expectedParticipationRevision?: number; expectedSnapshotId?: string }>(input: T) {
  const { expectedParticipationRevision, expectedSnapshotId, ...review } = input;
  return {
    ...review,
    ...(expectedParticipationRevision !== undefined ? { expectedParticipationRevision } : {}),
    ...(expectedSnapshotId !== undefined ? { expectedSnapshotId } : {}),
  };
}
