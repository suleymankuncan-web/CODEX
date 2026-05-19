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

    const importPayloadTemplateResponse =
      document.paths["/api/integrations/import-payload-templates"].get
        .responses?.["200"];
    expect(
      importPayloadTemplateResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ImportPayloadTemplateResponse",
    });
    expect(
      document.components?.schemas?.ImportPayloadTemplateResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        entityType: expect.any(Object),
        sourceSystem: expect.any(Object),
        canonicalContract: expect.any(Object),
        requestBody: expect.any(Object),
      }),
    );

    const needsActionResponse =
      document.paths["/api/integrations/import-batches/needs-action"].get
        .responses?.["200"];
    expect(needsActionResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ImportBatchNeedsActionResponse",
    });
    expect(
      document.components?.schemas?.ImportBatchNeedsActionResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const externalIdCandidatesResponse =
      document.paths["/api/integrations/external-id-map-candidates"].get
        .responses?.["200"];
    expect(
      externalIdCandidatesResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ExternalIdMapCandidatesResponse",
    });
    expect(
      document.components?.schemas?.ExternalIdMapCandidatesResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const importBatchErrorsResponse =
      document.paths["/api/integrations/import-batches/{batchId}/errors"].get
        .responses?.["200"];
    expect(importBatchErrorsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ImportBatchErrorsResponse",
    });
    expect(
      document.components?.schemas?.ImportBatchErrorsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const importBatchAuditResponse =
      document.paths["/api/integrations/import-batches/{batchId}/audit"].get
        .responses?.["200"];
    expect(importBatchAuditResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ImportBatchAuditResponse",
    });
    expect(
      document.components?.schemas?.ImportBatchAuditResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const importBatchReconciliationResponse =
      document.paths[
        "/api/integrations/import-batches/{batchId}/reconciliation"
      ].get.responses?.["200"];
    expect(
      importBatchReconciliationResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ImportBatchReconciliationResponse",
    });
    expect(
      document.components?.schemas?.ImportBatchReconciliationResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        batch: expect.any(Object),
        totals: expect.any(Object),
        reconciliation: expect.any(Object),
      }),
    );

    const importBatchDetailResponse =
      document.paths["/api/integrations/import-batches/{batchId}"].get.responses?.[
        "200"
      ];
    expect(importBatchDetailResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ImportBatchDetailResponse",
    });
    expect(
      document.components?.schemas?.ImportBatchDetailResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        batch: expect.any(Object),
        rowStatusSummary: expect.any(Object),
        dependencySummary: expect.any(Object),
        qualityIssueSummary: expect.any(Object),
        lineageSummary: expect.any(Object),
      }),
    );

    const competitionListResponse =
      document.paths["/api/competitions"].get.responses?.["200"];
    expect(competitionListResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CompetitionListResponse",
    });
    expect(
      document.components?.schemas?.CompetitionListResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const competitionDetailResponse =
      document.paths["/api/competitions/{competitionId}"].get.responses?.["200"];
    expect(
      competitionDetailResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CompetitionDetailResponse",
    });
    expect(
      document.components?.schemas?.CompetitionDetailResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        competition: expect.any(Object),
        stages: expect.any(Object),
        teams: expect.any(Object),
        latestScores: expect.any(Object),
        warnings: expect.any(Object),
        storeContributions: expect.any(Object),
      }),
    );

    const competitionTeamTemplateListResponse =
      document.paths["/api/competitions/team-templates"].get.responses?.["200"];
    expect(
      competitionTeamTemplateListResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CompetitionTeamTemplateListResponse",
    });
    expect(
      document.components?.schemas?.CompetitionTeamTemplateListResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const competitionStagePackagePlanListResponse =
      document.paths["/api/competitions/{competitionId}/stage-package-plans"].get
        .responses?.["200"];
    expect(
      competitionStagePackagePlanListResponse?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CompetitionStagePackagePlanListResponse",
    });
    expect(
      document.components?.schemas?.CompetitionStagePackagePlanListResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const competitionStagePackagePlanAuditResponse =
      document.paths[
        "/api/competitions/stage-package-plans/{planId}/audit"
      ].get.responses?.["200"];
    expect(
      competitionStagePackagePlanAuditResponse?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/CompetitionStagePackagePlanAuditResponse",
    });
    expect(
      document.components?.schemas?.CompetitionStagePackagePlanAuditResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const mobileChecklistTodayResponse =
      document.paths["/api/mobile/checklists/today"].get.responses?.["200"];
    expect(
      mobileChecklistTodayResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/MobileChecklistTodayResponse",
    });
    expect(
      document.components?.schemas?.MobileChecklistTodayResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        data: expect.any(Object),
      }),
    );

    const targetDistributionRequestsResponse =
      document.paths["/api/target-distributions/requests"].get.responses?.["200"];
    expect(
      targetDistributionRequestsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/TargetDistributionRequestsResponse",
    });
    expect(
      document.components?.schemas?.TargetDistributionRequestsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
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

    const storeMasterLookupsResponse =
      document.paths["/api/integrations/store-master-lookups"].get.responses?.[
        "200"
      ];
    expect(storeMasterLookupsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreMasterLookups",
    });
    expect(document.components?.schemas?.StoreMasterLookups?.properties).toEqual(
      expect.objectContaining({
        storeTypes: expect.any(Object),
        statuses: expect.any(Object),
        regions: expect.any(Object),
      }),
    );

    const storeMasterResponse =
      document.paths["/api/integrations/store-master"].get.responses?.["200"];
    expect(storeMasterResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/StoreMasterListResponse",
    });
    expect(
      document.components?.schemas?.StoreMasterListResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const personnelMasterLookupsResponse =
      document.paths["/api/integrations/personnel-master-lookups"].get.responses?.[
        "200"
      ];
    expect(
      personnelMasterLookupsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/PersonnelMasterLookups",
    });
    expect(
      document.components?.schemas?.PersonnelMasterLookups?.properties,
    ).toEqual(
      expect.objectContaining({
        stores: expect.any(Object),
        positions: expect.any(Object),
        employmentStatuses: expect.any(Object),
        employmentTypes: expect.any(Object),
      }),
    );

    const personnelMasterResponse =
      document.paths["/api/integrations/personnel-master"].get.responses?.["200"];
    expect(personnelMasterResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/PersonnelMasterListResponse",
    });
    expect(
      document.components?.schemas?.PersonnelMasterListResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
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

    const masterDataDetailResponse =
      document.paths[
        "/api/integrations/master-data-bootstrap/batches/{batchId}"
      ].get.responses?.["200"];
    expect(masterDataDetailResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/MasterDataBootstrapBatchDetailResponse",
    });
    expect(
      document.components?.schemas?.MasterDataBootstrapBatchDetailResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        summary: expect.any(Object),
        rows: expect.any(Object),
      }),
    );

    const promotionReadinessResponse =
      document.paths[
        "/api/integrations/master-data-bootstrap/batches/{batchId}/promotion-readiness"
      ].get.responses?.["200"];
    expect(
      promotionReadinessResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/MasterDataBootstrapPromotionReadinessResponse",
    });
    expect(
      document.components?.schemas?.MasterDataBootstrapPromotionReadinessResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        summary: expect.any(Object),
        rows: expect.any(Object),
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
