# Operational Feed V1 Design

## Goal

Add a controlled operational feed where authorized users can publish company, region, or store-scoped announcements and challenge posts. The feed becomes the shared product surface for company agenda, motivation, and campaign communication without creating a second scoring or ranking system.

## Superseded Direction

This design supersedes `Competition Format Registry V1` as the immediate next feature direction.

The registry idea was technically possible, but it framed UPT-style challenges as new competition formats and stage packages. The refined product need is different: HR and region leaders need a communication surface where they can announce focus areas and link users to existing performance/ranking pages.

The existing competition stage package module remains useful for true staged competitions, but it should not become the shell for social announcements or simple metric challenges.

## CODEX DÜRÜST YORUM

This is the better product direction.

The previous registry plan risked creating a second source of truth for rankings. Users already have profile, summary, and ranking screens. If we build a separate challenge scoring engine too early, the system will eventually have to answer which score is the real one.

Operational Feed V1 avoids that debt. A UPT challenge is a post with context, dates, scope, and a link to the existing ranking/profile experience. The feed gives the product a living company-gathering surface while keeping performance calculation in the performance/ranking modules.

The risk is social sprawl. If V1 adds comments, likes, media uploads, mentions, reactions, and notifications immediately, it becomes a social network instead of an operational tool. V1 should stay controlled: post, publish, pin, scope, link, audit. Attachments and richer social behavior can come later as planned investments.

Recommendation: continue with Operational Feed V1, mark Competition Format Registry V1 as superseded for now, and build the feed as its own bounded context.

## Product Model

Operational Feed is a company communication surface.

V1 post types:

- `announcement`: standard operational announcement.
- `challenge`: competition or focus-area announcement such as "May UPT Challenge".

Challenge posts do not calculate score and do not own leaderboard state. They point users toward existing surfaces:

- `/store/me`
- `/store/rankings`
- future summary or dashboard routes

## Routes And Placement

Operational Feed is not part of `Competitions` and not part of `Inbox`.

Recommended routes:

- Admin/management surface: `/admin/feed`
- Store/user surface: `/store/feed`

Navigation placement:

- Admin left nav: `Duyurular`, between `Inbox` and `Competitions`.
- Store shell: `Duyurular` as a first-class route.
- Store home: compact pinned-post preview, linking to `/store/feed`.

Product distinction:

- `Inbox`: work queue and actions assigned to the user.
- `Duyurular`: company, region, and store communication stream.
- `Competitions`: staged competition administration and score finalization.

## Roles And Publishing Permissions

V1 writer permissions:

- `SUPER_ADMIN`: can create, publish, pin, archive, and manage all feed posts.
- `HR_ADMIN`: can create, publish, pin, archive, and manage company, region, and store-scoped posts.
- `REGION_MANAGER`: can create, publish, pin, archive, and manage posts scoped only to their own assigned/read region.

V1 reader permissions:

- All authenticated users can read feed posts visible to their scope.

Region manager rule:

- Default publishing scope is the manager's own region.
- Region manager cannot publish company-wide posts in V1.
- Region manager cannot publish to another region in V1.
- This policy may be relaxed later through explicit permission/config, not through hidden frontend-only behavior.

## Visibility Rules

Each post has a visibility scope.

Supported V1 scopes:

- `company`: visible to all authenticated users in the tenant/company, including users whose resolved scope is region or store based.
- `region`: visible only to users whose read scope includes that region.
- `store`: visible only to users whose read scope includes that store, or whose employee/store assignment resolves to that store.

Important rule:

- A region post is not visible to other regions.
- The feed may feel like a company-wide gathering place, but each user sees only posts that match their resolved scope.

## Post Fields

V1 post fields:

- `feedPostId`
- `postType`: `announcement` or `challenge`
- `title`
- `body`
- `linkLabel`
- `linkUrl`
- `visibilityScopeType`: `company`, `region`, or `store`
- `visibilityScopeIds`
- `isPinned`
- `publishStatus`: `draft`, `published`, or `archived`
- `publishedAt`
- `startsAt`
- `endsAt`
- `createdByUserId`
- `updatedByUserId`
- `createdAt`
- `updatedAt`

V1 links should be internal app routes by default. Challenge posts should link to known product surfaces such as `/store/rankings` or `/store/me`. External links can be added later with explicit allowlist and security review.

Challenge-specific optional fields:

- `metricCode`: for example `upt`, `atv`, `cr`, `total_score`
- `metricLabel`: for example `UPT`
- `challengeStartsOn`
- `challengeEndsOn`
- `targetRoute`: for example `/store/rankings`

The challenge fields describe the announcement. They do not create a new scoring contract.

## Attachments And Media Boundary

V1 does not include image upload or media rendering.

The design should leave room for a later attachment table:

- `feedPostAttachmentId`
- `feedPostId`
- `attachmentType`
- `storageKey`
- `fileName`
- `mimeType`
- `createdAt`

Do not render fake empty image slots in V1. The V1 UI should be clean text/link communication.

## Pinning

Pinned posts appear above normal feed posts.

Rules:

- HR/Admin can pin posts within their allowed scope.
- Region manager can pin posts only within their own region.
- Store users see pinned posts only when the post is visible to their scope.
- Store home should show a compact pinned-post preview.

V1 does not need per-user dismiss or acknowledgement. That belongs to checklist/acknowledgement style workflows, not to the first feed version.

## Data Ownership

Recommended schema owner: `ops`.

Suggested table:

- `ops.feed_post`

Reason:

- Feed posts are operational communication records, not imported staging data, reporting snapshots, or pure audit entries.

Audit owner:

- Publish, edit, pin/unpin, archive, and scope changes should write `audit.event_log`.

Suggested event types:

- `feed_post.created`
- `feed_post.updated`
- `feed_post.published`
- `feed_post.pinned`
- `feed_post.unpinned`
- `feed_post.archived`
- `feed_post.scope_changed`

## Backend Shape

Suggested endpoints:

- `GET /api/feed`
  - Returns posts visible to the current authenticated user.
  - Supports pinned-first ordering.

- `GET /api/admin/feed`
  - Returns manageable posts for authorized writers.
  - HR/Admin sees broad manageable posts.
  - Region manager sees only their region-scoped manageable posts.

- `POST /api/admin/feed`
  - Creates a draft or published post depending on payload.

- `PUT /api/admin/feed/:postId`
  - Updates editable fields and scope within the actor's permission boundary.

- `POST /api/admin/feed/:postId/publish`
  - Publishes a draft.

- `POST /api/admin/feed/:postId/pin`
  - Pins within actor scope.

- `POST /api/admin/feed/:postId/unpin`
  - Unpins within actor scope.

- `POST /api/admin/feed/:postId/archive`
  - Archives a post.

Server-side scope enforcement is required. Frontend disabling is not enough.

## Frontend Shape

Admin `/admin/feed`:

- Feed post composer.
- Post library with status, scope, pin state, and post type.
- Role-aware scope selector.
- Region manager composer defaults to their own region and does not offer company or other-region scope in V1.
- Challenge post mode adds metric, date range, and target route fields.

Store `/store/feed`:

- Read-only feed.
- Pinned posts first.
- Tags for post type and scope.
- Challenge posts show metric/date context and a link button to the existing ranking/profile route.

Store home:

- Compact pinned post section.
- Link to full `/store/feed`.

## Error And Empty States

Admin errors:

- unauthorized scope selection
- missing title/body
- invalid link
- cannot edit archived post unless policy later allows restore

Store empty state:

- "No announcements available for your scope."

Permission empty state:

- If a user can read but not publish, show feed read surface only.

## Test Strategy

Backend tests:

- HR/Admin can create company, region, and store posts.
- Region manager can create only own-region posts.
- Region manager cannot create company posts.
- Region manager cannot create other-region posts.
- Store/personnel users read only visible posts.
- Pinned posts sort above normal posts.
- Publish/pin/archive actions write audit events.

Frontend tests:

- Admin nav shows `Duyurular` for `SUPER_ADMIN`, `HR_ADMIN`, and `REGION_MANAGER`.
- Store shell shows `Duyurular`.
- Region manager composer defaults to own region and hides company scope.
- HR/Admin can select company scope.
- Store feed renders visible pinned and challenge posts.
- Challenge post link goes to `/store/rankings` or `/store/me`.

Release checks:

- backend `check:release`
- frontend `check:release`

## Non-Goals

- No comments in V1.
- No likes or reactions in V1.
- No image upload in V1.
- No push notification in V1.
- No per-user acknowledgement in V1.
- No new leaderboard or scoring engine in V1.
- No replacement for checklist acknowledgement or task inbox flows.
