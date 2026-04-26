# Operational Feed V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled operational feed for company, region, and store-scoped announcements and challenge posts without creating a second scoring or ranking engine.

**Architecture:** Build Operational Feed as its own store-ops slice: database table, contract, service, repository, controller, frontend API, admin management page, and store read page. Feed challenge posts announce focus windows and link to existing ranking/profile surfaces; Competition remains the only owner of staged competition packages, score snapshots, and finalization.

**Tech Stack:** PostgreSQL migrations, NestJS, Jest, React 18, TanStack Query, Vite, Playwright, lucide-react.

---

## Boundary Lock

Operational Feed owns:

- scoped announcement and challenge posts
- draft, publish, pin, unpin, archive
- company, region, and store visibility
- internal links to existing surfaces
- audit events for feed post lifecycle changes

Operational Feed does not own:

- score calculation
- leaderboard materialization
- competition stage creation
- team advancement
- score finalization
- score override behavior

Challenge posts are communication records. They can point to `/store/rankings`, `/store/me`, and future approved internal routes, but they must not create or mutate `ops.competition_*` rows in V1.

## File Map

- Create: `db/migrations/025_operational_feed_posts.sql`
- Modify: `db/schema.sql`
- Create: `backend/nestjs/src/modules/store-ops/application/feed.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/feed.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/feed.service.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/feed.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-feed-post.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/update-feed-post.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
- Create: `admin-web/src/features/feed/contracts.ts`
- Create: `admin-web/src/features/feed/api.ts`
- Create: `admin-web/src/pages/AdminFeedPage.tsx`
- Create: `admin-web/src/pages/StoreFeedPage.tsx`
- Modify: `admin-web/src/pages/StoreShellPreviewPage.tsx`
- Modify: `admin-web/src/App.tsx`
- Create: `admin-web/e2e/feed-surfaces.spec.ts`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `current-state.md`

## Data Contract

Use these backend enum values and frontend literal unions exactly:

```ts
export type FeedPostType = "announcement" | "challenge";
export type FeedVisibilityScopeType = "company" | "region" | "store";
export type FeedPublishStatus = "draft" | "published" | "archived";
```

Use these V1 internal challenge targets:

```ts
export const feedTargetRoutes = ["/store/rankings", "/store/me"] as const;
```

Use these V1 metric options:

```ts
export const feedChallengeMetrics = [
  { metricCode: "total_score", metricLabel: "Total score" },
  { metricCode: "upt", metricLabel: "UPT" },
  { metricCode: "atv", metricLabel: "ATV" },
  { metricCode: "cr", metricLabel: "CR" },
] as const;
```

## Task 1: Database Shape

**Files:**

- Create: `db/migrations/025_operational_feed_posts.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Create the migration.**

```sql
CREATE TABLE IF NOT EXISTS ops.feed_post (
    feed_post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link_label TEXT,
    link_url TEXT,
    visibility_scope_type TEXT NOT NULL,
    visibility_scope_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    metric_code TEXT,
    metric_label TEXT,
    challenge_starts_on DATE,
    challenge_ends_on DATE,
    target_route TEXT,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    updated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (post_type IN ('announcement', 'challenge')),
    CHECK (visibility_scope_type IN ('company', 'region', 'store')),
    CHECK (publish_status IN ('draft', 'published', 'archived')),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
    CHECK (challenge_ends_on IS NULL OR challenge_starts_on IS NULL OR challenge_ends_on >= challenge_starts_on)
);

CREATE INDEX IF NOT EXISTS feed_post_status_window_idx
    ON ops.feed_post (publish_status, is_pinned DESC, published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS feed_post_scope_ids_idx
    ON ops.feed_post USING GIN (visibility_scope_ids);

COMMENT ON TABLE ops.feed_post IS 'Scoped operational announcements and challenge posts. Challenge posts announce focus windows but do not calculate scores.';
```

- [ ] **Step 2: Update `db/schema.sql`.**

Add the same `ops.feed_post` table after `ops.competition_stage_package_plan` or after the competition tables, then add the two indexes in the index section. Keep the comment next to the other table comments.

- [ ] **Step 3: Run schema verification.**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected: TypeScript build still passes because no backend imports have been added yet.

- [ ] **Step 4: Commit database shape.**

```powershell
git add db/migrations/025_operational_feed_posts.sql db/schema.sql
git commit -m "feat: add operational feed post schema"
```

## Task 2: Backend Contract And Service Guards

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/feed.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/feed.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/feed.service.spec.ts`

- [ ] **Step 1: Create the contract file.**

```ts
export type FeedPostType = "announcement" | "challenge";
export type FeedVisibilityScopeType = "company" | "region" | "store";
export type FeedPublishStatus = "draft" | "published" | "archived";

export type FeedScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

export type FeedPost = {
  feedPostId: string;
  postType: FeedPostType;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  visibilityScopeType: FeedVisibilityScopeType;
  visibilityScopeIds: string[];
  isPinned: boolean;
  publishStatus: FeedPublishStatus;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  metricCode: string | null;
  metricLabel: string | null;
  challengeStartsOn: string | null;
  challengeEndsOn: string | null;
  targetRoute: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type FeedActor = {
  actorUserId: string;
  actorRoles: string[];
  actorScope: FeedScope;
};

export type CreateFeedPostInput = FeedActor & {
  postType: FeedPostType;
  title: string;
  body: string;
  linkLabel?: string;
  linkUrl?: string;
  visibilityScopeType: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  isPinned?: boolean;
  publishStatus?: FeedPublishStatus;
  startsAt?: string;
  endsAt?: string;
  metricCode?: string;
  metricLabel?: string;
  challengeStartsOn?: string;
  challengeEndsOn?: string;
  targetRoute?: string;
};

export type UpdateFeedPostInput = FeedActor & {
  feedPostId: string;
  title?: string;
  body?: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
  visibilityScopeType?: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  metricCode?: string | null;
  metricLabel?: string | null;
  challengeStartsOn?: string | null;
  challengeEndsOn?: string | null;
  targetRoute?: string | null;
};

export const feedTargetRoutes = ["/store/rankings", "/store/me"] as const;

export function isInternalFeedRoute(route: string) {
  return route.startsWith("/store/") || route.startsWith("/admin/");
}
```

- [ ] **Step 2: Write failing service tests first.**

Create tests that instantiate `FeedService` with a mocked repository. Cover:

```ts
it("allows HR admin to create a company announcement", async () => {});
it("allows region manager to create only an own-region post", async () => {});
it("rejects region manager company posts", async () => {});
it("rejects region manager posts for another region", async () => {});
it("requires challenge metric, date range, and target route", async () => {});
it("rejects external links", async () => {});
it("rejects archived post updates", async () => {});
```

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/feed.service.spec.ts --runInBand
```

Expected: fail because `FeedService` and `feed.contract.ts` do not exist or do not export the required methods yet.

- [ ] **Step 3: Implement `FeedService`.**

Service rules:

- `SUPER_ADMIN` and `HR_ADMIN` can create, update, publish, pin, unpin, and archive company, region, and store posts.
- `REGION_MANAGER` can create, update, publish, pin, unpin, and archive only `region` posts with exactly one `visibilityScopeId`.
- That region ID must be included in `actorScope.regionIds`.
- Store users cannot write because controller writer endpoints require writer roles.
- `company` scope must use an empty `visibilityScopeIds` array.
- `region` and `store` scope must use at least one ID.
- `challenge` posts require `metricCode`, `metricLabel`, `challengeStartsOn`, `challengeEndsOn`, and `targetRoute`.
- `linkUrl` and `targetRoute` must be internal app routes.
- Archived posts are immutable in V1.

Use Nest exceptions:

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
```

Add service methods:

```ts
listVisibleFeedPosts(input: FeedActor & { limit?: number; offset?: number })
listManageableFeedPosts(input: FeedActor & { limit?: number; offset?: number })
createFeedPost(input: CreateFeedPostInput)
updateFeedPost(input: UpdateFeedPostInput)
publishFeedPost(input: FeedActor & { feedPostId: string })
pinFeedPost(input: FeedActor & { feedPostId: string })
unpinFeedPost(input: FeedActor & { feedPostId: string })
archiveFeedPost(input: FeedActor & { feedPostId: string })
```

Return `buildListResponse` for list methods and `buildCommandResponse` for mutations.

- [ ] **Step 4: Run service tests.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/feed.service.spec.ts --runInBand
```

Expected: pass.

- [ ] **Step 5: Commit service contract.**

```powershell
git add backend/nestjs/src/modules/store-ops/application/feed.contract.ts backend/nestjs/src/modules/store-ops/application/feed.service.ts backend/nestjs/src/modules/store-ops/application/feed.service.spec.ts
git commit -m "feat: add operational feed service guards"
```

## Task 3: Repository Persistence, Visibility, And Audit

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts`

- [ ] **Step 1: Write failing repository tests.**

Cover:

```ts
it("creates a draft feed post and writes feed_post.created audit", async () => {});
it("publishes a draft and writes feed_post.published audit", async () => {});
it("pins and unpins with audit events", async () => {});
it("archives with audit event", async () => {});
it("lists visible posts with pinned posts first", async () => {});
it("includes region posts for store-scoped users whose store belongs to that region", async () => {});
it("excludes other-region posts", async () => {});
it("excludes expired published posts", async () => {});
```

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand
```

Expected: fail because the repository does not exist.

- [ ] **Step 2: Implement repository row mapping.**

Use the current repository style with `DatabaseService`.

```ts
type FeedPostRow = {
  feed_post_id: string;
  post_type: FeedPostType;
  title: string;
  body: string;
  link_label: string | null;
  link_url: string | null;
  visibility_scope_type: FeedVisibilityScopeType;
  visibility_scope_ids: string[];
  is_pinned: boolean;
  publish_status: FeedPublishStatus;
  published_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  metric_code: string | null;
  metric_label: string | null;
  challenge_starts_on: string | null;
  challenge_ends_on: string | null;
  target_route: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3: Implement visible feed query.**

Visibility query must include:

- company posts for every authenticated user
- all posts for company-scoped admins
- region posts when actor region scope intersects post region IDs
- region posts when actor store scope belongs to that region
- store posts when actor store scope intersects post store IDs
- only `published` posts
- current time inside `startsAt` and `endsAt` windows
- pinned posts before normal posts

Use this SQL shape:

```sql
WITH actor_store_regions AS (
  SELECT DISTINCT region_id
  FROM ops.store
  WHERE store_id = ANY($3::uuid[])
)
SELECT *
FROM ops.feed_post fp
WHERE fp.publish_status = 'published'
  AND (fp.starts_at IS NULL OR fp.starts_at <= NOW())
  AND (fp.ends_at IS NULL OR fp.ends_at >= NOW())
  AND (
    fp.visibility_scope_type = 'company'
    OR $1::boolean = TRUE
    OR (
      fp.visibility_scope_type = 'region'
      AND (
        fp.visibility_scope_ids && $2::uuid[]
        OR fp.visibility_scope_ids && ARRAY(SELECT region_id FROM actor_store_regions)
      )
    )
    OR (
      fp.visibility_scope_type = 'store'
      AND fp.visibility_scope_ids && $3::uuid[]
    )
  )
ORDER BY fp.is_pinned DESC, fp.published_at DESC NULLS LAST, fp.updated_at DESC
LIMIT $4::int
OFFSET $5::int
```

Parameters:

- `$1`: `actorScope.companyIds.length > 0`
- `$2`: `actorScope.regionIds`
- `$3`: `actorScope.storeIds`
- `$4`: limit
- `$5`: offset

- [ ] **Step 4: Implement manageable feed query.**

Rules:

- HR admin and super admin see all feed posts.
- Region manager sees only region posts whose `visibility_scope_ids` intersect their `actorScope.regionIds`.
- Store users do not call this endpoint because controller roles block it.

- [ ] **Step 5: Implement audit writes inside mutation transactions.**

Write to `audit.event_log` with:

```ts
{
  correlationId: RequestContextStore.getCorrelationId(),
  actorUserId: input.actorUserId,
  visibilityScopeType: post.visibilityScopeType,
  visibilityScopeIds: post.visibilityScopeIds,
  postType: post.postType,
}
```

Use event types:

- `feed_post.created`
- `feed_post.updated`
- `feed_post.published`
- `feed_post.pinned`
- `feed_post.unpinned`
- `feed_post.archived`
- `feed_post.scope_changed`

Set audit `scope_type` to the post `visibility_scope_type`. For `company` posts, leave company, region, and store ID columns null because V1 company scope is tenant-wide. For `region` posts, set `region_id` when there is exactly one region ID. For `store` posts, set `store_id` when there is exactly one store ID.

- [ ] **Step 6: Run repository tests.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand
```

Expected: pass.

- [ ] **Step 7: Commit repository.**

```powershell
git add backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.spec.ts
git commit -m "feat: persist operational feed posts"
```

## Task 4: Controller, DTOs, And Module Wiring

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/web/feed.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-feed-post.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/update-feed-post.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Add DTOs.**

`create-feed-post.dto.ts`:

```ts
import type { FeedPostType, FeedPublishStatus, FeedVisibilityScopeType } from "../../application/feed.contract";

export class CreateFeedPostDto {
  postType!: FeedPostType;
  title!: string;
  body!: string;
  linkLabel?: string;
  linkUrl?: string;
  visibilityScopeType!: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  isPinned?: boolean;
  publishStatus?: FeedPublishStatus;
  startsAt?: string;
  endsAt?: string;
  metricCode?: string;
  metricLabel?: string;
  challengeStartsOn?: string;
  challengeEndsOn?: string;
  targetRoute?: string;
}
```

`update-feed-post.dto.ts`:

```ts
import type { FeedVisibilityScopeType } from "../../application/feed.contract";

export class UpdateFeedPostDto {
  title?: string;
  body?: string;
  linkLabel?: string | null;
  linkUrl?: string | null;
  visibilityScopeType?: FeedVisibilityScopeType;
  visibilityScopeIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  metricCode?: string | null;
  metricLabel?: string | null;
  challengeStartsOn?: string | null;
  challengeEndsOn?: string | null;
  targetRoute?: string | null;
}
```

- [ ] **Step 2: Add controller routes.**

Use `@Controller()` so one controller can expose both `/feed` and `/admin/feed`.

```ts
@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get("feed")
  @RequireScope("authenticated")
  async listVisibleFeed(@Req() request: FeedRequest, @Query("limit") limit?: string, @Query("offset") offset?: string) {}

  @Get("admin/feed")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async listManageableFeed(@Req() request: FeedRequest, @Query("limit") limit?: string, @Query("offset") offset?: string) {}

  @Post("admin/feed")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async createFeedPost(@Req() request: FeedRequest, @Body() body: CreateFeedPostDto) {}

  @Put("admin/feed/:feedPostId")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async updateFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string, @Body() body: UpdateFeedPostDto) {}

  @Post("admin/feed/:feedPostId/publish")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async publishFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {}

  @Post("admin/feed/:feedPostId/pin")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async pinFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {}

  @Post("admin/feed/:feedPostId/unpin")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async unpinFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {}

  @Post("admin/feed/:feedPostId/archive")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER")
  @RequireScope("authenticated")
  async archiveFeedPost(@Req() request: FeedRequest, @Param("feedPostId") feedPostId: string) {}
}
```

Controller must pass `actorRoles: request.user.roleCodes` and `actorScope: request.user.readScope ?? request.user.scope`.

- [ ] **Step 3: Register in `StoreOpsModule`.**

Add imports and module arrays:

```ts
import { FeedController } from "./web/feed.controller";
import { FeedService } from "./application/feed.service";
import { FeedRepository } from "./infrastructure/feed.repository";
```

Add `FeedController` to `controllers`, `FeedService` and `FeedRepository` to `providers` and `exports`.

- [ ] **Step 4: Run backend targeted tests.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/feed.service.spec.ts src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand
```

Expected: pass.

- [ ] **Step 5: Run backend build.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected: pass.

- [ ] **Step 6: Commit controller wiring.**

```powershell
git add backend/nestjs/src/modules/store-ops/web/feed.controller.ts backend/nestjs/src/modules/store-ops/web/dto/create-feed-post.dto.ts backend/nestjs/src/modules/store-ops/web/dto/update-feed-post.dto.ts backend/nestjs/src/modules/store-ops/store-ops.module.ts
git commit -m "feat: expose operational feed api"
```

## Task 5: Frontend Feed API And Admin Surface

**Files:**

- Create: `admin-web/src/features/feed/contracts.ts`
- Create: `admin-web/src/features/feed/api.ts`
- Create: `admin-web/src/pages/AdminFeedPage.tsx`

- [ ] **Step 1: Add frontend contracts.**

Mirror backend response types:

```ts
export type FeedPostType = 'announcement' | 'challenge'
export type FeedVisibilityScopeType = 'company' | 'region' | 'store'
export type FeedPublishStatus = 'draft' | 'published' | 'archived'

export type FeedPost = {
  feedPostId: string
  postType: FeedPostType
  title: string
  body: string
  linkLabel: string | null
  linkUrl: string | null
  visibilityScopeType: FeedVisibilityScopeType
  visibilityScopeIds: string[]
  isPinned: boolean
  publishStatus: FeedPublishStatus
  publishedAt: string | null
  startsAt: string | null
  endsAt: string | null
  metricCode: string | null
  metricLabel: string | null
  challengeStartsOn: string | null
  challengeEndsOn: string | null
  targetRoute: string | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export const challengeMetricOptions = [
  { metricCode: 'total_score', metricLabel: 'Total score' },
  { metricCode: 'upt', metricLabel: 'UPT' },
  { metricCode: 'atv', metricLabel: 'ATV' },
  { metricCode: 'cr', metricLabel: 'CR' },
]

export const feedTargetRouteOptions = [
  { route: '/store/rankings', label: 'Store rankings' },
  { route: '/store/me', label: 'My performance' },
]
```

- [ ] **Step 2: Add frontend API helpers.**

Use `fetchJson` and `sendJson`:

```ts
export async function getVisibleFeedPosts() {
  return fetchJson<ListResponse<FeedPost>>('/feed?limit=50&offset=0')
}

export async function getAdminFeedPosts() {
  return fetchJson<ListResponse<FeedPost>>('/admin/feed?limit=50&offset=0')
}

export async function createFeedPost(input: CreateFeedPostPayload) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>('/admin/feed', {
    method: 'POST',
    body: input,
  })
}
```

Add helpers for update, publish, pin, unpin, and archive.

- [ ] **Step 3: Build `AdminFeedPage`.**

Page responsibilities:

- use `getAuthLookups()` for store options
- use `getAdminFeedPosts()` for post library
- create announcement and challenge posts
- publish as draft or published based on button
- show status, scope, pin state, type, and challenge metadata
- show action buttons for publish, pin, unpin, archive
- hide company scope for `REGION_MANAGER`
- default `REGION_MANAGER` scope to their first `authSummary.user.readScope.regionIds[0]`
- show `ScreenState` when region manager has no region scope

Use lucide icons, not emoji. Recommended icons:

```ts
import { Megaphone, Pin, Send, Archive, Trophy } from 'lucide-react'
```

UI copy should stay operational and compact:

- Hero eyebrow: `Duyurular`
- Hero title: `Company and region announcements in one controlled feed.`
- Create buttons: `Save draft`, `Publish post`
- Empty state: `No feed posts yet`

The form must use labels for every field and keep target controls at least 44px high through existing `.control-input`, `.control-button`, and `.panel` primitives.

- [ ] **Step 4: Admin page local verification.**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
```

Expected: pass.

- [ ] **Step 5: Commit admin frontend feed.**

```powershell
git add admin-web/src/features/feed/contracts.ts admin-web/src/features/feed/api.ts admin-web/src/pages/AdminFeedPage.tsx
git commit -m "feat: add admin operational feed surface"
```

## Task 6: Store Feed, Store Home Preview, And Routes

**Files:**

- Create: `admin-web/src/pages/StoreFeedPage.tsx`
- Modify: `admin-web/src/pages/StoreShellPreviewPage.tsx`
- Modify: `admin-web/src/App.tsx`

- [ ] **Step 1: Build `StoreFeedPage`.**

Page responsibilities:

- query `getVisibleFeedPosts()`
- render pinned posts first as delivered by API
- show post type, scope, publish date, metric label, challenge date range
- render internal link button for `linkUrl` or `targetRoute`
- show no create/edit controls
- show empty state: `No announcements available for your scope.`

Challenge card layout:

```tsx
<article className="stacked-row">
  <div className="stacked-row-head">
    <div>
      <strong>{post.title}</strong>
      <p className="queue-subtitle">{post.body}</p>
    </div>
    <div className="action-cluster">
      <StatusPill tone={post.postType === 'challenge' ? 'accent' : 'neutral'}>
        {post.postType === 'challenge' ? 'Challenge' : 'Announcement'}
      </StatusPill>
      {post.isPinned ? <StatusPill tone="warning">Pinned</StatusPill> : null}
    </div>
  </div>
</article>
```

- [ ] **Step 2: Add pinned preview to `StoreShellPreviewPage`.**

Add a compact section that:

- queries `getVisibleFeedPosts()`
- filters first three pinned posts
- shows title, type, and link to `/store/feed`
- hides the section when query succeeds with no pinned posts
- shows a small `ScreenState` only when the feed query fails

- [ ] **Step 3: Wire routes and navigation in `App.tsx`.**

Import `Megaphone`:

```ts
import { BarChart3, Bell, DatabaseZap, Fingerprint, KeyRound, Layers3, Megaphone, ShieldCheck, SlidersHorizontal, Target, Trophy } from 'lucide-react'
```

Add lazy imports:

```ts
const AdminFeedPage = lazy(() => import('./pages/AdminFeedPage').then((module) => ({ default: module.AdminFeedPage })))
const StoreFeedPage = lazy(() => import('./pages/StoreFeedPage').then((module) => ({ default: module.StoreFeedPage })))
```

Add admin nav item between Inbox and Competitions:

```tsx
{
  to: '/admin/feed',
  icon: <Megaphone size={18} />,
  label: 'Duyurular',
  roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'],
}
```

Add admin route:

```tsx
<Route
  path="/admin/feed"
  element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'], <AdminFeedPage authSummary={authSummary} />)}
/>
```

Add store shell link near Tasks/Competitions:

```tsx
<NavLink to="/store/feed" className="control-button store-shell-link">
  Duyurular
</NavLink>
```

Add store route:

```tsx
<Route
  path="/store/feed"
  element={<StoreFeedPage authSummary={input.authSummary} />}
/>
```

- [ ] **Step 4: Run frontend build.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
```

Expected: pass with no Vite chunk size warning.

- [ ] **Step 5: Commit store feed surfaces.**

```powershell
git add admin-web/src/pages/StoreFeedPage.tsx admin-web/src/pages/StoreShellPreviewPage.tsx admin-web/src/App.tsx
git commit -m "feat: add store operational feed surface"
```

## Task 7: E2E Coverage And Release Checks

**Files:**

- Create: `admin-web/e2e/feed-surfaces.spec.ts`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `current-state.md`

- [ ] **Step 1: Add Playwright coverage.**

Create route mocks in the same style as existing e2e specs. Cover:

```ts
test('admin feed allows HR admin to publish a challenge post', async ({ page }) => {})
test('region manager feed composer defaults to own region and hides company scope', async ({ page }) => {})
test('store feed renders pinned challenge posts with ranking link', async ({ page }) => {})
test('store home shows pinned feed preview', async ({ page }) => {})
```

Use mocked responses:

```ts
const feedPostFixture = {
  feedPostId: '11111111-1111-4111-8111-111111111111',
  postType: 'challenge',
  title: 'May UPT Challenge',
  body: 'UPT focus window for the current month.',
  linkLabel: 'Open rankings',
  linkUrl: '/store/rankings',
  visibilityScopeType: 'company',
  visibilityScopeIds: [],
  isPinned: true,
  publishStatus: 'published',
  publishedAt: '2026-04-26T09:00:00.000Z',
  startsAt: null,
  endsAt: null,
  metricCode: 'upt',
  metricLabel: 'UPT',
  challengeStartsOn: '2026-05-01',
  challengeEndsOn: '2026-05-31',
  targetRoute: '/store/rankings',
  createdByUserId: '00000000-0000-0000-0000-000000000001',
  updatedByUserId: '00000000-0000-0000-0000-000000000001',
  createdAt: '2026-04-26T09:00:00.000Z',
  updatedAt: '2026-04-26T09:00:00.000Z',
}
```

- [ ] **Step 2: Run frontend targeted E2E.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/feed-surfaces.spec.ts
```

Expected: pass.

- [ ] **Step 3: Run backend targeted tests.**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/feed.service.spec.ts src/modules/store-ops/infrastructure/feed.repository.spec.ts --runInBand
```

Expected: pass.

- [ ] **Step 4: Run release checks.**

Backend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Frontend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected:

- backend lint, tests, build, and `npm audit --omit=dev` pass
- frontend lint, build, Playwright smoke tests, and `npm audit --omit=dev` pass
- no Vite chunk size warning returns

- [ ] **Step 5: Update docs.**

Update `docs/plans/active-next-actions.md`:

- mark `Operational Feed V1` as completed after implementation
- add the next recommended action as `Store/Region Competition Experience Polish` unless implementation reveals a higher-risk feed follow-up

Update `current-state.md`:

- add a `Son Operational Feed V1` section
- include routes, post types, visibility rules, writer permissions, audit events, and verification commands
- include the boundary note that feed challenge posts announce and link, while Competition remains the scoring/stage package owner

- [ ] **Step 6: Commit final docs and test coverage.**

```powershell
git add admin-web/e2e/feed-surfaces.spec.ts docs/plans/active-next-actions.md current-state.md
git commit -m "test: cover operational feed surfaces"
```

## Acceptance Criteria

- `/api/feed` returns only visible published posts for the current authenticated user.
- `/api/admin/feed` returns only posts manageable by the current writer role.
- `REGION_MANAGER` cannot create company posts.
- `REGION_MANAGER` cannot create posts for another region.
- Store-scoped users can see company posts, own-store posts, and region posts for their store region.
- Pinned posts sort above normal posts.
- Expired posts are excluded from the store feed.
- Challenge posts require metric, date range, and internal target route.
- Challenge posts do not create or mutate competition stages, teams, plans, score snapshots, or warnings.
- Admin nav shows `Duyurular` for `SUPER_ADMIN`, `HR_ADMIN`, and `REGION_MANAGER`.
- Store shell shows `Duyurular`.
- Store home shows compact pinned preview.
- Backend release check passes.
- Frontend release check passes.

## Self-Review Checklist

- [x] Spec coverage: every requirement in `docs/superpowers/specs/2026-04-26-operational-feed-v1-design.md` maps to a task above.
- [x] Placeholder scan: the plan contains no unresolved placeholders or vague implementation instructions.
- [x] Type consistency: backend contract names match frontend contract names where API JSON crosses the boundary.
- [x] Boundary consistency: no task asks Feed to calculate scores or create competition stage packages.
- [x] UI consistency: pages use existing primitives, lucide icons, labeled controls, clear empty states, and route-level lazy loading.

Self-review result:

- Scope, permission, visibility, pinning, audit, admin UI, store UI, and store-home preview are all assigned to concrete tasks.
- The only deliberate V1 product exclusion is media, comments, reactions, notifications, acknowledgements, and a new leaderboard; these remain outside the task list by design.
- Region posts are visible to store-scoped users through store-to-region resolution in the repository query, so region announcements do not silently disappear for store users.
