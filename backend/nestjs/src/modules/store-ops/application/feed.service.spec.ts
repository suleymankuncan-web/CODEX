import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FeedService } from "./feed.service";
import type { FeedPost } from "./feed.contract";

const actorUserId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000100";
const otherCompanyId = "00000000-0000-4000-8000-000000000200";
const marmaraRegionId = "11111111-1111-4111-8111-111111111111";
const egeRegionId = "22222222-2222-4222-8222-222222222222";
const assignedStoreId = "44444444-4444-4444-8444-444444444444";
const otherStoreId = "55555555-5555-4555-8555-555555555555";

function createRepositoryMock() {
  return {
    listVisibleFeedPosts: jest.fn(),
    listManageableFeedPosts: jest.fn(),
    getFeedPost: jest.fn(),
    createFeedPost: jest.fn(),
    updateFeedPost: jest.fn(),
    publishFeedPost: jest.fn(),
    pinFeedPost: jest.fn(),
    unpinFeedPost: jest.fn(),
    archiveFeedPost: jest.fn(),
  };
}

function createFeedPost(overrides?: Partial<FeedPost>): FeedPost {
  return {
    feedPostId: "33333333-3333-4333-8333-333333333333",
    postType: "announcement",
    title: "Store agenda",
    body: "New operational note",
    linkLabel: null,
    linkUrl: null,
    visibilityScopeType: "company",
    visibilityScopeIds: [],
    isPinned: false,
    publishStatus: "draft",
    publishedAt: null,
    startsAt: null,
    endsAt: null,
    metricCode: null,
    metricLabel: null,
    challengeStartsOn: null,
    challengeEndsOn: null,
    targetRoute: null,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
    createdAt: "2026-04-26T09:00:00.000Z",
    updatedAt: "2026-04-26T09:00:00.000Z",
    ...overrides,
  };
}

describe("FeedService", () => {
  it("allows HR admin to create a company announcement", async () => {
    const repository = createRepositoryMock();
    repository.createFeedPost.mockResolvedValue(createFeedPost());
    const service = new FeedService(repository as never);

    const result = await service.createFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: {
        companyIds: [companyId],
        regionIds: [],
        storeIds: [],
      },
      postType: "announcement",
      title: "May agenda",
      body: "Focus on service quality this month.",
      visibilityScopeType: "company",
    });

    expect(result.command.status).toBe("created");
    expect(repository.createFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        postType: "announcement",
        title: "May agenda",
        body: "Focus on service quality this month.",
        visibilityScopeType: "company",
        visibilityScopeIds: [companyId],
        publishStatus: "draft",
        isPinned: false,
      }),
    );
  });

  it("rejects HR admin company posts outside their company scope", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);

    await expect(
      service.createFeedPost({
        actorUserId,
        actorRoles: ["HR_ADMIN"],
        actorScope: {
          companyIds: [companyId],
          regionIds: [],
          storeIds: [],
        },
        postType: "announcement",
        title: "Other company",
        body: "This should stay tenant scoped.",
        visibilityScopeType: "company",
        visibilityScopeIds: [otherCompanyId],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("allows a Region Manager to publish only to directly assigned stores", async () => {
    const repository = createRepositoryMock();
    repository.createFeedPost.mockResolvedValue(
      createFeedPost({
        visibilityScopeType: "store",
        visibilityScopeIds: [assignedStoreId],
      }),
    );
    const service = new FeedService(repository as never);

    await service.createFeedPost({
      actorUserId,
      actorRoles: ["REGION_MANAGER"],
      actorScope: {
        companyIds: [],
        regionIds: [marmaraRegionId],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actorRegionManagerStoreIds: [assignedStoreId],
      postType: "announcement",
      title: "Marmara focus",
      body: "Regional announcement",
      visibilityScopeType: "store",
      visibilityScopeIds: [assignedStoreId],
    });

    expect(repository.createFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityScopeType: "store",
        visibilityScopeIds: [assignedStoreId],
      }),
    );
  });

  it("rejects region manager company posts", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);

    await expect(
      service.createFeedPost({
        actorUserId,
        actorRoles: ["REGION_MANAGER"],
        actorScope: {
          companyIds: [],
          regionIds: [marmaraRegionId],
          storeIds: [],
        },
        postType: "announcement",
        title: "All stores",
        body: "Company-wide announcement",
        visibilityScopeType: "company",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("rejects region-scoped posts even when the manager has a legacy region id", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);

    await expect(
      service.createFeedPost({
        actorUserId,
        actorRoles: ["REGION_MANAGER"],
        actorScope: {
          companyIds: [],
          regionIds: [marmaraRegionId],
          storeIds: [],
        },
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actorRegionManagerStoreIds: [assignedStoreId],
        postType: "announcement",
        title: "Ege focus",
        body: "Wrong region",
        visibilityScopeType: "region",
        visibilityScopeIds: [marmaraRegionId],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("rejects a store post outside direct assignments despite matching read scope", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);
    await expect(service.createFeedPost({
      actorUserId, actorRoles: ["REGION_MANAGER"],
      actorScope: { companyIds: [], regionIds: [egeRegionId], storeIds: [otherStoreId] },
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actorRegionManagerStoreIds: [assignedStoreId],
      postType: "announcement", title: "Outside", body: "Outside assignment",
      visibilityScopeType: "store", visibilityScopeIds: [otherStoreId],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("lists manager feed posts through direct stores and not legacy regions", async () => {
    const repository = createRepositoryMock();
    repository.listManageableFeedPosts.mockResolvedValue([]);
    const service = new FeedService(repository as never);
    await service.listManageableFeedPosts({
      actorUserId, actorRoles: ["REGION_MANAGER"],
      actorScope: { companyIds: [companyId], regionIds: [marmaraRegionId], storeIds: [otherStoreId] },
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actorRegionManagerStoreIds: [assignedStoreId],
    });
    expect(repository.listManageableFeedPosts).toHaveBeenCalledWith(expect.objectContaining({
      actorScope: { companyIds: [], regionIds: [], storeIds: [assignedStoreId] },
    }));
  });

  it("does not treat a different role's action store as a Region Manager store", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);
    await expect(service.createFeedPost({
      actorUserId, actorRoles: ["REGION_MANAGER", "STORE_MANAGER"],
      actorScope: { companyIds: [], regionIds: [], storeIds: [otherStoreId] },
      actorActionScope: { assignedStoreIds: [assignedStoreId, otherStoreId] },
      actorRegionManagerStoreIds: [assignedStoreId],
      postType: "announcement", title: "Outside", body: "Outside assignment",
      visibilityScopeType: "store", visibilityScopeIds: [otherStoreId],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("requires challenge metric, date range, and target route", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);

    await expect(
      service.createFeedPost({
        actorUserId,
        actorRoles: ["HR_ADMIN"],
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000100"],
          regionIds: [],
          storeIds: [],
        },
        postType: "challenge",
        title: "May UPT Challenge",
        body: "UPT focus window",
        visibilityScopeType: "company",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("rejects external links", async () => {
    const repository = createRepositoryMock();
    const service = new FeedService(repository as never);

    await expect(
      service.createFeedPost({
        actorUserId,
        actorRoles: ["HR_ADMIN"],
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000100"],
          regionIds: [],
          storeIds: [],
        },
        postType: "announcement",
        title: "External link",
        body: "This should stay internal",
        linkUrl: "https://example.com",
        visibilityScopeType: "company",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createFeedPost).not.toHaveBeenCalled();
  });

  it("rejects archived post updates", async () => {
    const repository = createRepositoryMock();
    repository.getFeedPost.mockResolvedValue(
      createFeedPost({
        publishStatus: "archived",
      }),
    );
    const service = new FeedService(repository as never);

    await expect(
      service.updateFeedPost({
        actorUserId,
        actorRoles: ["HR_ADMIN"],
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000100"],
          regionIds: [],
          storeIds: [],
        },
        feedPostId: "33333333-3333-4333-8333-333333333333",
        title: "Cannot change",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateFeedPost).not.toHaveBeenCalled();
  });

  it("does not let a Region Manager take over an out-of-scope post by changing its target", async () => {
    const repository = createRepositoryMock();
    repository.getFeedPost.mockResolvedValue(createFeedPost({
      visibilityScopeType: "store", visibilityScopeIds: [otherStoreId],
    }));
    const service = new FeedService(repository as never);

    await expect(service.updateFeedPost({
      actorUserId, actorRoles: ["REGION_MANAGER"],
      actorScope: { companyIds: [], regionIds: [marmaraRegionId], storeIds: [assignedStoreId] },
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actorRegionManagerStoreIds: [assignedStoreId],
      feedPostId: "33333333-3333-4333-8333-333333333333",
      visibilityScopeType: "store", visibilityScopeIds: [assignedStoreId],
      title: "Take over post",
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateFeedPost).not.toHaveBeenCalled();
  });
});
