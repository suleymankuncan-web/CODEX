import { ReportingService } from "./reporting.service";

const validStoreProfile = {
  profileCode: "store",
  title: "Store Score",
  summary: "Store summary",
  futureMetricRule: "Add through config",
  metrics: [
    {
      code: "TARGET_ACHIEVEMENT",
      label: "Target",
      weightPercent: 100,
      ownerRole: "STORE_MANAGER",
      scoreBehavior: "task_candidate",
    },
  ],
};

const validPersonnelProfile = {
  profileCode: "personnel",
  title: "Personnel Score",
  summary: "Personnel summary",
  futureMetricRule: "Add through config",
  metrics: [
    {
      code: "UPT",
      label: "UPT",
      weightPercent: 100,
      ownerRole: "STORE_PERSONNEL",
      scoreBehavior: "warning_first",
    },
  ],
};

const validOwnershipMatrix = [
  {
    code: "TARGET_ACHIEVEMENT",
    label: "Target",
    visibleTo: ["STORE_MANAGER"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["store"],
    taskCandidate: true,
  },
  {
    code: "UPT",
    label: "UPT",
    visibleTo: ["STORE_PERSONNEL"],
    operationalOwner: "STORE_MANAGER",
    contributesTo: ["personnel"],
    taskCandidate: false,
  },
];

const validGradingBands = [
  { code: "A", label: "Strong", emoji: "A", tone: "calm", minScore: 1 },
  { code: "D", label: "Critical", emoji: "D", tone: "danger", minScore: 0 },
];

function createService(repositoryOverrides: Record<string, unknown>) {
  return new ReportingService(
    {} as never,
    {
      getKpiConfigRows: jest.fn(async () => [
        { config_key: "store_profile", config_payload: validStoreProfile },
        { config_key: "personnel_profile", config_payload: validPersonnelProfile },
        { config_key: "ownership_matrix", config_payload: validOwnershipMatrix },
        { config_key: "grading_bands", config_payload: validGradingBands },
      ]),
      getDraftKpiConfigRows: jest.fn(async () => []),
      listKpiConfigAudit: jest.fn(async () => []),
      getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      publishKpiConfigDraft: jest.fn(async () => null),
      ...repositoryOverrides,
    } as never,
    {} as never,
    {} as never,
  );
}

describe("ReportingService KPI config versioning", () => {
  it("returns latest KPI config version metadata with the public config", async () => {
    const service = createService({
      getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
        kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
        version_no: 3,
        effective_from: "2026-04-26T10:00:00.000Z",
        effective_to: null,
        published_at: "2026-04-26T10:00:00.000Z",
        published_by: "22222222-2222-4222-8222-222222222222",
      })),
    });

    const result = await service.getKpiConfig();

    expect((result as { metadata?: unknown }).metadata).toEqual({
      kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
      versionNo: 3,
      effectiveFrom: "2026-04-26T10:00:00.000Z",
      effectiveTo: null,
      publishedAt: "2026-04-26T10:00:00.000Z",
      publishedBy: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("returns the newly published KPI config version metadata after publish", async () => {
    const publishKpiConfigDraft = jest.fn(async () => ({
      kpi_config_version_id: "33333333-3333-4333-8333-333333333333",
      version_no: 4,
      effective_from: "2026-04-26T12:00:00.000Z",
      effective_to: null,
      published_at: "2026-04-26T12:00:00.000Z",
      published_by: "44444444-4444-4444-8444-444444444444",
    }));
    const service = createService({
      publishKpiConfigDraft,
      getLatestPublishedKpiConfigVersion: jest.fn(async () => ({
        kpi_config_version_id: "33333333-3333-4333-8333-333333333333",
        version_no: 4,
        effective_from: "2026-04-26T12:00:00.000Z",
        effective_to: null,
        published_at: "2026-04-26T12:00:00.000Z",
        published_by: "44444444-4444-4444-8444-444444444444",
      })),
    });

    const result = await service.publishKpiConfigDraft(
      "44444444-4444-4444-8444-444444444444",
    );

    expect(publishKpiConfigDraft).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
    );
    expect(
      (result as { latestPublishedVersion?: { versionNo: number | null } })
        .latestPublishedVersion?.versionNo,
    ).toBe(4);
  });
});
