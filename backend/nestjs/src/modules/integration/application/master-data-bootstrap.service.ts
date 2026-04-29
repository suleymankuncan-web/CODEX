import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  buildCommandResponse,
  buildListResponse,
} from "../../../shared/http/response-builders";
import {
  type BootstrapBatch,
  type BootstrapEntity,
  type BootstrapResolvedStore,
  type BootstrapStagedRow,
  type BootstrapValidationStatus,
  type BootstrapValidationResult,
  MasterDataBootstrapRepository,
} from "../infrastructure/master-data-bootstrap.repository";

const ALLOWED_STORE_TYPES = new Set(["company", "franchise", "operator"]);

type BootstrapReadiness =
  | "needs_validation"
  | "needs_review"
  | "ready_to_promote"
  | "closed";

type BootstrapNextAction =
  | "validate_batch"
  | "review_invalid_rows"
  | "review_needs_review_rows"
  | "wait_for_promotion_decision"
  | "closed";

type BootstrapPreflightIssue = Pick<
  BootstrapValidationResult,
  "validationStatus" | "issueCode" | "issueMessage"
>;

type BootstrapPromotionReadiness =
  | "needs_validation"
  | "needs_review"
  | "blocked"
  | "waiting_batch"
  | "ready"
  | "already_promoted";

type BootstrapPromotionNextAction =
  | "validate_batch"
  | "review_rows"
  | "promote_ready_rows"
  | "already_closed"
  | "wait_for_batch_ready";

@Injectable()
export class MasterDataBootstrapService {
  constructor(
    private readonly masterDataBootstrapRepository: MasterDataBootstrapRepository,
  ) {}

  async createBootstrapBatch(input: {
    actorUserId: string;
    actorScope: {
      companyIds: string[];
    };
    bootstrapEntity: BootstrapEntity;
    sourceLabel: string;
    fileReference?: string;
    rows: Record<string, unknown>[];
  }) {
    const companyId = input.actorScope.companyIds[0];
    if (!companyId) {
      throw new ForbiddenException("Master data bootstrap requires company scope");
    }

    const rows = input.rows.map((row, index) => {
      const normalizedPayload = normalizeBootstrapPayload(input.bootstrapEntity, row);

      return {
        rowNumber: index + 1,
        rowHash: hashBootstrapRow(input.bootstrapEntity, row),
        sourceStoreCode: readNormalizedStoreCode(row),
        sourceEmployeeCode: readNormalizedEmployeeCode(row),
        rawPayload: row,
        normalizedPayload,
        validationStatus: "pending" as const,
      };
    });
    const batch = await this.masterDataBootstrapRepository.createBootstrapBatch({
      companyId,
      bootstrapEntity: input.bootstrapEntity,
      sourceLabel: input.sourceLabel,
      fileReference: input.fileReference,
      uploadedByUserId: input.actorUserId,
      rows,
    });

    return buildCommandResponse({
      status: "uploaded",
      message: "Master data bootstrap batch staged for review",
      data: {
        batch,
      },
    });
  }

  async listBootstrapBatches(input: {
    actorScope: {
      companyIds: string[];
    };
    bootstrapEntity?: BootstrapEntity;
    batchStatus?: string;
    readiness?: BootstrapReadiness;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    if (input.actorScope.companyIds.length === 0) {
      throw new ForbiddenException("Master data bootstrap requires company scope");
    }

    const result = await this.masterDataBootstrapRepository.listBootstrapBatches({
      companyIds: input.actorScope.companyIds,
      bootstrapEntity: input.bootstrapEntity,
      batchStatus: input.batchStatus,
      readiness: input.readiness,
      q: input.q,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    });

    return buildListResponse(
      result.rows.map((batch) => {
        const readiness = deriveBootstrapReadiness(batch);
        return {
          ...batch,
          readiness,
          nextAction: deriveBootstrapNextAction(batch, readiness),
        };
      }),
      {
        total: result.total,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    );
  }

  async listBootstrapRowsForReview(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
    validationStatus?: BootstrapValidationStatus;
    issueCode?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });

    const result =
      await this.masterDataBootstrapRepository.listBootstrapRowsForReview({
        batchId: input.batchId,
        companyIds: input.actorScope.companyIds,
        validationStatus: input.validationStatus,
        issueCode: input.issueCode,
        q: input.q,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });

    return buildListResponse(
      result.rows.map((row) => ({
        rowId: row.rowId,
        batchId: row.batchId,
        rowNumber: row.rowNumber,
        sourceStoreCode: row.sourceStoreCode,
        sourceEmployeeCode: row.sourceEmployeeCode,
        validationStatus: row.validationStatus,
        issueCode: row.issueCode,
        issueMessage: row.issueMessage,
        resolvedCompanyId: row.resolvedCompanyId,
        resolvedRegionId: row.resolvedRegionId,
        resolvedStoreId: row.resolvedStoreId,
        resolvedEmployeeId: row.resolvedEmployeeId,
        resolvedPositionId: row.resolvedPositionId,
        promotedEntityId: row.promotedEntityId,
        rawPayload: row.rawPayload,
        normalizedPayload: row.normalizedPayload,
        updatedAt: row.updatedAt,
      })),
      {
        total: result.total,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    );
  }

  async validateBootstrapBatch(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
  }) {
    const batch = await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });
    const rows = await this.masterDataBootstrapRepository.listBootstrapRows(
      input.batchId,
    );
    const results: BootstrapValidationResult[] = [];
    const preflightIssues = buildBootstrapPreflightIssueMap(batch, rows);

    for (const row of rows) {
      const preflightIssue = preflightIssues.get(row.rowId);
      if (preflightIssue) {
        results.push(
          buildValidationResult(row, {
            ...preflightIssue,
            resolvedCompanyId: batch.companyId,
          }),
        );
        continue;
      }

      results.push(await this.validateBootstrapRow(batch, row));
    }

    const updatedBatch =
      await this.masterDataBootstrapRepository.updateBootstrapRowValidationResults({
        batchId: input.batchId,
        results,
      });

    if (!updatedBatch) {
      throw new NotFoundException(
        `Master data bootstrap batch not found: ${input.batchId}`,
      );
    }

    return buildCommandResponse({
      status: "validated",
      message: "Master data bootstrap batch validated for review",
      data: {
        batch: updatedBatch,
      },
    });
  }

  async getBootstrapPromotionReadiness(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
  }) {
    const batch = await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });
    const rows = await this.masterDataBootstrapRepository.listBootstrapRows(
      input.batchId,
    );
    const items = rows.map((row) =>
      buildBootstrapPromotionReadinessItem(batch, row),
    );
    const summary = buildBootstrapPromotionReadinessSummary(batch, items);

    return {
      summary,
      rows: buildListResponse(items, {
        total: items.length,
        limit: items.length,
        offset: 0,
      }),
    };
  }

  async promoteStoreBootstrapBatch(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
  }) {
    const batch = await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });

    if (batch.bootstrapEntity !== "store") {
      throw new BadRequestException(
        "Store bootstrap promotion only supports store batches",
      );
    }

    if (batch.batchStatus !== "ready_to_promote") {
      throw new BadRequestException(
        "Store bootstrap batch must be ready_to_promote before promotion",
      );
    }

    const rows = await this.masterDataBootstrapRepository.listBootstrapRows(
      input.batchId,
    );
    const promotionRows = rows
      .filter(
        (row) =>
          classifyBootstrapPromotionRow(batch, row).promotionReadiness === "ready",
      )
      .map((row) => buildStorePromotionRow(batch, row));

    if (promotionRows.length === 0) {
      throw new BadRequestException("Store bootstrap batch has no ready rows");
    }

    const promotedBatch =
      await this.masterDataBootstrapRepository.promoteStoreBootstrapRows({
        batchId: input.batchId,
        rows: promotionRows,
      });

    return buildCommandResponse({
      status: "promoted",
      message: "Store bootstrap rows promoted",
      data: {
        batch: promotedBatch,
        promotedRows: promotedBatch.promotedRows,
      },
    });
  }

  async getBootstrapBatchDetail(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
  }) {
    const batch = await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });
    const rows = await this.masterDataBootstrapRepository.listBootstrapRows(
      input.batchId,
    );
    const statusCounts = countValidationStatuses(rows);

    return {
      summary: {
        ...batch,
        statusCounts,
      },
      rows: buildListResponse(
        rows.map((row) => ({
          rowId: row.rowId,
          rowNumber: row.rowNumber,
          sourceStoreCode: row.sourceStoreCode,
          sourceEmployeeCode: row.sourceEmployeeCode,
          validationStatus: row.validationStatus,
          issueCode: row.issueCode,
          issueMessage: row.issueMessage,
          resolvedCompanyId: row.resolvedCompanyId,
          resolvedRegionId: row.resolvedRegionId,
          resolvedStoreId: row.resolvedStoreId,
          resolvedEmployeeId: row.resolvedEmployeeId,
          resolvedPositionId: row.resolvedPositionId,
          promotedEntityId: row.promotedEntityId,
          rawPayload: row.rawPayload,
          normalizedPayload: row.normalizedPayload,
        })),
        { total: rows.length, limit: rows.length },
      ),
    };
  }

  private async getScopedBootstrapBatch(input: {
    batchId: string;
    companyIds: string[];
  }) {
    if (input.companyIds.length === 0) {
      throw new ForbiddenException("Master data bootstrap requires company scope");
    }

    const batch =
      await this.masterDataBootstrapRepository.getBootstrapBatchForActor(input);

    if (!batch) {
      throw new NotFoundException(
        `Master data bootstrap batch not found: ${input.batchId}`,
      );
    }

    return batch;
  }

  private async validateBootstrapRow(
    batch: BootstrapBatch,
    row: BootstrapStagedRow,
  ): Promise<BootstrapValidationResult> {
    const storeCode =
      readNormalizedString(row.normalizedPayload, "normalizedStoreCode") ??
      row.sourceStoreCode;

    if (!storeCode) {
      return buildValidationResult(row, {
        validationStatus: "invalid",
        issueCode: "missing_store_code",
        issueMessage: "Store code is required before this row can be reviewed",
        resolvedCompanyId: batch.companyId,
      });
    }

    if (batch.bootstrapEntity === "store") {
      return this.validateStoreBootstrapRow(batch, row, storeCode);
    }

    return this.validatePersonnelBootstrapRow(batch, row, storeCode);
  }

  private async validateStoreBootstrapRow(
    batch: BootstrapBatch,
    row: BootstrapStagedRow,
    storeCode: string,
  ): Promise<BootstrapValidationResult> {
    const storeType = readNormalizedString(
      row.normalizedPayload,
      "normalizedStoreType",
    );
    const storeName = readNormalizedString(
      row.normalizedPayload,
      "normalizedStoreName",
    );
    const resolvedStore =
      await this.masterDataBootstrapRepository.resolveStoreByCode(
        batch.companyId,
        storeCode,
      );
    const resolution = buildStoreResolution(batch.companyId, resolvedStore);

    if (!storeType || !ALLOWED_STORE_TYPES.has(storeType)) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "unknown_store_type",
        issueMessage:
          "Store type must be one of company, franchise, or operator before promotion",
        ...resolution,
      });
    }

    if (!storeName) {
      return buildValidationResult(row, {
        validationStatus: "invalid",
        issueCode: "missing_store_name",
        issueMessage: "Store name is required before promotion",
        ...resolution,
      });
    }

    if (resolvedStore) {
      return buildValidationResult(row, {
        validationStatus: "valid",
        issueCode: null,
        issueMessage: null,
        ...resolution,
      });
    }

    const regionCode = readNormalizedString(
      row.normalizedPayload,
      "normalizedRegionCode",
    );
    if (!regionCode) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "missing_region_code",
        issueMessage: "Region code is required for new store promotion",
        resolvedCompanyId: batch.companyId,
      });
    }

    const resolvedRegionId =
      await this.masterDataBootstrapRepository.resolveRegionByCode(
        batch.companyId,
        regionCode,
      );
    if (!resolvedRegionId) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "unmapped_region",
        issueMessage:
          "Region code is not active in master data; define the region before promotion",
        resolvedCompanyId: batch.companyId,
      });
    }

    return buildValidationResult(row, {
      validationStatus: "valid",
      issueCode: null,
      issueMessage: null,
      resolvedCompanyId: batch.companyId,
      resolvedRegionId,
      resolvedStoreId: null,
    });
  }

  private async validatePersonnelBootstrapRow(
    batch: BootstrapBatch,
    row: BootstrapStagedRow,
    storeCode: string,
  ): Promise<BootstrapValidationResult> {
    const resolvedStore =
      await this.masterDataBootstrapRepository.resolveStoreByCode(
        batch.companyId,
        storeCode,
      );

    if (!resolvedStore) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "unmapped_store",
        issueMessage:
          "Store code is not active in master data; define the store before promotion",
        resolvedCompanyId: batch.companyId,
      });
    }

    const employeeCode =
      readNormalizedString(row.normalizedPayload, "normalizedEmployeeCode") ??
      row.sourceEmployeeCode;
    if (!employeeCode) {
      return buildValidationResult(row, {
        validationStatus: "invalid",
        issueCode: "missing_employee_code",
        issueMessage: "Employee seller code is required before promotion",
        ...buildStoreResolution(batch.companyId, resolvedStore),
      });
    }

    const positionCode = readNormalizedString(
      row.normalizedPayload,
      "normalizedPositionCode",
    );
    if (!positionCode) {
      return buildValidationResult(row, {
        validationStatus: "invalid",
        issueCode: "missing_position_code",
        issueMessage: "Position code is required before promotion",
        ...buildStoreResolution(batch.companyId, resolvedStore),
      });
    }

    const [resolvedEmployeeId, resolvedPositionId] = await Promise.all([
      this.masterDataBootstrapRepository.resolveEmployeeByCode(
        batch.companyId,
        employeeCode,
      ),
      this.masterDataBootstrapRepository.resolvePositionByCode(
        batch.companyId,
        positionCode,
      ),
    ]);

    const nationalIdHash = readNormalizedString(
      row.normalizedPayload,
      "normalizedNationalIdHash",
    );
    const resolvedNationalIdEmployeeId = nationalIdHash
      ? await this.masterDataBootstrapRepository.resolveEmployeeByNationalIdHash(
          batch.companyId,
          nationalIdHash,
        )
      : null;

    if (
      resolvedNationalIdEmployeeId &&
      (!resolvedEmployeeId || resolvedNationalIdEmployeeId !== resolvedEmployeeId)
    ) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "employee_identity_conflict",
        issueMessage:
          "Seller code and national id evidence point to different employee identities",
        ...buildStoreResolution(batch.companyId, resolvedStore),
        resolvedEmployeeId: resolvedEmployeeId ?? resolvedNationalIdEmployeeId,
        resolvedPositionId,
      });
    }

    if (!resolvedPositionId) {
      return buildValidationResult(row, {
        validationStatus: "needs_review",
        issueCode: "unmapped_position",
        issueMessage:
          "Position code is not active in master data; define the position before promotion",
        ...buildStoreResolution(batch.companyId, resolvedStore),
        resolvedEmployeeId,
      });
    }

    return buildValidationResult(row, {
      validationStatus: "valid",
      issueCode: null,
      issueMessage: null,
      ...buildStoreResolution(batch.companyId, resolvedStore),
      resolvedEmployeeId,
      resolvedPositionId,
    });
  }
}

function countValidationStatuses(rows: BootstrapStagedRow[]) {
  return rows.reduce(
    (accumulator, row) => {
      accumulator[row.validationStatus] += 1;
      return accumulator;
    },
    {
      pending: 0,
      valid: 0,
      needs_review: 0,
      invalid: 0,
      promoted: 0,
    },
  );
}

function buildBootstrapPromotionReadinessItem(
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

function buildStorePromotionRow(batch: BootstrapBatch, row: BootstrapStagedRow) {
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

function classifyBootstrapPromotionRow(
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

function buildBootstrapPromotionReadinessSummary(
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

function buildBootstrapPreflightIssueMap(
  batch: BootstrapBatch,
  rows: BootstrapStagedRow[],
) {
  const issues = new Map<string, BootstrapPreflightIssue>();

  if (batch.bootstrapEntity === "store") {
    addDuplicatePreflightIssues({
      rows,
      issues,
      valueOf: (row) =>
        readNormalizedString(row.normalizedPayload, "normalizedStoreCode") ??
        row.sourceStoreCode,
      issueCode: "duplicate_store_code_in_batch",
      issueMessage:
        "Store code appears more than once in this bootstrap batch after normalization",
    });

    return issues;
  }

  const duplicateEligibleRows = rows.filter(isPersonnelPreflightEligible);

  addDuplicatePreflightIssues({
    rows: duplicateEligibleRows,
    issues,
    valueOf: (row) =>
      readNormalizedString(row.normalizedPayload, "normalizedEmployeeCode") ??
      row.sourceEmployeeCode,
    issueCode: "duplicate_employee_code_in_batch",
    issueMessage:
      "Employee seller code appears more than once in this bootstrap batch after normalization",
  });
  addDuplicatePreflightIssues({
    rows: duplicateEligibleRows,
    issues,
    valueOf: (row) =>
      readNormalizedString(row.normalizedPayload, "normalizedNationalIdHash"),
    issueCode: "duplicate_national_id_in_batch",
    issueMessage:
      "National id evidence appears more than once in this bootstrap batch",
  });

  return issues;
}

function isPersonnelPreflightEligible(row: BootstrapStagedRow) {
  return Boolean(
    readNormalizedString(row.normalizedPayload, "normalizedStoreCode") ??
      row.sourceStoreCode,
  ) &&
    Boolean(
      readNormalizedString(row.normalizedPayload, "normalizedEmployeeCode") ??
        row.sourceEmployeeCode,
    ) &&
    Boolean(readNormalizedString(row.normalizedPayload, "normalizedPositionCode"));
}

function addDuplicatePreflightIssues(input: {
  rows: BootstrapStagedRow[];
  issues: Map<string, BootstrapPreflightIssue>;
  valueOf: (row: BootstrapStagedRow) => string | null;
  issueCode:
    | "duplicate_store_code_in_batch"
    | "duplicate_employee_code_in_batch"
    | "duplicate_national_id_in_batch";
  issueMessage: string;
}) {
  const rowsByValue = new Map<string, BootstrapStagedRow[]>();

  for (const row of input.rows) {
    const value = input.valueOf(row);
    if (!value) {
      continue;
    }

    const normalizedValue = value.trim().toUpperCase();
    rowsByValue.set(normalizedValue, [...(rowsByValue.get(normalizedValue) ?? []), row]);
  }

  for (const duplicateRows of rowsByValue.values()) {
    if (duplicateRows.length < 2) {
      continue;
    }

    for (const row of duplicateRows) {
      if (input.issues.has(row.rowId)) {
        continue;
      }

      input.issues.set(row.rowId, {
        validationStatus: "needs_review",
        issueCode: input.issueCode,
        issueMessage: input.issueMessage,
      });
    }
  }
}

function deriveBootstrapReadiness(input: {
  batchStatus: string;
  pendingCount: number;
  invalidCount: number;
  needsReviewCount: number;
}): BootstrapReadiness {
  if (["promoted", "rejected"].includes(input.batchStatus)) {
    return "closed";
  }

  if (input.batchStatus === "ready_to_promote") {
    return "ready_to_promote";
  }

  if (input.batchStatus === "uploaded" || input.pendingCount > 0) {
    return "needs_validation";
  }

  if (input.invalidCount > 0 || input.needsReviewCount > 0) {
    return "needs_review";
  }

  return "ready_to_promote";
}

function deriveBootstrapNextAction(
  input: {
    invalidCount: number;
    needsReviewCount: number;
  },
  readiness: BootstrapReadiness,
): BootstrapNextAction {
  if (readiness === "needs_validation") {
    return "validate_batch";
  }

  if (readiness === "needs_review" && input.invalidCount > 0) {
    return "review_invalid_rows";
  }

  if (readiness === "needs_review" && input.needsReviewCount > 0) {
    return "review_needs_review_rows";
  }

  if (readiness === "ready_to_promote") {
    return "wait_for_promotion_decision";
  }

  return "closed";
}

function buildStoreResolution(
  companyId: string,
  resolvedStore: BootstrapResolvedStore | null,
) {
  return {
    resolvedCompanyId: companyId,
    resolvedRegionId: resolvedStore?.regionId ?? null,
    resolvedStoreId: resolvedStore?.storeId ?? null,
  };
}

function buildValidationResult(
  row: BootstrapStagedRow,
  input: Pick<
    BootstrapValidationResult,
    "validationStatus" | "issueCode" | "issueMessage"
  > &
    Partial<
      Pick<
        BootstrapValidationResult,
        | "resolvedCompanyId"
        | "resolvedRegionId"
        | "resolvedStoreId"
        | "resolvedEmployeeId"
        | "resolvedPositionId"
      >
    >,
): BootstrapValidationResult {
  return {
    rowId: row.rowId,
    validationStatus: input.validationStatus,
    issueCode: input.issueCode,
    issueMessage: input.issueMessage,
    resolvedCompanyId: input.resolvedCompanyId ?? null,
    resolvedRegionId: input.resolvedRegionId ?? null,
    resolvedStoreId: input.resolvedStoreId ?? null,
    resolvedEmployeeId: input.resolvedEmployeeId ?? null,
    resolvedPositionId: input.resolvedPositionId ?? null,
  };
}

function normalizeBootstrapPayload(
  bootstrapEntity: BootstrapEntity,
  row: Record<string, unknown>,
) {
  const normalized: Record<string, unknown> = {
    normalizedStoreCode: readNormalizedStoreCode(row),
  };

  if (bootstrapEntity === "personnel") {
    normalized.normalizedEmployeeCode = readNormalizedEmployeeCode(row);
    normalized.normalizedPositionCode = readNormalizedPositionCode(row);
    const normalizedNationalIdHash = readNormalizedNationalIdHash(row);
    if (normalizedNationalIdHash) {
      normalized.normalizedNationalIdHash = normalizedNationalIdHash;
    }
  }

  if (bootstrapEntity === "store") {
    normalized.normalizedStoreType = normalizeStoreType(readString(row, "storeType"));
    normalized.normalizedStoreName = readNormalizedStoreName(row);
    normalized.normalizedRegionCode = readNormalizedRegionCode(row);
    normalized.normalizedStoreStatus = normalizeStoreStatus(
      readString(row, "storeStatus") || readString(row, "status"),
    );
    normalized.kpiImportEnabled = normalizeBoolean(readValue(row, "kpiImportEnabled"));
  }

  return normalized;
}

function hashBootstrapRow(
  bootstrapEntity: BootstrapEntity,
  row: Record<string, unknown>,
) {
  return createHash("sha256")
    .update(`${bootstrapEntity}:${stableStringify(row)}`)
    .digest("hex");
}

function readNormalizedStoreCode(row: Record<string, unknown>) {
  const value =
    readString(row, "storeCode") ||
    readString(row, "sourceStoreId") ||
    readString(row, "storeExternalRef");

  return value ? value.replace(/[\s-]/g, "").toUpperCase() : null;
}

function readNormalizedEmployeeCode(row: Record<string, unknown>) {
  const value =
    readString(row, "sellerCode") ||
    readString(row, "employeeCode") ||
    readString(row, "sourceEmployeeId") ||
    readString(row, "employeeExternalRef");

  return value ? value.replace(/\s/g, "").toUpperCase() : null;
}

function readNormalizedPositionCode(row: Record<string, unknown>) {
  const value = readString(row, "positionCode") || readString(row, "position");

  return value ? value.replace(/\s/g, "_").toUpperCase() : null;
}

function readNormalizedStoreName(row: Record<string, unknown>) {
  return (
    readString(row, "storeName") ||
    readString(row, "store_name") ||
    readString(row, "name") ||
    readString(row, "magazaAdi") ||
    readString(row, "mağazaAdı")
  );
}

function readNormalizedRegionCode(row: Record<string, unknown>) {
  const value =
    readString(row, "regionCode") ||
    readString(row, "region_code") ||
    readString(row, "sourceRegionId") ||
    readString(row, "regionExternalRef") ||
    readString(row, "region");

  return value ? value.replace(/[\s-]+/g, "_").toUpperCase() : null;
}

function readNormalizedNationalIdHash(row: Record<string, unknown>) {
  const hashValue =
    readScalarString(row, "nationalIdHash") ||
    readScalarString(row, "nationalIDHash") ||
    readScalarString(row, "national_id_hash");

  if (hashValue) {
    const normalizedHash = hashValue.trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalizedHash) ? normalizedHash : null;
  }

  const nationalIdValue =
    readScalarString(row, "nationalId") ||
    readScalarString(row, "nationalID") ||
    readScalarString(row, "national_id") ||
    readScalarString(row, "tcKimlikNo") ||
    readScalarString(row, "tcNo") ||
    readScalarString(row, "tckn");
  const nationalIdDigits = nationalIdValue?.replace(/\D/g, "") ?? "";

  return nationalIdDigits
    ? createHash("sha256").update(`national_id:${nationalIdDigits}`).digest("hex")
    : null;
}

function normalizeStoreType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["sirket", "şirket", "company"].includes(normalized)) {
    return "company";
  }

  if (["franchise"].includes(normalized)) {
    return "franchise";
  }

  if (["isletme", "işletme", "operator"].includes(normalized)) {
    return "operator";
  }

  return normalized;
}

function normalizeStoreStatus(value: string | null) {
  if (!value) {
    return "active";
  }

  const normalized = value.trim().toLowerCase();
  if (["active", "aktif"].includes(normalized)) {
    return "active";
  }

  if (["inactive", "pasif"].includes(normalized)) {
    return "inactive";
  }

  if (["closed", "kapali", "kapalı"].includes(normalized)) {
    return "closed";
  }

  return normalized;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1", "evet"].includes(normalized)) {
      return true;
    }

    if (["false", "no", "0", "hayir"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function readString(row: Record<string, unknown>, key: string) {
  const value = readValue(row, key);
  return typeof value === "string" ? value.trim() : null;
}

function readScalarString(row: Record<string, unknown>, key: string) {
  const value = readValue(row, key);
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readValue(row: Record<string, unknown>, key: string) {
  return Object.entries(row).find(
    ([candidate]) => candidate.toLowerCase() === key.toLowerCase(),
  )?.[1];
}

function readNormalizedString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
