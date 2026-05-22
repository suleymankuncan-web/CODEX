import { createHash } from "node:crypto";
import {
  type BootstrapEntity,
  type BootstrapResolvedStore,
  type BootstrapStagedRow,
  type BootstrapValidationResult,
} from "../infrastructure/master-data-bootstrap.repository";

export function buildStoreResolution(
  companyId: string,
  resolvedStore: BootstrapResolvedStore | null,
) {
  return {
    resolvedCompanyId: companyId,
    resolvedRegionId: resolvedStore?.regionId ?? null,
    resolvedStoreId: resolvedStore?.storeId ?? null,
  };
}

export function buildValidationResult(
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

export function normalizeBootstrapPayload(
  bootstrapEntity: BootstrapEntity,
  row: Record<string, unknown>,
) {
  const normalized: Record<string, unknown> = {
    normalizedStoreCode: readNormalizedStoreCode(row),
  };

  if (bootstrapEntity === "personnel") {
    normalized.normalizedEmployeeCode = readNormalizedEmployeeCode(row);
    normalized.normalizedPositionCode = readNormalizedPositionCode(row);
    const firstName = readNormalizedFirstName(row);
    if (firstName) {
      normalized.normalizedFirstName = firstName;
    }
    const lastName = readNormalizedLastName(row);
    if (lastName) {
      normalized.normalizedLastName = lastName;
    }
    const hireDate = readNormalizedHireDate(row);
    if (hireDate) {
      normalized.normalizedHireDate = hireDate;
    }
    const employmentType = normalizeEmploymentType(
      readString(row, "employmentType") || readString(row, "employment_type"),
    );
    if (employmentType) {
      normalized.normalizedEmploymentType = employmentType;
    }
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

export function hashBootstrapRow(
  bootstrapEntity: BootstrapEntity,
  row: Record<string, unknown>,
) {
  return createHash("sha256")
    .update(`${bootstrapEntity}:${stableStringify(row)}`)
    .digest("hex");
}

export function readNormalizedStoreCode(row: Record<string, unknown>) {
  const value =
    readString(row, "storeCode") ||
    readString(row, "sourceStoreId") ||
    readString(row, "storeExternalRef");

  return value ? value.replace(/[\s-]/g, "").toUpperCase() : null;
}

export function readNormalizedEmployeeCode(row: Record<string, unknown>) {
  const value =
    readString(row, "sellerCode") ||
    readString(row, "employeeCode") ||
    readString(row, "sourceEmployeeId") ||
    readString(row, "employeeExternalRef");

  return value ? value.replace(/\s/g, "").toUpperCase() : null;
}

export function readNormalizedString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readNormalizedPositionCode(row: Record<string, unknown>) {
  const value = readString(row, "positionCode") || readString(row, "position");

  return value ? value.replace(/\s/g, "_").toUpperCase() : null;
}

function readNormalizedFirstName(row: Record<string, unknown>) {
  return (
    readString(row, "firstName") ||
    readString(row, "first_name") ||
    readString(row, "givenName") ||
    readString(row, "ad")
  );
}

function readNormalizedLastName(row: Record<string, unknown>) {
  return (
    readString(row, "lastName") ||
    readString(row, "last_name") ||
    readString(row, "surname") ||
    readString(row, "soyad")
  );
}

function readNormalizedHireDate(row: Record<string, unknown>) {
  return (
    readScalarString(row, "hireDate") ||
    readScalarString(row, "hire_date") ||
    readScalarString(row, "startDate") ||
    readScalarString(row, "employmentStartDate") ||
    readScalarString(row, "iseGirisTarihi")
  );
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

function normalizeEmploymentType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["full_time", "fulltime", "tam_zamanli"].includes(normalized)) {
    return "full_time";
  }

  if (["part_time", "parttime", "yari_zamanli"].includes(normalized)) {
    return "part_time";
  }

  if (["temporary", "temp", "gecici"].includes(normalized)) {
    return "temporary";
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
