import { SalesTargetIncentiveApiService } from "./sales-target-incentive-api.service";
import type { SalesTargetIncentiveParticipantProjection } from "./sales-target-incentive-read-model.service";
import type { SalesTargetIncentiveAdjustmentSummaryRow } from "../infrastructure/sales-target-incentive-correction.repository";
import { definedParticipationReviewInput, effectiveParticipationAmount } from "./sales-target-incentive-participation-adapter";

const workflow = { regionWorkflow: null, reviewsByStoreId: new Map(), correctionsByRowKey: new Map() };
const participant: SalesTargetIncentiveParticipantProjection = {
  employeeId: "employee", displayName: "Person", participantType: "personnel", positionCode: "SALES_ASSOCIATE",
  normalizedFromPositionCode: null, targetAmount: "1000", actualAmount: "1100",
  userId: null, assignmentId: null, assignmentStartedOn: null, assignmentEndedOn: null, positionId: null, targetReferenceId: null,
  source: { storeTargetRequestId: null, storeNetSalesSourceBatchId: null, storeNetSalesImportBatchId: null,
    personnelSalesSourceBatchId: null, personnelSalesImportBatchId: null },
  calculation: { status: "projected", payableAmount: "110.00", rawEarnedAmount: "110.000000", rate: "0.0100",
    achievementPct: "110.00", storeAchievementPct: "110.00", storeGatePassed: true, blockedReason: null,
    rateTableVersion: "personnel-sales-target-v1.0.0", ruleVersionCode: "sales-target-incentive-v1.0.0",
    excludedReason: null, positionCode: "SALES_ASSOCIATE", normalizedFromPositionCode: null, personalRateBeforeGate: "0.0100" },
};
const summary: SalesTargetIncentiveAdjustmentSummaryRow = {
  store_id: "store", employee_id: "employee", participant_type: "personnel", final_snapshot_id: "snapshot",
  correction_amount: "0", adjustment_amount: "15.00", final_amount: "120.00", payable_amount: "110.00", raw_earned_amount: "110.000000",
  participation: { included: false, reasonNote: "Excluded", revisionNo: 3, finalSnapshotId: "snapshot", source: "draft" },
};

describe("legacy financial participation adapter", () => {
  const service = new SalesTargetIncentiveApiService({} as never, {} as never, {} as never, {} as never, {} as never);
  it("zeros effective money without changing the calculated or approved correction amounts", () => {
    const row = service["toApiRow"]("store", participant, summary, workflow);
    expect(row).toMatchObject({ finalAmount: "0.00", calculatedFinalAmount: "135.00", payableAmount: "110.00",
      rawEarnedAmount: "110.000000", adjustmentAmount: "15.00", participation: summary.participation });
    expect(summary.final_amount).toBe("120.00");
  });
  it("also overlays historical final-only people without erasing the source money", () => {
    expect(service["toFinalOnlyApiRow"](summary, workflow)).toMatchObject({ finalAmount: "0.00", calculatedFinalAmount: "135.00" });
  });
  it("does not replace legacy own/store projection calculations for participation-only summary rows", () => {
    const row = service["toApiRow"]("store", participant, { ...summary, participation_only: true }, workflow);
    expect(row).toMatchObject({ finalAmount: "0.00", calculatedFinalAmount: null, payableAmount: "110.00", adjustmentAmount: null });
  });
  it("preserves null calculations for included targetless people and gives exclusions explicit zero", () => {
    expect(effectiveParticipationAmount(null, undefined)).toEqual({ finalAmount: null, calculatedFinalAmount: null });
    expect(effectiveParticipationAmount(null, summary.participation).finalAmount).toBe("0.00");
  });
  it("retains old no-exclusion money and zero-net approved adjustment money", () => {
    expect(service["toApiRow"]("store", participant, { ...summary, participation: undefined }, workflow).finalAmount).toBe("135.00");
    expect(service["toApiRow"]("store", participant, { ...summary, adjustment_amount: "-120.00", participation: undefined }, workflow).finalAmount).toBe("0.00");
  });
  it("passes review source/revision only when explicitly provided, preserving legacy input shape", () => {
    expect(definedParticipationReviewInput({ storeId: "store", expectedSnapshotId: undefined, expectedParticipationRevision: undefined }))
      .toEqual({ storeId: "store" });
    expect(definedParticipationReviewInput({ storeId: "store", expectedSnapshotId: "snapshot", expectedParticipationRevision: 0 }))
      .toEqual({ storeId: "store", expectedSnapshotId: "snapshot", expectedParticipationRevision: 0 });
  });
});
