import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

const nullableString = { type: "string", nullable: true };
const decimal = { type: "string", nullable: true, pattern: "^-?\\d+(?:\\.\\d+)?$" };
const requiredDecimal = { type: "string", pattern: "^-?\\d+(?:\\.\\d+)?$" };

export function applyTargetWorkspaceOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    TargetWorkspaceCapabilities: objectSchema(["canCreateRequest", "canApproveRequest"], {
      canCreateRequest: { type: "boolean" }, canApproveRequest: { type: "boolean" },
    }),
    TargetWorkspaceMonthStatus: objectSchema(["period", "status", "approvalStatus", "isApproved"], {
      period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
      status: { type: "string", enum: ["pending", "approved", "adjusted_approved", "returned", "unknown"] },
      approvalStatus: { type: "string", nullable: true, enum: ["approved", "adjusted_approved"] },
      isApproved: { type: "boolean" },
    }),
    TargetWorkspacePersonnel: objectSchema(
      ["employeeId", "displayName", "positionCode", "positionLabel", "targetValue", "eligibilityStatus"],
      {
        employeeId: { type: "string", format: "uuid" }, displayName: { type: "string" },
        positionCode: nullableString, positionLabel: nullableString, targetValue: decimal,
        eligibilityStatus: { type: "string", enum: ["targetable", "historical_allocation"] },
      },
    ),
    TargetWorkspaceAllocation: objectSchema(["employeeId", "displayName", "targetValue", "note"], {
      employeeId: { type: "string", format: "uuid" }, displayName: { type: "string" },
      targetValue: { type: "string", pattern: "^-?\\d+(?:\\.\\d+)?$" }, note: nullableString,
    }),
    TargetWorkspaceRequest: objectSchema(
      ["requestId", "status", "targetLabel", "totalTargetValue", "allocationCount", "requestReason", "approvalMode", "approvedAt", "approvalNote", "createdAt", "updatedAt", "allocations"],
      {
        requestId: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["pending_region_approval", "approved", "rejected", "unknown"] },
        targetLabel: { type: "string" }, totalTargetValue: requiredDecimal,
        allocationCount: { type: "integer", minimum: 0 }, requestReason: nullableString,
        approvalMode: { type: "string", nullable: true, enum: ["direct", "adjusted"] },
        approvedAt: { type: "string", format: "date-time", nullable: true }, approvalNote: nullableString,
        createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
        allocations: arrayRef("TargetWorkspaceAllocation"),
      },
    ),
    TargetWorkspaceStore: objectSchema(
      ["storeId", "storeCode", "storeName", "city", "storeStatus", "status", "capabilities", "request", "personnel", "monthStatuses"],
      {
        storeId: { type: "string", format: "uuid" }, storeCode: { type: "string" }, storeName: { type: "string" },
        city: nullableString, storeStatus: { type: "string" },
        status: { type: "string", enum: ["pending", "approved", "adjusted_approved", "returned", "revision_conflict", "stale_reference", "missing", "unknown"] },
        capabilities: ref("TargetWorkspaceCapabilities"),
        request: { ...ref("TargetWorkspaceRequest"), nullable: true },
        personnel: arrayRef("TargetWorkspacePersonnel"), monthStatuses: arrayRef("TargetWorkspaceMonthStatus"),
      },
    ),
    TargetWorkspaceRegionManager: objectSchema(["displayName", "identityStatus"], {
      displayName: nullableString, identityStatus: { type: "string", enum: ["resolved", "unassigned", "unavailable"] },
    }),
    TargetWorkspaceRegion: objectSchema(["regionId", "regionName", "regionManager", "stores"], {
      regionId: { type: "string", format: "uuid" }, regionName: nullableString,
      regionManager: ref("TargetWorkspaceRegionManager"), stores: arrayRef("TargetWorkspaceStore"),
    }),
    TargetWorkspaceCompany: objectSchema(["companyId", "companyName", "regions"], {
      companyId: { type: "string", format: "uuid" }, companyName: nullableString,
      regions: arrayRef("TargetWorkspaceRegion"),
    }),
    TargetWorkspacePagination: objectSchema(["total", "limit", "offset", "hasMore"], {
      total: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 100 },
      offset: { type: "integer", minimum: 0 }, hasMore: { type: "boolean" },
    }),
    TargetWorkspaceSummary: objectSchema(
      ["totalStores", "pendingStores", "approvedStores", "adjustedApprovedStores", "returnedStores", "missingStores", "totalTargetValue"],
      {
        totalStores: integer(), pendingStores: integer(), approvedStores: integer(),
        adjustedApprovedStores: integer(), returnedStores: integer(), missingStores: integer(),
        totalTargetValue: requiredDecimal,
      },
    ),
    TargetWorkspaceSection: objectSchema(["status"], {
      status: { type: "string", enum: ["available", "unavailable"] },
    }),
    TargetWorkspaceSections: objectSchema(["hierarchy", "summary", "personnel", "monthStatuses"], {
      hierarchy: ref("TargetWorkspaceSection"),
      summary: ref("TargetWorkspaceSection"),
      personnel: ref("TargetWorkspaceSection"),
      monthStatuses: ref("TargetWorkspaceSection"),
    }),
    TargetWorkspace: objectSchema(
      ["period", "periodStart", "periodEnd", "periodTimezone", "historyYear", "view", "capabilities", "pagination", "sections", "warnings", "summary", "companies"],
      {
        period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        periodStart: { type: "string", format: "date" }, periodEnd: { type: "string", format: "date" },
        periodTimezone: { type: "string", enum: ["Europe/Istanbul"] }, historyYear: { type: "integer" },
        view: { type: "string", enum: ["report_viewer", "region_manager", "store_manager"] },
        capabilities: ref("TargetWorkspaceCapabilities"), pagination: ref("TargetWorkspacePagination"),
        sections: ref("TargetWorkspaceSections"),
        warnings: {
          type: "array",
          items: { type: "string", enum: ["hierarchy_unavailable", "summary_unavailable", "personnel_unavailable", "month_statuses_unavailable", "approval_basis_conflict"] },
        },
        summary: { ...ref("TargetWorkspaceSummary"), nullable: true }, companies: arrayRef("TargetWorkspaceCompany"),
      },
    ),
    TargetWorkspaceResponse: objectSchema(["data"], { data: ref("TargetWorkspace") }),
  };

  const path = "/api/store/targets/workspace";
  setJsonResponseSchema(document.paths, path, "get", "Role-scoped Targets command workspace.", "TargetWorkspaceResponse");
  setQueryParameters(document.paths, path, "get", [
    { name: "period", in: "query", required: false, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } },
    { name: "historyYear", in: "query", required: false, schema: { type: "integer", minimum: 2000, maximum: 2100 } },
    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
    { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
  ]);
}

function objectSchema(required: string[], properties: Record<string, unknown>) { return { type: "object", required, properties }; }
function ref(name: string) { return { $ref: `#/components/schemas/${name}` }; }
function arrayRef(name: string) { return { type: "array", items: ref(name) }; }
function integer() { return { type: "integer", minimum: 0 }; }
