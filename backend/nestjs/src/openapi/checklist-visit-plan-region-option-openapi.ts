export const checklistVisitPlanRegionOptionSchema = {
  type: "object",
  required: ["regionId", "regionName"],
  properties: {
    regionId: { type: "string", format: "uuid" },
    regionName: { type: "string" },
  },
};

export const checklistVisitPlanRegionOptionResponseSchema = {
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "object",
      required: ["view", "capabilities", "items", "page"],
      properties: {
        view: { type: "string", enum: ["region_manager"] },
        capabilities: {
          type: "object",
          required: ["canMaintainWeeklyVisitPlan"],
          properties: { canMaintainWeeklyVisitPlan: { type: "boolean", enum: [true] } },
        },
        items: { type: "array", items: { $ref: "#/components/schemas/ChecklistVisitPlanRegionOption" } },
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
