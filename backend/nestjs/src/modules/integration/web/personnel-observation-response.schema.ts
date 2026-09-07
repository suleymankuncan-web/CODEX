import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

export const personnelObservationResponseSchema: SchemaObject = {
  type: "object",
  required: ["items", "meta"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["sourceId", "businessDate", "storeId", "storeCode", "storeName", "personnelCode"],
        properties: {
          sourceId: { type: "string", format: "uuid" },
          businessDate: { type: "string", format: "date" },
          storeId: { type: "string", format: "uuid" },
          storeCode: { type: "string" },
          storeName: { type: "string" },
          personnelCode: { type: "string" },
        },
      },
    },
    meta: {
      type: "object",
      required: ["count", "total", "limit", "offset"],
      properties: {
        count: { type: "integer", minimum: 0 },
        total: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
      },
    },
  },
};
