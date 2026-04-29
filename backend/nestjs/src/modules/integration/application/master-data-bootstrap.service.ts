import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
  type BootstrapValidationResult,
  MasterDataBootstrapRepository,
} from "../infrastructure/master-data-bootstrap.repository";

const ALLOWED_STORE_TYPES = new Set(["company", "franchise", "operator"]);

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

    for (const row of rows) {
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

    return buildValidationResult(row, {
      validationStatus: "valid",
      issueCode: null,
      issueMessage: null,
      ...resolution,
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
  }

  if (bootstrapEntity === "store") {
    normalized.normalizedStoreType = normalizeStoreType(readString(row, "storeType"));
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

function normalizeStoreType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["sirket", "company"].includes(normalized)) {
    return "company";
  }

  if (["franchise"].includes(normalized)) {
    return "franchise";
  }

  if (["isletme", "operator"].includes(normalized)) {
    return "operator";
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
