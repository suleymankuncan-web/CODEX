import {
  setJsonResponseSchema,
  type MutablePathItem,
} from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

const statusEnum = ["needs_visit", "active", "pending", "completed"];
const statusQueryEnum = ["all", ...statusEnum];
const sortEnum = [
  "store_asc",
  "store_desc",
  "bm_score_desc",
  "vm_score_desc",
  "last_visit_asc",
  "last_visit_desc",
  "open_actions_desc",
  "status_asc",
  "status_desc",
];

const regionManagerSchema = {
  type: "object",
  required: ["displayName"],
  properties: { displayName: { type: "string" } },
};

const checklistCommandRowSchema = {
  type: "object",
  required: [
    "storeId",
    "storeCode",
    "storeName",
    "regionId",
    "regionName",
    "regionManagers",
    "bmScore",
    "vmScore",
    "bmCompletedAt",
    "vmCompletedAt",
    "lastCompletedVisitAt",
    "elapsedDaysSinceLastVisit",
    "activeChecklistCount",
    "pendingAcknowledgementCount",
    "openActionCount",
    "blockedActionCount",
    "status",
    "reasonCodes",
    "lastOperationalAt",
  ],
  properties: {
    storeId: { type: "string" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    regionId: { type: "string" },
    regionName: { type: "string" },
    regionManagers: { type: "array", items: regionManagerSchema },
    bmScore: { type: "number", nullable: true },
    vmScore: { type: "number", nullable: true },
    bmCompletedAt: { type: "string", format: "date-time", nullable: true },
    vmCompletedAt: { type: "string", format: "date-time", nullable: true },
    lastCompletedVisitAt: { type: "string", format: "date-time", nullable: true },
    elapsedDaysSinceLastVisit: { type: "integer", minimum: 0, nullable: true },
    activeChecklistCount: { type: "integer", minimum: 0 },
    pendingAcknowledgementCount: { type: "integer", minimum: 0 },
    openActionCount: { type: "integer", minimum: 0 },
    blockedActionCount: { type: "integer", minimum: 0 },
    status: { type: "string", enum: statusEnum },
    reasonCodes: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "active_checklist",
          "pending_acknowledgement",
          "missing_bm_visit",
          "missing_vm_visit",
          "open_actions",
          "completed_period",
        ],
      },
    },
    lastOperationalAt: { type: "string", format: "date-time", nullable: true },
  },
};

const checklistCommandResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["period", "view", "capabilities", "metrics", "items", "page"],
      properties: {
        period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        view: {
          type: "string",
          enum: [
            "report_viewer",
            "region_manager",
            "store_manager",
            "visual_merchandiser",
            "super_admin",
          ],
        },
        capabilities: {
          type: "object",
          required: ["weeklyVisitPlanningAvailable", "canMaintainWeeklyVisitPlan"],
          properties: {
            weeklyVisitPlanningAvailable: { type: "boolean" },
            canMaintainWeeklyVisitPlan: { type: "boolean" },
          },
        },
        metrics: {
          type: "object",
          required: ["totalStores", "needsVisit", "active", "pending", "completed"],
          properties: Object.fromEntries(
            ["totalStores", "needsVisit", "active", "pending", "completed"].map((name) => [
              name,
              { type: "integer", minimum: 0 },
            ]),
          ),
        },
        items: { type: "array", items: { $ref: "#/components/schemas/ChecklistCommandRow" } },
        page: {
          type: "object",
          required: ["total", "limit", "offset", "hasMore"],
          properties: {
            total: { type: "integer", minimum: 0 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            offset: { type: "integer", minimum: 0 },
            hasMore: { type: "boolean" },
          },
        },
      },
    },
  },
};

export function applyChecklistCommandOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ChecklistCommandRow: checklistCommandRowSchema,
    ChecklistCommandResponse: checklistCommandResponseSchema,
  };

  const path = "/api/checklists/command-canvas";
  setJsonResponseSchema(
    document.paths,
    path,
    "get",
    "Scoped checklist command rows and metrics for the authenticated store persona.",
    "ChecklistCommandResponse",
  );
  setQueryParameters(document.paths, path, "get", [
    queryParameter("period", { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }),
    queryParameter("regionId", { type: "string", format: "uuid" }),
    queryParameter("query", { type: "string", maxLength: 120 }),
    queryParameter("status", { type: "string", enum: statusQueryEnum }),
    queryParameter("sort", { type: "string", enum: sortEnum }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);
}

function queryParameter(name: string, schema: Record<string, unknown>) {
  return { name, in: "query", required: false, schema };
}

function setQueryParameters(
  paths: Record<string, unknown>,
  path: string,
  method: string,
  parameters: Array<Record<string, unknown>>,
) {
  const operation = (paths[path] as MutablePathItem | undefined)?.[method];
  if (!operation) return;
  operation.parameters = [
    ...(operation.parameters ?? []).filter((parameter) => parameter.in !== "query"),
    ...parameters,
  ];
}
