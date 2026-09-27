import { setJsonRequestSchema, setJsonResponseSchema, type MutablePathItem } from "./openapi-schema-helpers";

export function applyChecklistWeeklyPlanWriteOpenApi(paths: Record<string, unknown>) {
  for (const [path, description] of [
    ["/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}",
      "Replace one Region Manager weekly BM visit plan using optimistic concurrency and idempotency."],
    ["/api/checklists/command-canvas/visit-plans/assigned/{weekStart}",
      "Atomically replace the authenticated Region Manager's directly assigned store plans."],
  ]) {
    setJsonResponseSchema(paths, path, "put", description, "ChecklistVisitPlanResponse");
    setJsonRequestSchema(paths, path, "put", "SaveChecklistVisitPlanRequest");
    const operation = (paths[path] as MutablePathItem | undefined)?.put;
    if (!operation) continue;
    operation.parameters = (operation.parameters ?? []).map((parameter) => {
      if (parameter.name === "regionId") return { ...parameter, schema: { type: "string", format: "uuid" } };
      if (parameter.name === "weekStart") return { ...parameter, schema: { type: "string", format: "date" } };
      return parameter;
    });
  }
}
