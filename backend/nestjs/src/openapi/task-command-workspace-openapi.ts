import { setJsonResponseSchema, setQueryParameters } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

export function applyTaskCommandWorkspaceOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    TaskCommandCapabilities: object(["canStart", "canUpdate", "canComplete", "canCancel", "canReview"], {
      canStart: boolean(), canUpdate: boolean(), canComplete: boolean(), canCancel: boolean(), canReview: boolean(),
    }),
    TaskCommandAuditEvent: object(
      ["eventId", "eventType", "occurredAt", "actorDisplayName", "actorRoleLabel", "note"],
      {
        eventId: { type: "string" }, eventType: { type: "string" },
        occurredAt: { type: "string", format: "date-time" }, actorDisplayName: { type: "string" },
        actorRoleLabel: nullableString(), note: nullableString(),
      },
    ),
    TaskCommandAuditPage: object(["items", "total", "limit", "offset"], {
      items: arrayRef("TaskCommandAuditEvent"), total: integer(),
      limit: boundedInteger(), offset: integer(),
    }),
    TaskCommandAuditPreview: object(["items", "total", "limit", "hasMore"], {
      items: arrayRef("TaskCommandAuditEvent"), total: integer(),
      limit: integer(), hasMore: boolean(),
    }),
    TaskCommandSource: object(["type", "id", "deepLink"], {
      type: { type: "string", enum: ["kpi_exception", "checklist_remediation"] },
      id: { type: "string" },
      deepLink: { type: "string", nullable: true, pattern: "^/store/(checklists|kpis)(\\?.*)?$" },
    }),
    TaskCommandWorkspaceItem: object(
      ["actionPlanId", "storeId", "storeName", "title", "summary", "priority", "status", "dueOn", "createdAt", "updatedAt", "completedAt", "resultNote", "photoEvidenceVersion", "currentSolutionAttemptId", "resolutionWorkflowVersion", "source", "events"],
      {
        actionPlanId: uuid(), storeId: uuid(), storeName: nullableString(), title: { type: "string" },
        summary: nullableString(), priority: { type: "string", enum: ["high", "medium", "low"] },
        status: { type: "string", enum: ["open", "in_progress", "blocked", "solution_review_pending", "correction_required", "closed", "cancelled"] },
        dueOn: { type: "string", format: "date" }, createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        completedAt: { type: "string", format: "date-time", nullable: true },
        resultNote: nullableString(), photoEvidenceVersion: integer(),
        currentSolutionAttemptId: { type: "string", format: "uuid", nullable: true },
        resolutionWorkflowVersion: { type: "integer", enum: [1, 2] }, source: ref("TaskCommandSource"),
        events: ref("TaskCommandAuditPreview"),
      },
    ),
    TaskCommandSummary: object(["retained", "actionable", "completed", "cancelled", "checklist"], {
      retained: integer(), actionable: integer(), completed: integer(), cancelled: integer(), checklist: integer(),
    }),
    TaskCommandPage: object(["total", "limit", "offset", "count", "hasMore"], {
      total: integer(), limit: boundedInteger(), offset: integer(), count: integer(), hasMore: boolean(),
    }),
    TaskCommandWorkspace: object(["view", "capabilities", "items", "summary", "page"], {
      view: { type: "string", enum: ["report_viewer", "region_manager", "store_manager"] },
      capabilities: ref("TaskCommandCapabilities"), items: arrayRef("TaskCommandWorkspaceItem"),
      summary: ref("TaskCommandSummary"), page: ref("TaskCommandPage"),
    }),
    TaskCommandWorkspaceResponse: object(["data"], { data: ref("TaskCommandWorkspace") }),
    TaskCommandAuditPageResponse: object(["data"], { data: ref("TaskCommandAuditPage") }),
  };

  const workspacePath = "/api/store/tasks/workspace";
  setJsonResponseSchema(document.paths, workspacePath, "get", "Role-scoped bounded task command workspace.", "TaskCommandWorkspaceResponse");
  setQueryParameters(document.paths, workspacePath, "get", [
    { name: "periodStart", in: "query", required: true, schema: { type: "string", format: "date" } },
    { name: "periodEnd", in: "query", required: true, schema: { type: "string", format: "date" } },
    { name: "regionManagerUserId", in: "query", required: false, schema: uuid() },
    { name: "limit", in: "query", required: false, schema: boundedInteger() },
    { name: "offset", in: "query", required: false, schema: integer() },
  ]);
  const eventPath = "/api/store/tasks/{actionPlanId}/events";
  setJsonResponseSchema(document.paths, eventPath, "get", "Scoped bounded task audit trail.", "TaskCommandAuditPageResponse");
  setQueryParameters(document.paths, eventPath, "get", [
    { name: "limit", in: "query", required: false, schema: boundedInteger() },
    { name: "offset", in: "query", required: false, schema: integer() },
  ]);
  const eventOperation = document.paths[eventPath] as {
    get?: { parameters?: Array<{ name?: string; in?: string; schema?: Record<string, unknown> }> };
  };
  const actionPlanIdParameter = eventOperation.get?.parameters?.find(
    (parameter) => parameter.in === "path" && parameter.name === "actionPlanId",
  );
  if (actionPlanIdParameter) actionPlanIdParameter.schema = uuid();
}

function object(required: string[], properties: Record<string, unknown>) { return { type: "object", required, properties }; }
function ref(name: string) { return { $ref: `#/components/schemas/${name}` }; }
function arrayRef(name: string) { return { type: "array", items: ref(name) }; }
function integer() { return { type: "integer", minimum: 0 }; }
function boundedInteger() { return { type: "integer", minimum: 1, maximum: 100 }; }
function boolean() { return { type: "boolean" }; }
function uuid() { return { type: "string", format: "uuid" }; }
function nullableString() { return { type: "string", nullable: true }; }
