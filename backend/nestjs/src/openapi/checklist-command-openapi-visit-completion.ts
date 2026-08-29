import type { MutablePathItem } from "./openapi-schema-helpers";

export const completeChecklistVisitPlanItemRequestSchema = {
  type: "object",
  required: ["idempotencyKey"],
  properties: { idempotencyKey: { type: "string", format: "uuid" } },
};

export const checklistVisitPlanVisitCompletionResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["planItemId", "completedAt"],
      properties: {
        planItemId: { type: "string", format: "uuid" },
        completedAt: { type: "string", format: "date-time" },
      },
    },
  },
};

export function queryParameter(name: string, schema: Record<string, unknown>) {
  return { name, in: "query", required: false, schema };
}

export function requiredQueryParameter(name: string, schema: Record<string, unknown>) {
  return { name, in: "query", required: true, schema };
}

export function setQueryParameters(
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
