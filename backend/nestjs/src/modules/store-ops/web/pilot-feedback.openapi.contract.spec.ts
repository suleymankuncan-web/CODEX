import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type OpenApiDocument = {
  paths: Record<
    string,
    Record<
      string,
      {
        parameters?: Array<Record<string, unknown>>;
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

describe("PilotFeedback OpenAPI contract", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as OpenApiDocument;

  it("captures pilot feedback request and response schemas", () => {
    const createFeedback = document.paths["/api/pilot-feedback"].post;
    expect(createFeedback.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CreatePilotFeedbackRequest",
    });
    expect(createFeedback.responses?.["201"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/PilotFeedbackCommandResponse",
    });

    const listFeedback = document.paths["/api/admin/pilot-feedback"].get;
    expect(listFeedback.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "status", in: "query", required: false }),
        expect.objectContaining({ name: "classification", in: "query", required: false }),
        expect.objectContaining({ name: "limit", in: "query", required: false }),
        expect.objectContaining({ name: "offset", in: "query", required: false }),
      ]),
    );
    expect(listFeedback.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/PilotFeedbackListResponse",
    });

    const classifyFeedback =
      document.paths["/api/admin/pilot-feedback/{feedbackId}/classification"].patch;
    expect(classifyFeedback.requestBody?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ClassifyPilotFeedbackRequest",
    });
    expect(classifyFeedback.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/PilotFeedbackCommandResponse",
    });

    expect(document.components?.schemas?.PilotFeedback?.properties).toEqual(
      expect.objectContaining({
        feedbackId: expect.any(Object),
        actorRoleCodes: expect.any(Object),
        feedbackType: expect.any(Object),
        severitySuggestion: expect.any(Object),
        routePath: expect.any(Object),
        status: expect.any(Object),
        classification: expect.any(Object),
      }),
    );
  });
});
