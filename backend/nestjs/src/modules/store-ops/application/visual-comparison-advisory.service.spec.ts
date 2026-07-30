import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { VisualComparisonAdvisoryService } from "./visual-comparison-advisory.service";

describe("VisualComparisonAdvisoryService", () => {
  const repository = {
    list: jest.fn(async () => ({ items: [], total: 0, limit: 25, offset: 0 })),
    detail: jest.fn(async () => ({ status: "completed", suggestion: "pass", confidence: 0.9 })),
    resolveMedia: jest.fn(async () => ({
      media_asset_id: "44444444-4444-4444-8444-444444444444",
      company_id: "11111111-1111-4111-8111-111111111111",
      region_id: "22222222-2222-4222-8222-222222222222",
      store_id: "33333333-3333-4333-8333-333333333333",
    })),
    review: jest.fn(async (input) => input),
  };
  const media = { readContent: jest.fn(async () => ({ body: Buffer.from("x"), contentType: "image/webp" })) };
  const config = {
    visualComparisonAdvisoryReviewEnabled: true,
    visualComparisonCompanyId: "11111111-1111-4111-8111-111111111111",
    visualComparisonReferenceSetId: "44444444-4444-4444-8444-444444444444",
    visualComparisonNotBefore: new Date("2026-07-30T00:00:00.000Z"),
    qwenVisualComparisonRuntimeConfiguration: { minimumAdvisoryConfidence: 0.6 },
  };
  const user = {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    roleCodes: ["REGION_MANAGER"],
    scope: { companyIds: [], regionIds: [], storeIds: [] },
    readScope: { companyIds: [], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: ["33333333-3333-4333-8333-333333333333"] },
    assignedStoreIds: ["33333333-3333-4333-8333-333333333333"],
    roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: ["22222222-2222-4222-8222-222222222222"], storeIds: [] } },
  };

  beforeEach(() => jest.clearAllMocks());

  it("[FR-7][AC-7] intersects Region Manager role and action-store scopes", async () => {
    const service = new VisualComparisonAdvisoryService(repository as never, media as never, config as never);
    await service.list(user as never, { limit: 25, offset: 0 });
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({
      regionIds: user.roleScopes.REGION_MANAGER.regionIds,
      storeIds: user.actionScope.assignedStoreIds,
      companyId: config.visualComparisonCompanyId,
      referenceSetId: config.visualComparisonReferenceSetId,
      modelId: "qwen3.7-plus-2026-05-26",
    }));
  });

  it("[FR-10][EC-5] exposes accept capability only above the configured threshold", async () => {
    repository.list.mockResolvedValueOnce({ items: [
      { status: "completed", suggestion: "pass", confidence: 0.59 },
      { status: "completed", suggestion: "partial", confidence: 0.6 },
      { status: "abstained", suggestion: "abstain", confidence: 0.9 },
    ], total: 3, limit: 25, offset: 0 } as never);
    const service = new VisualComparisonAdvisoryService(repository as never, media as never, config as never);
    const result = await service.list(user as never, { limit: 25, offset: 0 });
    expect(result.items.map((item) => item.acceptAllowed)).toEqual([false, true, false]);
  });

  it("[NFR-2][EC-4] fails closed for disabled or incomplete scope", async () => {
    await expect(new VisualComparisonAdvisoryService(repository as never, media as never, {
      visualComparisonAdvisoryReviewEnabled: false,
    } as never).list(user as never, { limit: 25, offset: 0 })).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(new VisualComparisonAdvisoryService(repository as never, media as never, config as never)
      .list({ ...user, actionScope: { assignedStoreIds: [] } } as never, { limit: 25, offset: 0 }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it("[FR-10][AC-10] validates the typed final review command", async () => {
    const service = new VisualComparisonAdvisoryService(repository as never, media as never, config as never);
    expect(() => service.review(user as never, "55555555-5555-4555-8555-555555555555", {
      decision: "override", reason: "Saha düzeni referanstan belirgin uzak.",
    })).toThrow(ForbiddenException);
    await service.review(user as never, "55555555-5555-4555-8555-555555555555", {
      decision: "override", finalDecision: "fail", reason: "Saha düzeni referanstan belirgin uzak.",
    });
    expect(repository.review).toHaveBeenCalledWith(expect.objectContaining({
      decision: "override", finalDecision: "fail", minimumConfidence: 0.6,
    }));
  });

  it("[FR-9][AC-9] narrows media reads to the exact authorized asset scope", async () => {
    const service = new VisualComparisonAdvisoryService(repository as never, media as never, config as never);
    await service.mediaContent(user as never, "55555555-5555-4555-8555-555555555555", "evidence");
    expect(media.readContent).toHaveBeenCalledWith(expect.objectContaining({
      actorScope: {
        companyIds: ["11111111-1111-4111-8111-111111111111"],
        regionIds: ["22222222-2222-4222-8222-222222222222"],
        storeIds: ["33333333-3333-4333-8333-333333333333"],
      },
      variant: "thumbnail",
    }));
  });
});
