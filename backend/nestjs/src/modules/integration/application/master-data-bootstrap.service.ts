import { ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import { MasterDataBootstrapRepository } from "../infrastructure/master-data-bootstrap.repository";

type BootstrapEntity = "store" | "personnel";

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
