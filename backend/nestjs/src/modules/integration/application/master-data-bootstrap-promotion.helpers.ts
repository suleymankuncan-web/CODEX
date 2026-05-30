import { BadRequestException } from "@nestjs/common";
import {
  type BootstrapBatch,
  type BootstrapStagedRow,
} from "../infrastructure/master-data-bootstrap.repository";
import { readNormalizedString } from "./master-data-bootstrap-normalization.helpers";

export type BootstrapPromotionReadiness =
  | "needs_validation"
  | "needs_review"
  | "blocked"
  | "waiting_batch"
  | "ready"
  | "already_promoted";

export type BootstrapPromotionNextAction =
  | "validate_batch"
  | "review_rows"
  | "promote_ready_rows"
  | "already_closed"
  | "wait_for_batch_ready";

export function buildBootstrapPromotionReadinessItem(
  batch: BootstrapBatch,
  row: BootstrapStagedRow,
) {
  const { promotionReadiness, blockReason } = classifyBootstrapPromotionRow(
    batch,
    row,
  );

  return {
    rowId: row.rowId,
    rowNumber: row.rowNumber,
    validationStatus: row.validationStatus,
    issueCode: row.issueCode,
    issueMessage: row.issueMessage,
    promotionReadiness,
    blockReason,
    resolvedStoreId: row.resolvedStoreId,
    resolvedEmployeeId: row.resolvedEmployeeId,
    resolvedPositionId: row.resolvedPositionId,
    promotedEntityId: row.promotedEntityId,
  };
}

export function assertBootstrapPromotionRowsArePromotable(
  entityLabel: "Store" | "Personnel",
  rows: Array<{
    row: BootstrapStagedRow;
    promotionReadiness: BootstrapPromotionReadiness;
    blockReason: string | null;
  }>,
) {
  const blockedRow = rows.find(
    (item) =>
      item.promotionReadiness !== "ready" &&
      item.promotionReadiness !== "already_promoted",
  );

  if (!blockedRow) {
    return;
  }

  const reason = blockedRow.blockReason
    ? ` (${blockedRow.blockReason})`
    : "";

  throw new BadRequestException(
    `${entityLabel} bootstrap batch has non-promotable rows; review promotion readiness before promotion: row ${blockedRow.row.rowNumber} ${blockedRow.row.rowId} is ${blockedRow.promotionReadiness}${reason}`,
  );
}

export function buildStorePromotionRow(
  batch: BootstrapBatch,
  row: BootstrapStagedRow,
) {
  const storeCode =
    readNormalizedString(row.normalizedPayload, "normalizedStoreCode") ??
    row.sourceStoreCode;
  const storeName = readNormalizedString(
    row.normalizedPayload,
    "normalizedStoreName",
  );
  const storeType = readNormalizedString(
    row.normalizedPayload,
    "normalizedStoreType",
  );
  const status =
    readNormalizedString(row.normalizedPayload, "normalizedStoreStatus") ?? "active";
  const kpiImportEnabled =
    typeof row.normalizedPayload.kpiImportEnabled === "boolean"
      ? row.normalizedPayload.kpiImportEnabled
      : true;

  if (!storeCode || !storeName || !storeType || !row.resolvedRegionId) {
    throw new BadRequestException(
      `Ready store row is missing promotion evidence: ${row.rowId}`,
    );
  }

  return {
    rowId: row.rowId,
    companyId: batch.companyId,
    regionId: row.resolvedRegionId,
    storeCode,
    storeName,
    storeType,
    status,
    kpiImportEnabled,
  };
}

export function buildPersonnelPromotionRow(
  batch: BootstrapBatch,
  row: BootstrapStagedRow,
) {
  const employeeCode =
    readNormalizedString(row.normalizedPayload, "normalizedEmployeeCode") ??
    row.sourceEmployeeCode;
  const firstName = readNormalizedString(
    row.normalizedPayload,
    "normalizedFirstName",
  );
  const lastName = readNormalizedString(
    row.normalizedPayload,
    "normalizedLastName",
  );
  const nationalIdHash = readNormalizedString(
    row.normalizedPayload,
    "normalizedNationalIdHash",
  );
  const hireDate = readNormalizedString(
    row.normalizedPayload,
    "normalizedHireDate",
  );
  const employmentType =
    readNormalizedString(row.normalizedPayload, "normalizedEmploymentType") ??
    "full_time";

  if (
    !employeeCode ||
    !firstName ||
    !lastName ||
    !hireDate ||
    !row.resolvedStoreId ||
    !row.resolvedRegionId ||
    !row.resolvedPositionId
  ) {
    throw new BadRequestException(
      `Ready personnel row is missing promotion evidence: ${row.rowId}`,
    );
  }

  return {
    rowId: row.rowId,
    companyId: batch.companyId,
    storeId: row.resolvedStoreId,
    regionId: row.resolvedRegionId,
    positionId: row.resolvedPositionId,
    employeeId: row.resolvedEmployeeId,
    employeeCode,
    firstName,
    lastName,
    nationalIdHash: nationalIdHash ?? null,
    hireDate,
    employmentType,
  };
}

export function classifyBootstrapPromotionRow(
  batch: BootstrapBatch,
  row: BootstrapStagedRow,
): {
  promotionReadiness: BootstrapPromotionReadiness;
  blockReason: string | null;
} {
  if (row.validationStatus === "promoted" || row.promotedEntityId) {
    return {
      promotionReadiness: "already_promoted",
      blockReason: "already_promoted",
    };
  }

  if (row.validationStatus === "pending") {
    return {
      promotionReadiness: "needs_validation",
      blockReason: "validation_pending",
    };
  }

  if (row.validationStatus === "needs_review") {
    return {
      promotionReadiness: "needs_review",
      blockReason: row.issueCode ?? "needs_review",
    };
  }

  if (row.validationStatus === "invalid") {
    return {
      promotionReadiness: "blocked",
      blockReason: row.issueCode ?? "invalid",
    };
  }

  if (batch.batchStatus !== "ready_to_promote") {
    return {
      promotionReadiness: "waiting_batch",
      blockReason: "batch_not_ready_to_promote",
    };
  }

  return {
    promotionReadiness: "ready",
    blockReason: null,
  };
}

export function buildBootstrapPromotionReadinessSummary(
  batch: BootstrapBatch,
  items: Array<{
    promotionReadiness: BootstrapPromotionReadiness;
  }>,
) {
  const counts = items.reduce(
    (accumulator, item) => {
      if (item.promotionReadiness === "ready") {
        accumulator.readyCount += 1;
      }
      if (item.promotionReadiness === "waiting_batch") {
        accumulator.waitingBatchCount += 1;
      }
      if (item.promotionReadiness === "needs_validation") {
        accumulator.needsValidationCount += 1;
      }
      if (item.promotionReadiness === "needs_review") {
        accumulator.needsReviewCount += 1;
      }
      if (item.promotionReadiness === "blocked") {
        accumulator.blockedCount += 1;
      }
      if (item.promotionReadiness === "already_promoted") {
        accumulator.alreadyPromotedCount += 1;
      }

      return accumulator;
    },
    {
      readyCount: 0,
      waitingBatchCount: 0,
      needsValidationCount: 0,
      needsReviewCount: 0,
      blockedCount: 0,
      alreadyPromotedCount: 0,
    },
  );
  const hasBlockingRows =
    counts.needsValidationCount > 0 ||
    counts.needsReviewCount > 0 ||
    counts.blockedCount > 0;
  const canPromote =
    batch.batchStatus === "ready_to_promote" &&
    counts.readyCount > 0 &&
    !hasBlockingRows;

  return {
    batchId: batch.batchId,
    bootstrapEntity: batch.bootstrapEntity,
    batchStatus: batch.batchStatus,
    rowCount: batch.rowCount,
    ...counts,
    canPromote,
    nextAction: deriveBootstrapPromotionNextAction({
      batchStatus: batch.batchStatus,
      canPromote,
      ...counts,
    }),
  };
}

function deriveBootstrapPromotionNextAction(input: {
  batchStatus: string;
  canPromote: boolean;
  needsValidationCount: number;
  needsReviewCount: number;
  blockedCount: number;
}): BootstrapPromotionNextAction {
  if (["promoted", "rejected"].includes(input.batchStatus)) {
    return "already_closed";
  }

  if (input.needsValidationCount > 0 || input.batchStatus === "uploaded") {
    return "validate_batch";
  }

  if (input.needsReviewCount > 0 || input.blockedCount > 0) {
    return "review_rows";
  }

  if (input.canPromote) {
    return "promote_ready_rows";
  }

  return "wait_for_batch_ready";
}
