import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

const nullableString = { type: "string", nullable: true };
const decimal = { type: "string", nullable: true, pattern: "^-?\\d+(?:\\.\\d+)?$" };
const money = { type: "string", nullable: true, pattern: "^-?\\d+(?:\\.\\d{2})?$" };

export function applySalesTargetIncentiveWorkspaceOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    SalesTargetIncentiveWorkspaceCapabilities: objectSchema(
      ["canMarkStoreReview", "canCreateCorrection", "canVoidCorrection", "canSubmitPackage"],
      {
        canMarkStoreReview: { type: "boolean" },
        canCreateCorrection: { type: "boolean" },
        canVoidCorrection: { type: "boolean" },
        canSubmitPackage: { type: "boolean" },
      },
    ),
    SalesTargetIncentiveWorkspaceCorrectionActor: objectSchema(
      ["displayName", "roleCode", "identityStatus"],
      {
        displayName: nullableString,
        roleCode: { type: "string", nullable: true, enum: ["REGION_MANAGER", "HR_ADMIN", "SUPER_ADMIN"] },
        identityStatus: { type: "string", enum: ["resolved", "unavailable"] },
      },
    ),
    SalesTargetIncentiveWorkspaceCorrection: objectSchema(
      ["correctionId", "status", "beforeAmount", "adjustmentAmount", "finalAmount", "reasonNote", "createdAt", "submittedAt", "reviewedAt", "reviewNote", "actor"],
      {
        correctionId: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["draft", "submitted", "admin_approved", "admin_returned", "voided"] },
        beforeAmount: { type: "string" },
        adjustmentAmount: { type: "string" },
        finalAmount: { type: "string" },
        reasonNote: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        submittedAt: { type: "string", format: "date-time", nullable: true },
        reviewedAt: { type: "string", format: "date-time", nullable: true },
        reviewNote: nullableString,
        actor: ref("SalesTargetIncentiveWorkspaceCorrectionActor"),
      },
    ),
    SalesTargetIncentiveWorkspaceRateBracket: objectSchema(
      ["minAchievementPct", "maxAchievementPct", "rate", "displayLabel"],
      { minAchievementPct: nullableString, maxAchievementPct: nullableString, rate: { type: "string" }, displayLabel: { type: "string" } },
    ),
    SalesTargetIncentiveWorkspaceRateTable: objectSchema(
      ["audience", "version", "brackets"],
      {
        audience: { type: "string", enum: ["manager", "personnel"] },
        version: { type: "string" },
        brackets: arrayRef("SalesTargetIncentiveWorkspaceRateBracket"),
      },
    ),
    SalesTargetIncentiveWorkspaceRateMetadata: objectSchema(
      ["status", "ruleVersionCode", "effectiveFrom", "periodTimezone", "bracketBoundaryPolicy", "tables"],
      {
        status: { type: "string", enum: ["resolved", "unresolved"] },
        ruleVersionCode: nullableString,
        effectiveFrom: { type: "string", format: "date", nullable: true },
        periodTimezone: { type: "string" },
        bracketBoundaryPolicy: { type: "string", nullable: true, enum: ["lower_inclusive_upper_exclusive"] },
        tables: arrayRef("SalesTargetIncentiveWorkspaceRateTable"),
      },
    ),
    SalesTargetIncentiveWorkspaceRow: objectSchema(
      ["employeeId", "displayName", "participantType", "positionCode", "target", "actual", "achievementPct", "rate", "calculatedAmount", "finalAmount", "signedDifferenceAmount", "status", "correction", "correctionRecords"],
      {
        employeeId: { type: "string", format: "uuid" }, displayName: { type: "string" },
        participantType: { type: "string", enum: ["store_manager", "personnel"] }, positionCode: { type: "string" },
        target: decimal, actual: decimal, achievementPct: decimal, rate: decimal,
        calculatedAmount: money, finalAmount: money, signedDifferenceAmount: money,
        status: { type: "string", enum: ["projected", "blocked", "no_source", "corrected", "adjusted"] },
        correction: { ...ref("SalesTargetIncentiveWorkspaceCorrection"), nullable: true },
        correctionRecords: arrayRef("SalesTargetIncentiveWorkspaceCorrection"),
      },
    ),
    SalesTargetIncentiveWorkspaceStore: objectSchema(
      ["storeId", "storeCode", "storeName", "city", "storeTarget", "storeActualNetSales", "storeAchievementPct", "capabilities", "review", "rows"],
      {
        storeId: { type: "string", format: "uuid" }, storeCode: nullableString, storeName: { type: "string" }, city: nullableString,
        storeTarget: decimal, storeActualNetSales: decimal, storeAchievementPct: decimal,
        capabilities: objectSchema(["canMarkStoreReview", "canCreateCorrection", "canVoidCorrection"], {
          canMarkStoreReview: { type: "boolean" }, canCreateCorrection: { type: "boolean" }, canVoidCorrection: { type: "boolean" },
        }),
        review: objectSchema(["status", "reviewedAt", "periodCloseStatus"], {
          status: { type: "string", enum: ["pending_review", "reviewed"] },
          reviewedAt: { type: "string", format: "date-time", nullable: true },
          periodCloseStatus: { type: "string", enum: ["projection_only", "closed"] },
        }),
        rows: arrayRef("SalesTargetIncentiveWorkspaceRow"),
      },
    ),
    SalesTargetIncentiveWorkspaceRegion: objectSchema(
      ["regionId", "regionName", "regionManager", "capabilities", "package", "stores"],
      {
        regionId: { type: "string", format: "uuid" }, regionName: nullableString,
        regionManager: objectSchema(["displayName"], { displayName: nullableString }),
        capabilities: objectSchema(["canSubmitPackage"], { canSubmitPackage: { type: "boolean" } }),
        package: objectSchema(["status", "submittedAt", "reviewedAt", "reviewNote"], {
          status: { type: "string", enum: ["not_submitted", "submitted", "admin_approved", "admin_returned"] },
          submittedAt: { type: "string", format: "date-time", nullable: true },
          reviewedAt: { type: "string", format: "date-time", nullable: true }, reviewNote: nullableString,
        }),
        stores: arrayRef("SalesTargetIncentiveWorkspaceStore"),
      },
    ),
    SalesTargetIncentiveWorkspace: objectSchema(
      ["period", "periodStart", "periodEnd", "periodTimezone", "view", "capabilities", "rateMetadata", "regions"],
      {
        period: { type: "string" }, periodStart: { type: "string", format: "date" }, periodEnd: { type: "string", format: "date" },
        periodTimezone: { type: "string" }, view: { type: "string", enum: ["report_viewer", "region_manager"] },
        capabilities: ref("SalesTargetIncentiveWorkspaceCapabilities"), rateMetadata: ref("SalesTargetIncentiveWorkspaceRateMetadata"),
        regions: arrayRef("SalesTargetIncentiveWorkspaceRegion"),
      },
    ),
    SalesTargetIncentiveWorkspaceResponse: objectSchema(["data"], { data: ref("SalesTargetIncentiveWorkspace") }),
  };

  const path = "/api/store/incentives/workspace";
  setJsonResponseSchema(document.paths, path, "get", "Role-scoped Incentives command workspace.", "SalesTargetIncentiveWorkspaceResponse");
  setQueryParameters(document.paths, path, "get", [{ name: "period", in: "query", required: false, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } }]);
}

function objectSchema(required: string[], properties: Record<string, unknown>) {
  return { type: "object", required, properties };
}
function ref(name: string) { return { $ref: `#/components/schemas/${name}` }; }
function arrayRef(name: string) { return { type: "array", items: ref(name) }; }
