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

  it("merges parameters by location and name while preferring generated metadata", () => {
    const generated = createDocument({
      paths: {
        "/api/examples/{exampleId}": {
          get: {
            parameters: [
              {
                name: "exampleId",
                required: true,
                in: "path",
                schema: { type: "string", format: "uuid" },
              },
              {
                name: "limit",
                required: false,
                in: "query",
                schema: { type: "integer", minimum: 1, maximum: 200 },
              },
            ],
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
              {
                name: "offset",
                required: false,
                in: "query",
                schema: { type: "integer", minimum: 0, default: 0 },
              },
            ],
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    const generatedParameters = (
      generated.paths["/api/examples/{exampleId}"] as {
        get: { parameters: unknown[] };
      }
    ).get.parameters;
    const baselineParameters = (
      baseline.paths["/api/examples/{exampleId}"] as {
        get: { parameters: unknown[] };
      }
    ).get.parameters;

    expect(generatedParameters).toEqual([
      {
        name: "exampleId",
        required: true,
        in: "path",
        schema: { type: "string", format: "uuid" },
      },
      baselineParameters[1],
      {
        name: "limit",
        required: false,
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 200 },
      },
    ]);
    expect(generatedParameters[0]).toEqual({
      name: "exampleId",
      required: true,
      in: "path",
      schema: { type: "string", format: "uuid" },
    });
  });

  it("retains baseline enum order while preserving generated parameter metadata", () => {
    const generated = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              {
                name: "kind",
                in: "query",
                required: false,
                description: "Generated description",
                schema: {
                  type: "string",
                  enum: ["thumbnail", "canonical"],
                  default: "thumbnail",
                  minLength: 1,
                },
              },
            ],
          },
        },
      },
    });
    const baseline = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              {
                name: "kind",
                in: "query",
                required: false,
                description: "Baseline description",
                schema: {
                  type: "string",
                  enum: ["canonical", "thumbnail"],
                },
              },
            ],
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    const parameter = (
      generated.paths["/api/examples"] as {
        get: { parameters: Array<Record<string, unknown>> };
      }
    ).get.parameters[0];
    expect(parameter).toEqual(
      expect.objectContaining({
        description: "Generated description",
        schema: expect.objectContaining({
          enum: ["canonical", "thumbnail"],
          default: "thumbnail",
          minLength: 1,
        }),
      }),
    );
  });

  it("keeps generated enum membership and order when members differ", () => {
    const generated = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              {
                name: "kind",
                in: "query",
                description: "Generated description",
                schema: {
                  type: "string",
                  enum: ["thumbnail", "canonical"],
                },
              },
            ],
          },
        },
      },
    });
    const baseline = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              {
                name: "kind",
                in: "query",
                schema: {
                  type: "string",
                  enum: ["canonical", "evidence"],
                },
              },
            ],
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    const parameter = (
      generated.paths["/api/examples"] as {
        get: { parameters: Array<Record<string, unknown>> };
      }
    ).get.parameters[0];
    expect(parameter).toEqual(
      expect.objectContaining({
        description: "Generated description",
        schema: expect.objectContaining({
          enum: ["thumbnail", "canonical"],
        }),
      }),
    );
  });

  it("deduplicates keyed parameters while retaining baseline-only entries", () => {
    const generated = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer" } },
              { name: "limit", in: "query", schema: { type: "integer" } },
            ],
          },
        },
      },
    });
    const baseline = createDocument({
      paths: {
        "/api/examples": {
          get: {
            parameters: [
              { name: "offset", in: "query", schema: { type: "integer" } },
              { name: "limit", in: "query", schema: { type: "string" } },
              { name: "offset", in: "query", schema: { type: "integer" } },
            ],
          },
        },
      },
    });

    preserveOpenApiBaseline(generated, baseline);

    expect((generated.paths["/api/examples"] as { get: { parameters: unknown[] } }).get.parameters).toEqual([
      { name: "offset", in: "query", schema: { type: "integer" } },
      { name: "limit", in: "query", schema: { type: "integer" } },
    ]);
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
