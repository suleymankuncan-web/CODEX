import { setJsonResponseSchema } from "./openapi-schema-helpers";

export function applyRegionManagerDirectoryOpenApi(document: {
  components?: { schemas?: Record<string, unknown> }; paths: Record<string, unknown>;
}) {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.RegionManagerDirectoryResponse = {
    type: "object", required: ["items"], properties: {
      items: { type: "array", items: {
        type: "object", required: ["userId", "displayName", "storeIds"], properties: {
          userId: { type: "string", format: "uuid" }, displayName: { type: "string" },
          storeIds: { type: "array", items: { type: "string", format: "uuid" } },
        },
      } },
    },
  };
  setJsonResponseSchema(document.paths, "/api/org/region-managers", "get", "Active Region Managers assigned to any store type within the company scope.", "RegionManagerDirectoryResponse");
}
