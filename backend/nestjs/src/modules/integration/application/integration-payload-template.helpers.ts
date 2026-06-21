import { IMPORT_DATA_QUALITY_ISSUES } from "./import-data-quality";

export type SupportedEntityType =
  | "employee"
  | "store"
  | "kpi"
  | "assignment"
  | "position"
  | "company"
  | "region";

export type SupportedSourceSystem =
  | "nebim_v3"
  | "power_bi"
  | "manual"
  | "other";

export function buildImportPayloadTemplate(input?: {
  entityType?: SupportedEntityType;
  sourceSystem?: SupportedSourceSystem;
}) {
  const entityType = input?.entityType ?? "kpi";
  const sourceSystem = input?.sourceSystem ?? "nebim_v3";

  if (entityType !== "kpi") {
    return {
      entityType,
      sourceSystem,
      canonicalContract: buildCanonicalKpiContract(),
      note: "Sample payload templates are currently productized for KPI imports first.",
      requestBody: {
        sourceCode: `${sourceSystem}-${entityType}`,
        entityType,
        fileReference: `${sourceSystem}-${entityType}-sample.json`,
        sourceBatchId: `${sourceSystem}-${entityType}-2026-04-22T10:30`,
        sourceCapturedAt: "2026-04-22T10:30:00.000Z",
        sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
        sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
        rows: [],
      },
    };
  }

  const requestBody =
    sourceSystem === "power_bi"
      ? {
          sourceCode: "power-bi-kpi",
          entityType: "kpi",
          fileReference: "power-bi-kpi-sample.json",
          sourceBatchId: "power-bi-kpi-2026-04-22T10:30",
          sourceCapturedAt: "2026-04-22T10:30:00.000Z",
          sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
          sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
          rows: [
            {
              sellerCode: "S-100",
              storeCode: "M-10",
              atv: 5200,
              upt: 3.2,
              netSales: 25000,
            },
            {
              storeCode: "M-10",
              conversionRate: 0.15,
              gsm_approval: 0.912052,
            },
          ],
        }
      : {
          sourceCode: "nebim-kpi",
          entityType: "kpi",
          fileReference: "nebim-kpi-sample.json",
          sourceBatchId: "nebim-kpi-2026-04-22T10:30",
          sourceCapturedAt: "2026-04-22T10:30:00.000Z",
          sourceWindowStartedAt: "2026-04-22T10:00:00.000Z",
          sourceWindowEndedAt: "2026-04-22T10:30:00.000Z",
          rows: [
            {
              saticiKodu: "S-100",
              magazaKodu: "M-10",
              atv: 5200,
              upt: 3.2,
              netTutar: 25000,
            },
            {
              magazaKodu: "M-10",
              cr: 0.15,
            },
          ],
        };

  return {
    entityType,
    sourceSystem,
    canonicalContract: buildCanonicalKpiContract(),
    normalizedBehavior: [
      "ATV, UPT, NET_SALES employee scope olarak normalize edilir.",
      "CR store scope olarak normalize edilir.",
      "sourceBatchId aynı gelirse batch reuse edilir.",
      "Yeni veri aynı KPI/scope/donem icin gelirse live state overwrite edilir.",
    ],
    requestBody,
  };
}

export function buildCanonicalKpiContract() {
  return {
    envelopeFields: [
      "sourceCode",
      "entityType",
      "fileReference",
      "idempotencyKey",
      "sourceBatchId",
      "sourcePayloadHash",
      "sourceCapturedAt",
      "sourceWindowStartedAt",
      "sourceWindowEndedAt",
    ],
    canonicalKpiRowFields: [
      "kpiCode",
      "sourceMetricId",
      "scopeType",
      "storeExternalRef",
      "employeeExternalRef",
      "actualValue",
      "achievementRate",
      "validationError",
      "targetValue",
      "periodType",
      "periodStart",
      "periodEnd",
      "sourceCapturedAt",
      "rowHash",
      "rawRowReference",
      "sourceRow",
    ],
    importedMetricCodes: [
      "NET_SALES",
      "TICKET_COUNT",
      "ITEM_COUNT",
      "FF",
      "UPT",
      "ATV",
      "CR",
      "gsm_approval",
    ],
    derivedMetricCodes: [
      "TARGET_ACHIEVEMENT",
      "WEIGHTED_PERSONNEL_SCORE",
      "WEIGHTED_STORE_SCORE",
    ],
    checklistMetricCodes: ["BM_CHECKLIST", "VM_CHECKLIST"],
    dataQualityIssueCodes: IMPORT_DATA_QUALITY_ISSUES.map(
      (issue) => issue.code,
    ),
    rules: [
      "employeeExternalRef can be empty only for store-scoped metrics",
      "source adapters map external fields into canonical rows before scoring",
      "rowHash is generated from the stable source row payload when the adapter does not provide one",
      "rawRowReference is a readable sourceSystem/metric/period/store/personnel trace key",
    ],
  };
}
