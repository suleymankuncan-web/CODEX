import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type OpenApiDocument = {
  paths: Record<
    string,
    Record<
      string,
      {
        requestBody?: {
          content?: Record<string, { schema?: Record<string, unknown> }>;
        };
        responses?: Record<
          string,
          {
            content?: Record<string, { schema?: Record<string, unknown> }>;
          }
        >;
      }
    >
  >;
  components?: {
    schemas?: Record<string, { properties?: Record<string, unknown> }>;
  };
};

describe("Store action plan OpenAPI contract", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as OpenApiDocument;

  it("captures store action plan request and response schemas", () => {
    const listPlans = document.paths["/api/store-actions/plans"].get;
    expect(listPlans.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreActionPlanListResponse",
    });
    expect(document.components?.schemas?.StoreActionPlanListResponse?.properties).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const getPlan = document.paths["/api/store-actions/plans/{actionPlanId}"].get;
    expect(getPlan.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreActionPlanDetailResponse",
    });

    const createPlan = document.paths["/api/store-actions/plans"].post;
    expect(createPlan.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreateStoreActionPlanRequest",
    });
    expect(createPlan.responses?.["201"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreActionPlanCommandResponse",
    });

    const updateStatus =
      document.paths["/api/store-actions/plans/{actionPlanId}/status"].patch;
    expect(updateStatus.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/UpdateStoreActionPlanStatusRequest",
    });
    expect(updateStatus.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreActionPlanCommandResponse",
    });

    const closePlan = document.paths["/api/store-actions/plans/{actionPlanId}/close"].patch;
    expect(closePlan.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CloseStoreActionPlanRequest",
    });

    const cancelPlan =
      document.paths["/api/store-actions/plans/{actionPlanId}/cancel"].patch;
    expect(cancelPlan.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CancelStoreActionPlanRequest",
    });
  });
});
