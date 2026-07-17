import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

export function applyWorkforceWorkspaceOpenApi(document: MutableOpenApiDocument) {
  const nullableString = { type: "string", nullable: true };
  const nullableInteger = { type: "integer", nullable: true };
  const nullableNumber = { type: "number", nullable: true };
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    WorkforceWorkspaceCapabilities: objectSchema(["canCreateSellerCodeRequest", "canCreateOffboardingRequest"], {
      canCreateSellerCodeRequest: { type: "boolean" },
      canCreateOffboardingRequest: { type: "boolean" },
    }),
    WorkforceWorkspacePerson: objectSchema(
      ["employeeId", "displayName", "positionId", "positionCode", "positionName", "assignmentStartDate", "employmentStatus"],
      {
        employeeId: uuid(), displayName: { type: "string" }, positionId: uuid(),
        positionCode: { type: "string" }, positionName: { type: "string" },
        assignmentStartDate: { type: "string", format: "date", nullable: true }, employmentStatus: { type: "string" },
      },
    ),
    WorkforceWorkspaceStore: objectSchema(
      ["companyId", "companyName", "regionId", "regionName", "regionManagerName", "storeId", "storeCode", "storeName", "storeStatus", "norm", "active", "averageTenureDays", "gap", "shortageDays", "personnel", "personnelTotal", "personnelLimit", "personnelOffset", "personnelHasMore"],
      {
        companyId: uuid(), companyName: nullableString, regionId: uuid(), regionName: nullableString,
        regionManagerName: nullableString, storeId: uuid(), storeCode: { type: "string" }, storeName: { type: "string" },
        storeStatus: { type: "string" }, norm: nullableNumber, active: integer(), averageTenureDays: nullableNumber, gap: nullableNumber,
        shortageDays: nullableInteger, personnel: arrayRef("WorkforceWorkspacePerson"), personnelTotal: integer(),
        personnelLimit: { type: "integer", minimum: 1, maximum: 100 }, personnelOffset: integer(), personnelHasMore: { type: "boolean" },
      },
    ),
    WorkforceWorkspaceHistoryRow: objectSchema(
      ["employeeId", "displayName", "entryDate", "exitDate", "totalWorkingDays"],
      { employeeId: uuid(), displayName: { type: "string" }, entryDate: { type: "string", format: "date" }, exitDate: { type: "string", format: "date", nullable: true }, totalWorkingDays: nullableInteger },
    ),
    WorkforceWorkspacePagination: objectSchema(["total", "limit", "offset", "hasMore"], {
      total: integer(), limit: { type: "integer", minimum: 1, maximum: 100 }, offset: integer(), hasMore: { type: "boolean" },
    }),
    WorkforceWorkspaceStorePage: objectSchema(["items", "total", "limit", "offset", "hasMore"], {
      items: arrayRef("WorkforceWorkspaceStore"), total: integer(), limit: { type: "integer", minimum: 1, maximum: 100 }, offset: integer(), hasMore: { type: "boolean" },
    }),
    WorkforceWorkspaceHistory: objectSchema(["storeId", "items", "total", "limit", "offset", "hasMore"], {
      storeId: uuid(), items: arrayRef("WorkforceWorkspaceHistoryRow"), total: integer(), limit: { type: "integer", minimum: 1, maximum: 100 }, offset: integer(), hasMore: { type: "boolean" },
    }),
    WorkforceWorkspaceSummary: objectSchema(["totalStores", "activePersonnel", "shortageStores", "openPositions", "averageTenureDays"], {
      totalStores: integer(), activePersonnel: integer(), shortageStores: integer(), openPositions: { type: "number", minimum: 0 }, averageTenureDays: nullableNumber,
    }),
    WorkforceWorkspace: objectSchema(["view", "summary", "stores", "history", "capabilities"], {
      view: { type: "string", enum: ["report_viewer", "region_manager", "store_manager"] },
      summary: ref("WorkforceWorkspaceSummary"), stores: ref("WorkforceWorkspaceStorePage"),
      history: { ...ref("WorkforceWorkspaceHistory"), nullable: true }, capabilities: ref("WorkforceWorkspaceCapabilities"),
    }),
    WorkforceWorkspaceResponse: objectSchema(["data"], { data: ref("WorkforceWorkspace") }),
  };

  const path = "/api/store/workforce/workspace";
  setJsonResponseSchema(document.paths, path, "get", "Role-scoped bounded Workforce command workspace.", "WorkforceWorkspaceResponse");
  setQueryParameters(document.paths, path, "get", [
    { name: "q", in: "query", required: false, schema: { type: "string", maxLength: 100 } },
    { name: "status", in: "query", required: false, schema: { type: "string", enum: ["all", "shortage", "balanced", "surplus", "unconfigured"] } },
    { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["store", "active", "norm", "status", "shortage", "tenure"] } },
    { name: "direction", in: "query", required: false, schema: { type: "string", enum: ["ascending", "descending"] } },
    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
    { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
    { name: "historyLimit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
    { name: "historyOffset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
    { name: "historyStoreId", in: "query", required: false, schema: { type: "string", format: "uuid" } },
    { name: "personnelStoreId", in: "query", required: false, schema: { type: "string", format: "uuid" } },
    { name: "personnelLimit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } },
    { name: "personnelOffset", in: "query", required: false, schema: { type: "integer", minimum: 0 } },
  ]);
}

function objectSchema(required: string[], properties: Record<string, unknown>) { return { type: "object", required, properties }; }
function ref(name: string) { return { $ref: `#/components/schemas/${name}` }; }
function arrayRef(name: string) { return { type: "array", items: ref(name) }; }
function integer() { return { type: "integer", minimum: 0 }; }
function uuid() { return { type: "string", format: "uuid" }; }
