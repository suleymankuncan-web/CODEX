import { setJsonResponseSchema, type MutablePathItem } from "./openapi-schema-helpers";

type MutableOpenApiDocument = {
  components?: { schemas?: Record<string, unknown> };
  paths: Record<string, unknown>;
};

const eventSchema = {
  type: "object",
  required: ["id", "kind", "occurredAt", "title", "detail", "actorSnapshot", "details"],
  properties: {
    id: { type: "string", pattern: "^evt_[0-9a-f]{32}$" },
    kind: { type: "string", enum: ["checklist_completed", "visit_completed", "acknowledgement", "task_assigned", "task_resolved", "visit_plan_revised"] },
    occurredAt: { type: "string", format: "date-time" },
    title: { type: "string" },
    detail: { type: "string", nullable: true },
    actorSnapshot: {
      type: "object",
      required: ["displayName", "roleLabel", "assignmentLabel", "identityStatus"],
      properties: {
        displayName: { type: "string", nullable: true },
        roleLabel: { type: "string", nullable: true },
        assignmentLabel: { type: "string", nullable: true },
        identityStatus: { type: "string", enum: ["captured", "historical_projection", "unknown"] },
      },
    },
    details: {
      type: "array",
      items: { type: "object", required: ["label", "value"], properties: { label: { type: "string" }, value: { type: "string" } } },
    },
  },
};

const responseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["store", "summary", "items", "page"],
      properties: {
        store: {
          type: "object",
          required: ["id", "name", "city", "district"],
          properties: {
            id: { type: "string", format: "uuid" }, name: { type: "string" },
            city: { type: "string", nullable: true }, district: { type: "string", nullable: true },
          },
        },
        summary: {
          type: "object",
          required: ["eventCount", "completedAuditCount", "completedVisitCount", "assignedTaskCount", "resolvedTaskCount", "openTaskCount"],
          properties: {
            eventCount: { type: "integer", minimum: 0 }, completedAuditCount: { type: "integer", minimum: 0 },
            completedVisitCount: { type: "integer", minimum: 0 }, assignedTaskCount: { type: "integer", minimum: 0 },
            resolvedTaskCount: { type: "integer", minimum: 0 }, openTaskCount: { type: "integer", minimum: 0 },
          },
        },
        items: { type: "array", items: { $ref: "#/components/schemas/ChecklistOperationalHistoryEvent" } },
        page: {
          type: "object", required: ["nextCursor", "hasMore"],
          properties: { nextCursor: { type: "string", nullable: true }, hasMore: { type: "boolean" } },
        },
      },
    },
  },
};

export function applyChecklistOperationalHistoryOpenApi(document: MutableOpenApiDocument) {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ChecklistOperationalHistoryEvent: eventSchema,
    ChecklistOperationalHistoryResponse: responseSchema,
  };
  const path = "/api/checklists/command-canvas/stores/{storeId}/operational-history";
  setJsonResponseSchema(document.paths, path, "get", "Allowlisted store operational history with role-scoped keyset pagination.", "ChecklistOperationalHistoryResponse");
  const operation = (document.paths[path] as MutablePathItem | undefined)?.get;
  if (operation) {
    operation.parameters = [
      { name: "storeId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      { name: "range", in: "query", required: false, schema: { type: "string", enum: ["3m", "6m", "12m", "all"] } },
      { name: "kinds", in: "query", required: false, schema: { type: "string", maxLength: 160 } },
      { name: "cursor", in: "query", required: false, schema: { type: "string", maxLength: 2048 } },
    ];
  }
}
