import { FeedRepository } from "./feed.repository";
import type { FeedPost } from "../application/feed.contract";

const actorUserId = "00000000-0000-4000-8000-000000000001";
const companyId = "00000000-0000-4000-8000-000000000100";
const regionId = "11111111-1111-4111-8111-111111111111";
const storeId = "22222222-2222-4222-8222-222222222222";

function createFeedPostRow(overrides?: Record<string, unknown>) {
  return {
    feed_post_id: "33333333-3333-4333-8333-333333333333",
    post_type: "announcement",
    title: "Store agenda",
    body: "New operational note",
    link_label: null,
    link_url: null,
    visibility_scope_type: "company",
    visibility_scope_ids: [],
    is_pinned: false,
    publish_status: "draft",
    published_at: null,
    starts_at: null,
    ends_at: null,
    metric_code: null,
    metric_label: null,
    challenge_starts_on: null,
    challenge_ends_on: null,
    target_route: null,
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
    created_at: "2026-04-26T09:00:00.000Z",
    updated_at: "2026-04-26T09:00:00.000Z",
    ...overrides,
  };
}

function createRepositoryHarness(rows?: Record<string, unknown>[]) {
  const executedSql: string[] = [];
  const executedParams: unknown[][] = [];
  const queryMock = jest.fn(
    async (
      sql: string,
      params: unknown[] = [],
    ): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("RETURNING")) {
        return { rowCount: 1, rows: rows ?? [createFeedPostRow()] };
      }

      return { rowCount: 1, rows: rows ?? [createFeedPostRow()] };
    },
  );
  const client = {
    query: queryMock,
  };
  const databaseQueryMock: jest.Mock<
    Promise<{ rowCount: number; rows: Record<string, unknown>[] }>,
    [string, unknown[]?]
  > = jest.fn(async (_sql: string, _params: unknown[] = []) => ({
    rowCount: rows?.length ?? 1,
    rows: (rows ?? [createFeedPostRow()]) as Record<string, unknown>[],
  }));
  const databaseService = {
    withTransaction: jest.fn(async (work: (transactionClient: typeof client) => Promise<unknown>) =>
      work(client),
    ),
    query: databaseQueryMock,
  };

  return {
    repository: new FeedRepository(databaseService as never),
    databaseService,
    databaseQueryMock,
    client,
    executedSql,
    executedParams,
  };
}

describe("FeedRepository", () => {
  it("creates a draft feed post and writes feed_post.created audit", async () => {
    const { repository, executedSql, executedParams } = createRepositoryHarness();

    const result = await repository.createFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      postType: "announcement",
      title: "Store agenda",
      body: "New operational note",
      visibilityScopeType: "company",
      visibilityScopeIds: [],
      isPinned: false,
      publishStatus: "draft",
    });

    expect(result).toEqual(
      expect.objectContaining<Partial<FeedPost>>({
        feedPostId: "33333333-3333-4333-8333-333333333333",
        publishStatus: "draft",
      }),
    );
    expect(executedSql.join("\n")).toContain("INSERT INTO ops.feed_post");
    expect(executedParams.flat()).toContain("feed_post.created");
  });

  it("publishes a draft and writes feed_post.published audit", async () => {
    const { repository, executedSql, executedParams } = createRepositoryHarness(
      [createFeedPostRow({ publish_status: "published", published_at: "2026-04-26T10:00:00.000Z" })],
    );

    const result = await repository.publishFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      feedPostId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.publishStatus).toBe("published");
    expect(executedSql.join("\n")).toContain("publish_status = 'published'");
    expect(executedParams.flat()).toContain("feed_post.published");
  });

  it("pins and unpins with audit events", async () => {
    const { repository, executedParams } = createRepositoryHarness(
      [createFeedPostRow({ is_pinned: true })],
    );

    await repository.pinFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      feedPostId: "33333333-3333-4333-8333-333333333333",
    });
    await repository.unpinFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      feedPostId: "33333333-3333-4333-8333-333333333333",
    });

    expect(executedParams.flat()).toContain("feed_post.pinned");
    expect(executedParams.flat()).toContain("feed_post.unpinned");
  });

  it("archives with audit event", async () => {
    const { repository, executedSql, executedParams } = createRepositoryHarness(
      [createFeedPostRow({ publish_status: "archived" })],
    );

    const result = await repository.archiveFeedPost({
      actorUserId,
      actorRoles: ["HR_ADMIN"],
      actorScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      feedPostId: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.publishStatus).toBe("archived");
    expect(executedSql.join("\n")).toContain("publish_status = 'archived'");
    expect(executedParams.flat()).toContain("feed_post.archived");
  });

  it("lists visible posts with pinned posts first", async () => {
    const rows = [
      createFeedPostRow({ feed_post_id: "44444444-4444-4444-8444-444444444444", is_pinned: true }),
      createFeedPostRow({ feed_post_id: "55555555-5555-4555-8555-555555555555", is_pinned: false }),
    ];
    const { repository, databaseQueryMock } = createRepositoryHarness(rows);

    const result = await repository.listVisibleFeedPosts({
      actorScope: { companyIds: [], regionIds: [regionId], storeIds: [storeId] },
      limit: 50,
      offset: 0,
    });

    const sql = databaseQueryMock.mock.calls[0][0] as string;
    expect(result[0].isPinned).toBe(true);
    expect(sql).toContain("ORDER BY fp.is_pinned DESC");
  });

  it("includes region posts for store-scoped users whose store belongs to that region", async () => {
    const { repository, databaseQueryMock } = createRepositoryHarness();

    await repository.listVisibleFeedPosts({
      actorScope: { companyIds: [], regionIds: [], storeIds: [storeId] },
      limit: 50,
      offset: 0,
    });

    const sql = databaseQueryMock.mock.calls[0][0] as string;
    const params = databaseQueryMock.mock.calls[0][1] as unknown[];
    expect(sql).toContain("actor_store_regions");
    expect(sql).toContain("ARRAY(SELECT region_id FROM actor_store_regions)");
    expect(params[2]).toEqual([storeId]);
  });

  it("excludes other-region posts", async () => {
    const { repository, databaseQueryMock } = createRepositoryHarness();

    await repository.listVisibleFeedPosts({
      actorScope: { companyIds: [], regionIds: [regionId], storeIds: [] },
      limit: 50,
      offset: 0,
    });

    const sql = databaseQueryMock.mock.calls[0][0] as string;
    expect(sql).toContain("fp.visibility_scope_ids && $2::uuid[]");
  });

  it("excludes expired published posts", async () => {
    const { repository, databaseQueryMock } = createRepositoryHarness();

    await repository.listVisibleFeedPosts({
      actorScope: { companyIds: [], regionIds: [], storeIds: [storeId] },
      limit: 50,
      offset: 0,
    });

    const sql = databaseQueryMock.mock.calls[0][0] as string;
    expect(sql).toContain("fp.starts_at IS NULL OR fp.starts_at <= NOW()");
    expect(sql).toContain("fp.ends_at IS NULL OR fp.ends_at >= NOW()");
  });

  it("returns no visible posts without querying when actor scope is empty", async () => {
    const { repository, databaseQueryMock } = createRepositoryHarness();

    await expect(
      repository.listVisibleFeedPosts({
        actorScope: { companyIds: [], regionIds: [], storeIds: [] },
        limit: 50,
        offset: 0,
      }),
    ).resolves.toEqual([]);

    expect(databaseQueryMock).not.toHaveBeenCalled();
  });
});
