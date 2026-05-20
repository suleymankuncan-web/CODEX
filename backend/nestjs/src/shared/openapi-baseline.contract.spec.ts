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

    const targetCoverageResponse =
      document.paths["/api/target-distributions/coverage"].get.responses?.["200"];
    expect(targetCoverageResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/TargetCoverageResponse",
    });
    expect(document.components?.schemas?.TargetCoverageResponse?.properties).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
        summary: expect.any(Object),
      }),
    );

    const storeTargetingPersonnelResponse =
      document.paths["/api/target-distributions/store-personnel"].get.responses?.[
        "200"
      ];
    expect(
      storeTargetingPersonnelResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/StoreTargetingPersonnelResponse",
    });
    expect(
      document.components?.schemas?.StoreTargetingPersonnelResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const workflowInboxResponse =
      document.paths["/api/workflow/inbox"].get.responses?.["200"];
    expect(workflowInboxResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/WorkflowInboxResponse",
    });
    expect(document.components?.schemas?.WorkflowInboxResponse?.properties).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const snapshotOverviewResponse =
      document.paths["/api/snapshots/runs/overview"].get.responses?.["200"];
    expect(snapshotOverviewResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/SnapshotOverviewResponse",
    });
    expect(
      document.components?.schemas?.SnapshotOverviewResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        totals: expect.any(Object),
        healthTotals: expect.any(Object),
        actionTotals: expect.any(Object),
        latest: expect.any(Object),
      }),
    );

    const dailyClosureStatusResponse =
      document.paths["/api/snapshots/daily-closure"].get.responses?.["200"];
    expect(
      dailyClosureStatusResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/DailyClosureStatusResponse",
    });
    expect(
      document.components?.schemas?.DailyClosureStatusResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        automationEnabled: expect.any(Object),
        healthState: expect.any(Object),
        recommendedAction: expect.any(Object),
      }),
    );

    const snapshotNeedsActionResponse =
      document.paths["/api/snapshots/runs/needs-action"].get.responses?.["200"];
    expect(
      snapshotNeedsActionResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/SnapshotNeedsActionResponse",
    });
    expect(
      document.components?.schemas?.SnapshotNeedsActionResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const snapshotRunDetailResponse =
      document.paths["/api/snapshots/runs/{snapshotRunId}"].get.responses?.["200"];
    expect(
      snapshotRunDetailResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/SnapshotRunDetailResponse",
    });
    expect(
      document.components?.schemas?.SnapshotRunDetailResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        snapshotRun: expect.any(Object),
        cards: expect.any(Object),
        rerunAllowed: expect.any(Object),
      }),
    );

    const snapshotRunDependenciesResponse =
      document.paths["/api/snapshots/runs/{snapshotRunId}/dependencies"].get
        .responses?.["200"];
    expect(
      snapshotRunDependenciesResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/SnapshotRunDependenciesResponse",
    });
    expect(
      document.components?.schemas?.SnapshotRunDependenciesResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        snapshotRunId: expect.any(Object),
        checks: expect.any(Object),
      }),
    );

    const snapshotRunLineageResponse =
      document.paths["/api/snapshots/runs/{snapshotRunId}/lineage"].get.responses?.[
        "200"
      ];
    expect(
      snapshotRunLineageResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/SnapshotRunLineageResponse",
    });
    expect(
      document.components?.schemas?.SnapshotRunLineageResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        snapshotRunId: expect.any(Object),
        parent: expect.any(Object),
        children: expect.any(Object),
      }),
    );

    const snapshotRunAuditResponse =
      document.paths["/api/snapshots/runs/{snapshotRunId}/audit"].get.responses?.[
        "200"
      ];
    expect(snapshotRunAuditResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/SnapshotRunAuditResponse",
    });
    expect(
      document.components?.schemas?.SnapshotRunAuditResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const workforceSellerCodeReferenceResponse =
      document.paths["/api/workforce/seller-code-reference"].get.responses?.["200"];
    expect(
      workforceSellerCodeReferenceResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/WorkforceSellerCodeReferenceResponse",
    });
    expect(
      document.components?.schemas?.WorkforceSellerCodeReferenceResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        storeType: expect.any(Object),
        prefix: expect.any(Object),
        nextSellerCodePreview: expect.any(Object),
      }),
    );

    const workforcePositionOptionsResponse =
      document.paths["/api/workforce/position-options"].get.responses?.["200"];
    expect(
      workforcePositionOptionsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/WorkforcePositionOptionsResponse",
    });
    expect(
      document.components?.schemas?.WorkforcePositionOptionsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const workforceStoreEmployeesResponse =
      document.paths["/api/workforce/store-employees"].get.responses?.["200"];
    expect(
      workforceStoreEmployeesResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/WorkforceStoreEmployeesResponse",
    });
    expect(
      document.components?.schemas?.WorkforceStoreEmployeesResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const workforceSellerCodeRequestsResponse =
      document.paths["/api/workforce/seller-code-requests"].get.responses?.["200"];
    expect(
      workforceSellerCodeRequestsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/WorkforceSellerCodeRequestsResponse",
    });
    expect(
      document.components?.schemas?.WorkforceSellerCodeRequestsResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const workforceOffboardingRequestsResponse =
      document.paths["/api/workforce/offboarding-requests"].get.responses?.["200"];
    expect(
      workforceOffboardingRequestsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/WorkforceOffboardingRequestsResponse",
    });
    expect(
      document.components?.schemas?.WorkforceOffboardingRequestsResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingSummaryResponse =
      document.paths["/api/reports/summary"].get.responses?.["200"];
    expect(
      reportingSummaryResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingSummaryResponse",
    });
    expect(document.components?.schemas?.ReportingSummaryResponse?.properties).toEqual(
      expect.objectContaining({
        latestCompletedSnapshotRun: expect.any(Object),
        cards: expect.any(Object),
      }),
    );

    const reportingSnapshotRunsResponse =
      document.paths["/api/reports/snapshot-runs"].get.responses?.["200"];
    expect(
      reportingSnapshotRunsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingSnapshotRunsResponse",
    });
    expect(
      document.components?.schemas?.ReportingSnapshotRunsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingKpiConfigResponse =
      document.paths["/api/reports/kpi-config"].get.responses?.["200"];
    expect(
      reportingKpiConfigResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingKpiConfigResponse",
    });
    expect(
      document.components?.schemas?.ReportingKpiConfigResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        storeProfile: expect.any(Object),
        personnelProfile: expect.any(Object),
        ownershipMatrix: expect.any(Object),
        gradingBands: expect.any(Object),
        metadata: expect.any(Object),
      }),
    );

    const reportingKpiConfigEditorResponse =
      document.paths["/api/reports/kpi-config/editor"].get.responses?.["200"];
    expect(
      reportingKpiConfigEditorResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingKpiConfigEditorResponse",
    });
    expect(
      document.components?.schemas?.ReportingKpiConfigEditorResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        draftConfig: expect.any(Object),
        publishedConfig: expect.any(Object),
        hasUnpublishedChanges: expect.any(Object),
        latestPublishedVersion: expect.any(Object),
      }),
    );

    const reportingKpiConfigAuditResponse =
      document.paths["/api/reports/kpi-config/audit"].get.responses?.["200"];
    expect(
      reportingKpiConfigAuditResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingKpiConfigAuditResponse",
    });
    expect(
      document.components?.schemas?.ReportingKpiConfigAuditResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingWorkforceResponse =
      document.paths["/api/reports/workforce"].get.responses?.["200"];
    expect(
      reportingWorkforceResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingWorkforceResponse",
    });
    expect(
      document.components?.schemas?.ReportingWorkforceResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingKpiResponse =
      document.paths["/api/reports/kpis"].get.responses?.["200"];
    expect(reportingKpiResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ReportingKpiResponse",
    });
    expect(
      document.components?.schemas?.ReportingKpiResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingMyPerformanceResponse =
      document.paths["/api/reports/my-performance"].get.responses?.["200"];
    expect(
      reportingMyPerformanceResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingPerformanceResponse",
    });
    expect(
      document.components?.schemas?.ReportingPerformanceResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        source: expect.any(Object),
        employee: expect.any(Object),
        period: expect.any(Object),
        score: expect.any(Object),
        rankings: expect.any(Object),
        availablePeriods: expect.any(Object),
        partial: expect.any(Object),
        metrics: expect.any(Object),
      }),
    );

    const reportingPersonnelPerformanceResponse =
      document.paths["/api/reports/personnel-performance/{employeeId}"].get
        .responses?.["200"];
    expect(
      reportingPersonnelPerformanceResponse?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingPerformanceResponse",
    });

    const reportingStoreKpiHighlightsResponse =
      document.paths["/api/reports/store-kpi-highlights"].get.responses?.["200"];
    expect(
      reportingStoreKpiHighlightsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingStoreKpiHighlightsResponse",
    });
    expect(
      document.components?.schemas?.ReportingStoreKpiHighlightsResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        source: expect.any(Object),
        store: expect.any(Object),
        period: expect.any(Object),
        score: expect.any(Object),
        availablePeriods: expect.any(Object),
        partial: expect.any(Object),
        metrics: expect.any(Object),
      }),
    );

    const reportingStoreScoreBreakdownResponse =
      document.paths["/api/reports/store-score-breakdown"].get.responses?.["200"];
    expect(
      reportingStoreScoreBreakdownResponse?.content?.["application/json"]
        ?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingStoreScoreBreakdownResponse",
    });
    expect(
      document.components?.schemas?.ReportingStoreScoreBreakdownResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        snapshotRunId: expect.any(Object),
        storeId: expect.any(Object),
        totalScore: expect.any(Object),
        components: expect.any(Object),
      }),
    );

    const reportingRankingsResponse =
      document.paths["/api/reports/rankings"].get.responses?.["200"];
    expect(reportingRankingsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ReportingRankingsResponse",
    });
    expect(
      document.components?.schemas?.ReportingRankingsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        source: expect.any(Object),
        access: expect.any(Object),
        filters: expect.any(Object),
        reference: expect.any(Object),
        storeLeaderboard: expect.any(Object),
        personnelLeaderboard: expect.any(Object),
        availablePeriods: expect.any(Object),
      }),
    );

    const reportingClosedLeaderboardResponse =
      document.paths["/api/reports/leaderboards/closed"].get.responses?.["200"];
    expect(
      reportingClosedLeaderboardResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ReportingClosedLeaderboardResponse",
    });
    expect(
      document.components?.schemas?.ReportingClosedLeaderboardResponse
        ?.properties,
    ).toEqual(
      expect.objectContaining({
        source: expect.any(Object),
        includedSnapshotRuns: expect.any(Object),
        currentEmployee: expect.any(Object),
        personnelTop: expect.any(Object),
      }),
    );

    const reportingChecklistResponse =
      document.paths["/api/reports/checklists"].get.responses?.["200"];
    expect(reportingChecklistResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ReportingChecklistResponse",
    });
    expect(
      document.components?.schemas?.ReportingChecklistResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const reportingTurnoverResponse =
      document.paths["/api/reports/turnover"].get.responses?.["200"];
    expect(reportingTurnoverResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/ReportingTurnoverResponse",
    });
    expect(
      document.components?.schemas?.ReportingTurnoverResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authLookupsResponse =
      document.paths["/api/auth/lookups"].get.responses?.["200"];
    expect(authLookupsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/AuthLookupsResponse",
    });
    expect(document.components?.schemas?.AuthLookupsResponse?.properties).toEqual(
      expect.objectContaining({
        scopeTypes: expect.any(Object),
        authProviders: expect.any(Object),
        users: expect.any(Object),
        roles: expect.any(Object),
        permissions: expect.any(Object),
        stores: expect.any(Object),
        optionGroups: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authUserLookupSearchResponse =
      document.paths["/api/auth/lookups/users/search"].get.responses?.["200"];
    expect(
      authUserLookupSearchResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/AuthUserLookupSearchResponse",
    });
    expect(
      document.components?.schemas?.AuthUserLookupSearchResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authStoreLookupSearchResponse =
      document.paths["/api/auth/lookups/stores/search"].get.responses?.["200"];
    expect(
      authStoreLookupSearchResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/AuthStoreLookupSearchResponse",
    });
    expect(
      document.components?.schemas?.AuthStoreLookupSearchResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authRolesResponse =
      document.paths["/api/auth/roles"].get.responses?.["200"];
    expect(authRolesResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/AuthRoleCatalogResponse",
    });
    expect(
      document.components?.schemas?.AuthRoleCatalogResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authPermissionsResponse =
      document.paths["/api/auth/permissions"].get.responses?.["200"];
    expect(authPermissionsResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/AuthPermissionCatalogResponse",
    });
    expect(
      document.components?.schemas?.AuthPermissionCatalogResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authUsersResponse =
      document.paths["/api/auth/users"].get.responses?.["200"];
    expect(authUsersResponse?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/AuthUserAccountsResponse",
    });
    expect(
      document.components?.schemas?.AuthUserAccountsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authRoleAssignmentsResponse =
      document.paths["/api/auth/role-assignments"].get.responses?.["200"];
    expect(
      authRoleAssignmentsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/AuthRoleAssignmentsResponse",
    });
    expect(
      document.components?.schemas?.AuthRoleAssignmentsResponse?.properties,
    ).toEqual(
      expect.objectContaining({
        items: expect.any(Object),
        meta: expect.any(Object),
      }),
    );

    const authActionStoreAssignmentsResponse =
      document.paths["/api/auth/action-store-assignments"].get.responses?.["200"];
    expect(
      authActionStoreAssignmentsResponse?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/AuthActionStoreAssignmentsResponse",
    });
    expect(
      document.components?.schemas?.AuthActionStoreAssignmentsResponse
        ?.properties,
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
