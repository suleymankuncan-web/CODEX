import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type OpenApiDocument = {
  openapi: string;
  security?: Array<Record<string, string[]>>;
  paths: Record<
    string,
    Record<
      string,
      {
        parameters?: Array<Record<string, unknown>>;
        responses?: Record<
          string,
          {
            content?: Record<
              string,
              {
                schema?: Record<string, unknown>;
              }
            >;
          }
        >;
        security?: Array<Record<string, string[]>>;
      }
    >
  >;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<
      string,
      {
        properties?: Record<string, unknown>;
        required?: string[];
      }
    >;
  };
};

describe("OpenAPI baseline", () => {
  const document = JSON.parse(
    readFileSync(resolve(process.cwd(), "../../docs/api/openapi.json"), "utf8"),
  ) as OpenApiDocument;

  it("captures backend routes with the runtime api prefix", () => {
    expect(document.openapi).toBe("3.0.0");
    expect(document.paths).toHaveProperty(
      "/api/integrations/import-batches/overview",
    );
    expect(document.paths).toHaveProperty(
      "/api/integrations/master-data-bootstrap/batches",
    );
    expect(document.paths).not.toHaveProperty(
      "/integrations/import-batches/overview",
    );
  });

  it("declares bearer auth as the shared API authentication scheme", () => {
    expect(document.components?.securitySchemes).toHaveProperty("bearer");
    expect(document.security).toEqual([{ bearer: [] }]);
    expect(document.paths["/api/integrations/import-batches/overview"].get.security)
      .toBeUndefined();
    expect(document.paths["/api/auth/bootstrap"].get.security).toEqual([]);
    expect(document.paths["/api/health"].get.security).toEqual([]);
    expect(document.paths["/api/health/live"].get.security).toEqual([]);
  });

  it("captures DTO body properties instead of empty placeholder schemas", () => {
    const createSnapshotRun = document.components?.schemas?.CreateSnapshotRunDto;
    expect(createSnapshotRun?.properties).toEqual(
      expect.objectContaining({
        snapshotType: expect.any(Object),
        periodStart: expect.any(Object),
        periodEnd: expect.any(Object),
      }),
    );
    expect(createSnapshotRun?.required).toEqual(
      expect.arrayContaining(["snapshotType", "periodStart", "periodEnd"]),
    );
  });

  it("captures generated frontend response schemas", () => {
    const response =
      document.paths["/api/integrations/import-batches/overview"].get.responses?.[
        "200"
      ];
    expect(response?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ImportOverview",
    });
    expect(document.components?.schemas?.ImportOverview?.properties).toEqual(
      expect.objectContaining({
        totals: expect.any(Object),
        healthTotals: expect.any(Object),
        actionTotals: expect.any(Object),
        latest: expect.any(Object),
      }),
    );

    const lookupsResponse =
      document.paths["/api/integrations/lookups"].get.responses?.["200"];
    expect(lookupsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/IntegrationLookups",
    });
    expect(document.components?.schemas?.IntegrationLookups?.properties).toEqual(
      expect.objectContaining({
        entityTypes: expect.any(Object),
        sourceStats: expect.any(Object),
        activeSources: expect.any(Object),
        sourcesByEntityType: expect.any(Object),
        optionGroups: expect.any(Object),
        meta: expect.any(Object),
      }),
    );
    expect(
      document.components?.schemas?.IntegrationLookups?.properties?.optionGroups,
    ).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          entityTypes: expect.any(Object),
          sources: expect.any(Object),
          sourceSystems: expect.any(Object),
          stateModels: expect.any(Object),
        }),
      }),
    );

    const masterDataBatchesResponse =
      document.paths["/api/integrations/master-data-bootstrap/batches"].get
        .responses?.["200"];
    expect(masterDataBatchesResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/MasterDataBootstrapBatchesResponse",
    });
    expect(
      document.components?.schemas?.MasterDataBootstrapBatchesResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );
  });

  it("documents the mobile session header required by the mobile session guard", () => {
    const guardedOperations = [
      document.paths["/api/mobile/auth/session"].get,
      document.paths["/api/mobile/auth/sessions"].get,
      document.paths["/api/mobile/auth/logout"].post,
      document.paths["/api/mobile/auth/sessions/{sessionId}"].delete,
    ];

    for (const operation of guardedOperations) {
      expect(operation.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "x-mobile-session-id",
            in: "header",
            required: true,
          }),
        ]),
      );
    }
  });
});
