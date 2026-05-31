import {
  type OpenApiDocument,
  preserveOpenApiBaseline,
} from "./openapi-baseline-preservation";

describe("preserveOpenApiBaseline", () => {
  it("preserves richer baseline schema metadata when generation loses properties", () => {
    const generated = createDocument({
      schemas: {
        ExampleDto: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    });

    const baseline = createDocument({
      schemas: {
        ExampleDto: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
          },
          required: ["id", "label"],
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    expect(generated.components?.schemas?.ExampleDto).toEqual(
      baseline.components?.schemas?.ExampleDto,
    );
  });

  it("does not overwrite generated schema metadata when generation adds fields", () => {
    const generated = createDocument({
      schemas: {
        ExampleDto: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
          },
        },
      },
    });

    const baseline = createDocument({
      schemas: {
        ExampleDto: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    expect(generated.components?.schemas?.ExampleDto).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        label: { type: "string" },
      },
    });
  });

  it("preserves baseline operation metadata when generated metadata is degraded", () => {
    const generated = createDocument({
      paths: {
        "/api/examples/{exampleId}": {
          get: {
            parameters: [],
            responses: {
              "200": { description: "" },
            },
          },
        },
      },
    });

    const baseline = createDocument({
      paths: {
        "/api/examples/{exampleId}": {
          get: {
            parameters: [
              {
                name: "exampleId",
                required: true,
                in: "path",
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": {
                description: "Example response.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ExampleResponse" },
                  },
                },
              },
            },
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    expect(generated.paths["/api/examples/{exampleId}"]).toEqual(
      baseline.paths["/api/examples/{exampleId}"],
    );
  });

  it("prunes unreferenced generated-only schemas but keeps baseline schemas", () => {
    const generated = createDocument({
      schemas: {
        BaselineOnly: { type: "object", properties: {} },
        GeneratedOnly: { type: "object", properties: {} },
        ReferencedGenerated: { type: "object", properties: {} },
      },
      paths: {
        "/api/examples": {
          get: {
            responses: {
              "200": {
                description: "",
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/ReferencedGenerated",
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const baseline = createDocument({
      schemas: {
        BaselineOnly: { type: "object", properties: {} },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    expect(generated.components?.schemas?.BaselineOnly).toBeDefined();
    expect(generated.components?.schemas?.ReferencedGenerated).toBeDefined();
    expect(generated.components?.schemas?.GeneratedOnly).toBeUndefined();
  });
});

function createDocument(input: {
  paths?: OpenApiDocument["paths"];
  schemas?: NonNullable<OpenApiDocument["components"]>["schemas"];
}): OpenApiDocument {
  return {
    openapi: "3.0.0",
    info: { title: "Test", version: "0.0.0" },
    paths: input.paths ?? {},
    components: {
      schemas: input.schemas ?? {},
    },
  };
}
