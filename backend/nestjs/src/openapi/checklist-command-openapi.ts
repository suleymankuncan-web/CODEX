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
const signalEnum = ["all", "missing_visit", "open_actions", "completed_coverage"];
const regionSortEnum = [
  "manager_asc",
  "manager_desc",
  "stores_desc",
  "missing_desc",
  "open_actions_desc",
  "score_desc",
];
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

const checklistCommandRegionMetricsSchema = {
  type: "object",
  required: [
    "totalStores",
    "missingVisitStores",
    "storesWithOpenActions",
    "openActionCount",
    "completedCoverageStores",
  ],
  properties: Object.fromEntries(
    [
      "totalStores",
      "missingVisitStores",
      "storesWithOpenActions",
      "openActionCount",
      "completedCoverageStores",
    ].map((name) => [name, { type: "integer", minimum: 0 }]),
  ),
};

const checklistCommandRegionRowSchema = {
  type: "object",
  required: [
    "regionId",
    "regionName",
    "regionManagers",
    "metrics",
    "visitAverageScore",
    "scoreSampleCount",
    "lastOperationalAt",
  ],
  properties: {
    regionId: { type: "string", format: "uuid" },
    regionName: { type: "string" },
    regionManagers: { type: "array", items: regionManagerSchema },
    metrics: {
      allOf: [
        { $ref: "#/components/schemas/ChecklistCommandRegionMetrics" },
        {
          type: "object",
          required: ["blockedActionCount"],
          properties: { blockedActionCount: { type: "integer", minimum: 0 } },
        },
      ],
    },
    visitAverageScore: { type: "number", nullable: true },
    scoreSampleCount: { type: "integer", minimum: 0 },
    lastOperationalAt: { type: "string", format: "date-time", nullable: true },
  },
};

const checklistCommandRegionResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["period", "view", "capabilities", "metrics", "items", "page"],
      properties: {
        period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        view: { type: "string", enum: ["report_viewer"] },
        capabilities: {
          type: "object",
          required: ["weeklyVisitPlanningAvailable", "canMaintainWeeklyVisitPlan"],
          properties: {
            weeklyVisitPlanningAvailable: { type: "boolean", enum: [false] },
            canMaintainWeeklyVisitPlan: { type: "boolean", enum: [false] },
          },
        },
        metrics: { $ref: "#/components/schemas/ChecklistCommandRegionMetrics" },
        items: { type: "array", items: { $ref: "#/components/schemas/ChecklistCommandRegionRow" } },
        page: checklistCommandResponseSchema.properties.data.properties.page,
      },
    },
  },
};

const checklistVisitPlanItemSchema = {
  type: "object",
  required: [
    "planItemId", "storeId", "storeCode", "storeName", "plannedDate", "displayOrder",
    "status", "checklistInstanceId", "completedAt",
  ],
  properties: {
    planItemId: { type: "string", format: "uuid" },
    storeId: { type: "string", format: "uuid" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    plannedDate: { type: "string", format: "date" },
    displayOrder: { type: "integer", minimum: 0 },
    status: { type: "string", enum: ["waiting", "missed", "completed"] },
    checklistInstanceId: { type: "string", format: "uuid", nullable: true },
    completedAt: { type: "string", format: "date-time", nullable: true },
  },
};

const checklistVisitPlanSchema = {
  type: "object",
  required: ["planId", "regionId", "regionName", "weekStart", "revision", "revisedAt", "view", "capabilities", "items"],
  properties: {
    planId: { type: "string", format: "uuid", nullable: true },
    regionId: { type: "string", format: "uuid" },
    regionName: { type: "string" },
    weekStart: { type: "string", format: "date" },
    revision: { type: "integer", minimum: 0 },
    revisedAt: { type: "string", format: "date-time", nullable: true },
    view: { type: "string", enum: ["report_viewer", "region_manager", "store_manager"] },
    capabilities: {
      type: "object",
      required: ["canMaintainWeeklyVisitPlan"],
      properties: { canMaintainWeeklyVisitPlan: { type: "boolean" } },
    },
    items: { type: "array", items: { $ref: "#/components/schemas/ChecklistVisitPlanItem" } },
  },
};

const checklistVisitPlanResponseSchema = {
  type: "object",
  required: ["data"],
  properties: { data: { $ref: "#/components/schemas/ChecklistVisitPlan" } },
};

const saveChecklistVisitPlanRequestSchema = {
  type: "object",
  required: ["expectedRevision", "idempotencyKey", "items"],
  properties: {
    expectedRevision: { type: "integer", minimum: 0 },
    idempotencyKey: { type: "string", format: "uuid" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["storeId", "plannedDate", "displayOrder"],
        properties: {
          storeId: { type: "string", format: "uuid" },
          plannedDate: { type: "string", format: "date" },
          displayOrder: { type: "integer", minimum: 0, maximum: 10000 },
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
    ChecklistCommandRegionMetrics: checklistCommandRegionMetricsSchema,
    ChecklistCommandRegionRow: checklistCommandRegionRowSchema,
    ChecklistCommandRegionResponse: checklistCommandRegionResponseSchema,
    ChecklistVisitPlanItem: checklistVisitPlanItemSchema,
    ChecklistVisitPlan: checklistVisitPlanSchema,
    ChecklistVisitPlanResponse: checklistVisitPlanResponseSchema,
    SaveChecklistVisitPlanRequest: saveChecklistVisitPlanRequestSchema,
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
    queryParameter("signal", { type: "string", enum: signalEnum }),
    queryParameter("sort", { type: "string", enum: sortEnum }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);

  const regionsPath = "/api/checklists/command-canvas/regions";
  setJsonResponseSchema(
    document.paths,
    regionsPath,
    "get",
    "Company-scoped checklist command region aggregates for Report Viewer.",
    "ChecklistCommandRegionResponse",
  );
  setQueryParameters(document.paths, regionsPath, "get", [
    queryParameter("period", { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }),
    queryParameter("signal", { type: "string", enum: signalEnum }),
    queryParameter("sort", { type: "string", enum: regionSortEnum }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);

  const visitPlansPath = "/api/checklists/command-canvas/visit-plans";
  setJsonResponseSchema(
    document.paths,
    visitPlansPath,
    "get",
    "Scoped weekly BM visit plan with status derived from real completed checklist execution.",
    "ChecklistVisitPlanResponse",
  );
  setQueryParameters(document.paths, visitPlansPath, "get", [
    requiredQueryParameter("regionId", { type: "string", format: "uuid" }),
    requiredQueryParameter("weekStart", { type: "string", format: "date" }),
  ]);

  const saveVisitPlanPath = "/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}";
  setJsonResponseSchema(
    document.paths,
    saveVisitPlanPath,
    "put",
    "Replace one Region Manager weekly BM visit plan using optimistic concurrency and idempotency.",
    "ChecklistVisitPlanResponse",
  );
  const saveOperation = (document.paths[saveVisitPlanPath] as MutablePathItem | undefined)?.put;
  if (saveOperation) {
    saveOperation.parameters = (saveOperation.parameters ?? []).map((parameter) => {
      if (parameter.name === "regionId") {
        return { ...parameter, schema: { type: "string", format: "uuid" } };
      }
      if (parameter.name === "weekStart") {
        return { ...parameter, schema: { type: "string", format: "date" } };
      }
      return parameter;
    });
    saveOperation.requestBody = {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/SaveChecklistVisitPlanRequest" } } },
    };
  }
}

function queryParameter(name: string, schema: Record<string, unknown>) {
  return { name, in: "query", required: false, schema };
}

function requiredQueryParameter(name: string, schema: Record<string, unknown>) {
  return { name, in: "query", required: true, schema };
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
