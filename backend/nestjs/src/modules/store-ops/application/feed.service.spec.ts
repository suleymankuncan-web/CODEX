import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { FeedService } from "./feed.service";
import type { FeedPost } from "./feed.contract";

const actorUserId = "00000000-0000-4000-8000-000000000001";
const marmaraRegionId = "11111111-1111-4111-8111-111111111111";
const egeRegionId = "22222222-2222-4222-8222-222222222222";

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
        companyIds: ["00000000-0000-4000-8000-000000000100"],
        regionIds: [],
        storeIds: [],
      },
      postType: "announcement",
      title: "May agenda",
      body: "Focus on service quality this month.",
      visibilityScopeType: "company",
      visibilityScopeIds: [marmaraRegionId],
    });

    expect(result.command.status).toBe("created");
    expect(repository.createFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        postType: "announcement",
        title: "May agenda",
        body: "Focus on service quality this month.",
        visibilityScopeType: "company",
        visibilityScopeIds: [],
        publishStatus: "draft",
        isPinned: false,
      }),
    );
  });

  it("allows region manager to create only an own-region post", async () => {
    const repository = createRepositoryMock();
    repository.createFeedPost.mockResolvedValue(
      createFeedPost({
        visibilityScopeType: "region",
        visibilityScopeIds: [marmaraRegionId],
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
      postType: "announcement",
      title: "Marmara focus",
      body: "Regional announcement",
      visibilityScopeType: "region",
      visibilityScopeIds: [marmaraRegionId],
    });

    expect(repository.createFeedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        visibilityScopeType: "region",
        visibilityScopeIds: [marmaraRegionId],
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

  it("rejects region manager posts for another region", async () => {
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
        title: "Ege focus",
        body: "Wrong region",
        visibilityScopeType: "region",
        visibilityScopeIds: [egeRegionId],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
});
