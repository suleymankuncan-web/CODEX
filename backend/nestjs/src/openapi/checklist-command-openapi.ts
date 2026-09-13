import { setJsonRequestSchema, setJsonResponseSchema, type MutablePathItem } from "./openapi-schema-helpers";
import {
  checklistVisitPlanVisitCompletionResponseSchema,
  completeChecklistVisitPlanItemRequestSchema,
  queryParameter,
  requiredQueryParameter,
  setQueryParameters,
} from "./checklist-command-openapi-visit-completion";
import {
  checklistVisitPlanPeriodSorts,
  checklistVisitPlanPeriodStatuses,
  checklistVisitPlanReasons,
  checklistVisitPlanRisks,
} from "../modules/store-ops/application/checklist-visit-plan.contract";
import {
  checklistVisitPlanRegionOptionResponseSchema,
  checklistVisitPlanRegionOptionSchema,
} from "./checklist-visit-plan-region-option-openapi";
import { applyChecklistOperationalHistoryOpenApi } from "./checklist-operational-history-openapi";
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
  "bm_score_asc",
  "bm_score_desc",
  "vm_score_desc",
  "last_visit_asc",
  "last_visit_desc",
  "elapsed_asc",
  "elapsed_desc",
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
    "activeBmChecklistCount",
    "activeVmChecklistCount",
    "pendingAcknowledgementCount",
    "pendingBmAcknowledgementCount",
    "pendingVmAcknowledgementCount",
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
    activeBmChecklistCount: { type: "integer", minimum: 0 },
    activeVmChecklistCount: { type: "integer", minimum: 0 },
    pendingAcknowledgementCount: { type: "integer", minimum: 0 },
    pendingBmAcknowledgementCount: { type: "integer", minimum: 0 },
    pendingVmAcknowledgementCount: { type: "integer", minimum: 0 },
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
    "managerUserId", "regionId",
    "regionName",
    "regionManagers",
    "metrics",
    "visitAverageScore",
    "scoreSampleCount",
    "lastOperationalAt",
  ],
  properties: {
    managerUserId: { type: "string", format: "uuid" }, regionId: { type: "string", format: "uuid", nullable: true },
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
    "status", "checklistInstanceId", "visitCompletedAt", "completedAt",
  ],
  properties: {
    planItemId: { type: "string", format: "uuid" },
    storeId: { type: "string", format: "uuid" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    plannedDate: { type: "string", format: "date" },
    displayOrder: { type: "integer", minimum: 0 },
    status: { type: "string", enum: ["planned", "waiting", "missed", "completed"] },
    checklistInstanceId: { type: "string", format: "uuid", nullable: true },
    visitCompletedAt: { type: "string", format: "date-time", nullable: true },
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

const checklistVisitPlanPeriodItemSchema = {
  allOf: [
    { $ref: "#/components/schemas/ChecklistVisitPlanItem" },
    {
      type: "object",
      required: ["planId", "revision", "weekStart"],
      properties: {
        planId: { type: "string", format: "uuid" },
        revision: { type: "integer", minimum: 1 },
        weekStart: { type: "string", format: "date" },
      },
    },
  ],
};

const checklistVisitPlanPeriodRowSchema = {
  type: "object",
  required: [
    "storeId", "storeCode", "storeName", "regionId", "regionName", "bmScore", "vmScore",
    "lastCompletedVisitAt", "elapsedDaysSinceLastVisit", "risk", "reasonCodes", "planStatus", "planItems",
  ],
  properties: {
    storeId: { type: "string", format: "uuid" },
    storeCode: { type: "string" },
    storeName: { type: "string" },
    regionId: { type: "string", format: "uuid" },
    regionName: { type: "string" },
    bmScore: { type: "number", nullable: true },
    vmScore: { type: "number", nullable: true },
    lastCompletedVisitAt: { type: "string", format: "date-time", nullable: true },
    elapsedDaysSinceLastVisit: { type: "integer", minimum: 0, nullable: true },
    risk: { type: "string", enum: checklistVisitPlanRisks.filter((value) => value !== "all") },
    reasonCodes: {
      type: "array",
      items: { type: "string", enum: checklistVisitPlanReasons.filter((value) => value !== "all") },
    },
    planStatus: { type: "string", enum: checklistVisitPlanPeriodStatuses.filter((value) => value !== "all") },
    planItems: { type: "array", items: { $ref: "#/components/schemas/ChecklistVisitPlanPeriodItem" } },
  },
};

const pageSchema = {
  type: "object",
  required: ["total", "limit", "offset", "hasMore"],
  properties: {
    total: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    hasMore: { type: "boolean" },
  },
};

const checklistVisitPlanPeriodResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["period", "regionId", "regionName", "view", "capabilities", "metrics", "items", "page"],
      properties: {
        period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        regionId: { type: "string", format: "uuid" },
        regionName: { type: "string" },
        view: { type: "string", enum: ["region_manager"] },
        capabilities: {
          type: "object",
          required: ["canMaintainWeeklyVisitPlan"],
          properties: { canMaintainWeeklyVisitPlan: { type: "boolean", enum: [true] } },
        },
        metrics: {
          type: "object",
          required: ["totalStores", "high", "medium", "low", "planned", "unplanned", "waiting", "missed", "completed"],
          properties: Object.fromEntries(
            ["totalStores", "high", "medium", "low", "planned", "unplanned", "waiting", "missed", "completed"]
              .map((name) => [name, { type: "integer", minimum: 0 }]),
          ),
        },
        items: { type: "array", items: { $ref: "#/components/schemas/ChecklistVisitPlanPeriodRow" } },
        page: pageSchema,
      },
    },
  },
};

const checklistVisitPlanCandidateResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["regionId", "view", "items", "page"],
      properties: {
        regionId: { type: "string", format: "uuid" },
        view: { type: "string", enum: ["region_manager"] },
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["storeId", "storeCode", "storeName", "regionId", "regionName"],
            properties: {
              storeId: { type: "string", format: "uuid" },
              storeCode: { type: "string" },
              storeName: { type: "string" },
              regionId: { type: "string", format: "uuid" },
              regionName: { type: "string" },
            },
          },
        },
        page: pageSchema,
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
    CompleteChecklistVisitPlanItemRequest: completeChecklistVisitPlanItemRequestSchema,
    ChecklistVisitPlanVisitCompletionResponse: checklistVisitPlanVisitCompletionResponseSchema,
    ChecklistVisitPlanPeriodItem: checklistVisitPlanPeriodItemSchema,
    ChecklistVisitPlanPeriodRow: checklistVisitPlanPeriodRowSchema,
    ChecklistVisitPlanPeriodResponse: checklistVisitPlanPeriodResponseSchema,
    ChecklistVisitPlanCandidateResponse: checklistVisitPlanCandidateResponseSchema,
    ChecklistVisitPlanRegionOption: checklistVisitPlanRegionOptionSchema,
    ChecklistVisitPlanRegionOptionResponse: checklistVisitPlanRegionOptionResponseSchema,
  };
  applyChecklistOperationalHistoryOpenApi(document);

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
    queryParameter("managerUserId", { type: "string", format: "uuid" }), queryParameter("regionId", { type: "string", format: "uuid" }),
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
    "Company-scoped checklist command manager aggregates for Report Viewer.",
    "ChecklistCommandRegionResponse",
  );
  setQueryParameters(document.paths, regionsPath, "get", [
    queryParameter("period", { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }),
    queryParameter("query", { type: "string", maxLength: 120 }),
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
    queryParameter("regionId", { type: "string", format: "uuid" }), queryParameter("managerUserId", { type: "string", format: "uuid" }),
    requiredQueryParameter("weekStart", { type: "string", format: "date" }),
  ]);

  const visitPlanRegionsPath = "/api/checklists/command-canvas/visit-plans/regions";
  setJsonResponseSchema(
    document.paths,
    visitPlanRegionsPath,
    "get",
    "Named active regions from the authenticated Region Manager role scope.",
    "ChecklistVisitPlanRegionOptionResponse",
  );
  setQueryParameters(document.paths, visitPlanRegionsPath, "get", [
    queryParameter("query", { type: "string", maxLength: 120 }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 50 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
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

  const completeVisitPath = "/api/checklists/command-canvas/visit-plans/items/{planItemId}/complete";
  setJsonRequestSchema(document.paths, completeVisitPath, "post", "CompleteChecklistVisitPlanItemRequest");
  setJsonResponseSchema(
    document.paths,
    completeVisitPath,
    "post",
    "Record Region Manager attendance for a planned BM visit without changing checklist outcomes.",
    "ChecklistVisitPlanVisitCompletionResponse",
    "201",
  );
  const completeVisitOperation = (document.paths[completeVisitPath] as MutablePathItem | undefined)?.post;
  if (completeVisitOperation) {
    completeVisitOperation.parameters = (completeVisitOperation.parameters ?? []).map((parameter) =>
      parameter.name === "planItemId"
        ? { ...parameter, schema: { type: "string", format: "uuid" } }
        : parameter,
    );
  }

  const periodPlanPath = "/api/checklists/command-canvas/visit-plans/period";
  setJsonResponseSchema(
    document.paths,
    periodPlanPath,
    "get",
    "Region-scoped full-period visit planning facts and authoritative risk rows.",
    "ChecklistVisitPlanPeriodResponse",
  );
  setQueryParameters(document.paths, periodPlanPath, "get", [
    requiredQueryParameter("regionId", { type: "string", format: "uuid" }),
    requiredQueryParameter("period", { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }),
    queryParameter("query", { type: "string", maxLength: 120 }),
    queryParameter("risk", { type: "string", enum: checklistVisitPlanRisks }),
    queryParameter("reason", { type: "string", enum: checklistVisitPlanReasons }),
    queryParameter("planStatus", { type: "string", enum: checklistVisitPlanPeriodStatuses }),
    queryParameter("sort", { type: "string", enum: checklistVisitPlanPeriodSorts }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 100 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);

  const candidatesPath = "/api/checklists/command-canvas/visit-plans/candidates";
  setJsonResponseSchema(
    document.paths,
    candidatesPath,
    "get",
    "Bounded active-store search for the assigned Region Manager planning scope.",
    "ChecklistVisitPlanCandidateResponse",
  );
  setQueryParameters(document.paths, candidatesPath, "get", [
    requiredQueryParameter("regionId", { type: "string", format: "uuid" }),
    queryParameter("query", { type: "string", maxLength: 120 }),
    queryParameter("limit", { type: "integer", minimum: 1, maximum: 50 }),
    queryParameter("offset", { type: "integer", minimum: 0 }),
  ]);
}
