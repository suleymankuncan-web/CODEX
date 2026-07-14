import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type OpenApiDocument = {
  paths: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
};

describe("Checklist Command OpenAPI", () => {
  it("publishes the bounded read response and allowlisted row fields", () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
    ) as OpenApiDocument;
    const operation = document.paths["/api/checklists/command-canvas"].get;

    expect(operation.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ChecklistCommandResponse",
    });
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "period", in: "query" }),
        expect.objectContaining({ name: "status", in: "query" }),
        expect.objectContaining({ name: "signal", in: "query" }),
        expect.objectContaining({ name: "sort", in: "query" }),
        expect.objectContaining({ name: "limit", in: "query" }),
        expect.objectContaining({ name: "offset", in: "query" }),
      ]),
    );
    const sortParameter = operation.parameters.find((parameter: { name?: string }) => parameter.name === "sort");
    expect(sortParameter.schema.enum).toEqual(
      expect.arrayContaining(["status_asc", "status_desc"]),
    );

    const rowProperties = document.components?.schemas?.ChecklistCommandRow?.properties;
    expect(rowProperties).toHaveProperty("lastCompletedVisitAt");
    expect(rowProperties).toHaveProperty("elapsedDaysSinceLastVisit");
    expect(rowProperties).not.toHaveProperty("email");
    expect(rowProperties).not.toHaveProperty("username");
    expect(rowProperties).not.toHaveProperty("acknowledgementNote");
    expect(rowProperties).not.toHaveProperty("resolutionNote");
  });

  it("publishes the Report Viewer-only bounded region aggregate response", () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
    ) as OpenApiDocument;
    const operation = document.paths["/api/checklists/command-canvas/regions"].get;

    expect(operation.responses?.["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ChecklistCommandRegionResponse",
    });
    expect(operation.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "period", in: "query" }),
      expect.objectContaining({ name: "signal", in: "query" }),
      expect.objectContaining({ name: "sort", in: "query" }),
      expect.objectContaining({ name: "limit", in: "query" }),
      expect.objectContaining({ name: "offset", in: "query" }),
    ]));
    const response = document.components?.schemas?.ChecklistCommandRegionResponse;
    expect(response).toBeDefined();
  });

  it("publishes the weekly plan read and optimistic full-snapshot write contracts", () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
    ) as OpenApiDocument;
    const read = document.paths["/api/checklists/command-canvas/visit-plans"].get;
    const write = document.paths["/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}"].put;

    expect(read.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "regionId", in: "query", required: true }),
      expect.objectContaining({ name: "weekStart", in: "query", required: true }),
    ]));
    expect(read.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ChecklistVisitPlanResponse",
    });
    expect(write.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/SaveChecklistVisitPlanRequest",
    });
    expect(write.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ChecklistVisitPlanResponse",
    });
    expect(write.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "regionId", in: "path", schema: { type: "string", format: "uuid" } }),
      expect.objectContaining({ name: "weekStart", in: "path", schema: { type: "string", format: "date" } }),
    ]));
    const request = document.components?.schemas?.SaveChecklistVisitPlanRequest as any;
    expect(request.properties.items).not.toHaveProperty("maxItems");
    const item = document.components?.schemas?.ChecklistVisitPlanItem as any;
    expect(item.properties.status.enum).toEqual(["waiting", "missed", "completed"]);
    expect(item.properties).not.toHaveProperty("assigneeId");
    expect(item.properties).not.toHaveProperty("startedAt");
  });
});
