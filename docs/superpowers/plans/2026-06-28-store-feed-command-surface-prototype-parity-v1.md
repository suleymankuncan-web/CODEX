# Store Feed Command Surface Prototype Parity V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the locked `/store/feed` React prototype into production with visible parity and the same workflow: Region Manager can post, pin, edit, unpin, and remove regional announcements; Store Manager and other store roles see the same premium feed surface in read-only mode.

**Architecture:** Keep `/store/feed` as the single Store-shell route. Replace the current StoreSurface-primitives feed with a role-aware command/read-only surface that uses the locked prototype as the visual contract. Read data comes from `GET /api/feed`. Region Manager write commands reuse the existing `admin/feed` command endpoints and remain scope-guarded by backend role/scope checks.

**Tech Stack:** React, TanStack Query, existing feed DTOs, existing NestJS feed endpoints, lucide icons already used by the prototype, route-local CSS copied from the locked prototype and adapted to production selectors. shadcn or shared primitives may be used only where they preserve exact prototype parity.

---

## Evidence From Current Code

- `admin-web/src/pages/StoreFeedPage.tsx` currently only reads `getVisibleFeedPosts()` and renders old `StoreSurfacePage`, `StoreMetricCard`, `StoreSectionCard`, and `StoreStackedRow` primitives. It has no Region Manager composer or post action menu.
- `admin-web/src/features/feed/api.ts` already has create, publish, pin, unpin, and archive wrappers, but it does not expose the existing `PUT /admin/feed/:feedPostId` update endpoint.
- `backend/nestjs/src/modules/store-ops/web/feed.controller.ts` already allows `SUPER_ADMIN`, `HR_ADMIN`, and `REGION_MANAGER` for `GET/POST/PUT /admin/feed` and pin/unpin/archive commands.
- `backend/nestjs/src/modules/store-ops/application/feed.service.ts` already enforces writable scope. Region Manager can only write inside their own region scope.
- `backend/nestjs/src/modules/store-ops/infrastructure/feed.repository.ts` already resolves visible region posts for store-scoped users by mapping their `storeIds` to store regions, so Store Manager/personnel can see Region Manager region posts without a new backend join.
- `admin-web/src/app/store-route-registry.ts` exposes `/store/feed` to authenticated Store-shell roles, including visual merchandiser. This route must stay readable for all eligible store personas.
- Locked prototype: `admin-web/src/prototypes/store-feed-region-composer-v1.tsx`, SHA-256 `145040F4C55444465861059D7DFD5A8EF619865C56AECD1B07224C561EBC64F6`.

## Birebir Parity Gate

This plan does not permit a "close enough" rebuild. The implementation must start from the locked prototype's JSX structure and CSS rhythm, then replace mock state with real feed data and real mutations.

- Do not rebuild the page with the old `StoreSurfacePage`, `StoreMetricCard`, `StoreSectionCard`, or `StoreStackedRow` primitives. Those primitives are the reason the current production page does not look like the approved prototype.
- Do not reinterpret the prototype palette, spacing, radius, shadows, font weights, metric card sizing, composer layout, notice strip, post-card rhythm, three-dot menu position, or responsive breakpoints.
- Do not swap the composer into a drawer, modal, table toolbar, or admin-style form.
- Do not add visible subject/title, scheduling, read receipts, topic filters, side panels, or analytics widgets.
- Production may change only what is required for real data, role visibility, API calls, loading/error/empty states, and accessibility attributes.
- If a production constraint prevents parity, stop and document the exact constraint in the PR before choosing a visual deviation.

The acceptance standard is visual comparison, not component intent. A reviewer should be able to put the locked prototype and `/store/feed` side by side and see the same surface, with the only expected difference being real data and role-specific command visibility.

## Locked Workflow Contract

### Region Manager

- Sees the same header, metrics, composer card, notice strip, feed list, post cards, and three-dot menu as the locked prototype.
- Composer has one plain text area only. No subject/title field, no drawer, no scheduling fields, no read-status controls.
- `Sabitle` is a toggle next to `Paylaş`. If active, the new post is created as pinned.
- `Paylaş` immediately creates a published region-scoped announcement.
- Each visible post has a three-dot menu with:
  - `Düzenle`
  - `Sabitle` or `Sabitlemeden kaldır`
  - `Yayından kaldır`
- Edit happens inline inside the post card and saves the body. The `Düzenlendi` badge appears when `updatedAt` differs from `createdAt`.
- Removed posts disappear immediately and show a notice with `Geri al`. To preserve the prototype affordance without adding a restore endpoint, archive is delayed briefly; `Geri al` cancels the pending archive.
- Menu closes on outside click and Escape. The last row menu opens upward and must not be clipped.

### Store Manager, Store Personnel, Visual Merchandiser, And Other Store Readers

- See the same visual feed page, metrics, pinned ordering, post cards, dates, and badges.
- Do not see the composer.
- Do not see the post action menu.
- Cannot call admin feed mutation endpoints from this page.

### Explicit Non-Goals For V1

- No read/seen tracking.
- No comments, reactions, attachments, or media upload.
- No scheduling UI.
- No topic/title input in the user-facing composer.
- No redesign of `/admin/feed`; it may remain as the back-office feed management page.

## Data And API Mapping

- Visible feed list:
  - Use `getVisibleFeedPosts()` -> `GET /api/feed?limit=50&offset=0`.
  - Query key must include a role/scope signature, for example `['visible-feed', roleSignature, scopeSignature]`, so switching personas does not reuse stale feed rows.
  - Do not add a frontend-only region filter for store readers. Backend already includes region posts through the user's assigned store region.
- Region Manager command list:
  - Use `getAdminFeedPosts()` only when needed for command ownership/state. Keep it out of read-only personas.
  - Query key should include role/scope signature: `['admin-feed', roleSignature, scopeSignature]`.
- Create:
  - `createFeedPost({ postType: 'announcement', title, body, visibilityScopeType: 'region', visibilityScopeIds: [regionId], isPinned, publishStatus: 'published' })`.
  - Because the approved composer has no title field but backend requires `title`, derive `title` from the first non-empty line of `body`, trimmed to a safe length. Do not display this title as a separate user-facing field.
- Edit:
  - Add `updateFeedPost(feedPostId, payload)` to `admin-web/src/features/feed/api.ts` using `sendJson` and `PUT /admin/feed/:feedPostId`.
  - Update `body` and the derived hidden `title` together.
- Pin/unpin:
  - Use existing `pinFeedPost()` and `unpinFeedPost()`.
- Archive/remove:
  - On menu click, remove from local visible list and show `Geri al`.
  - Start a short cancellable timer. If not undone, call `archiveFeedPost()`, then invalidate `visible-feed` and `admin-feed`.
  - If archive fails, restore the row and show the API error.
- Sorting:
  - Always render pinned posts first.
  - Within pinned and unpinned groups, sort by `publishedAt ?? updatedAt ?? createdAt` descending.

## UI Parity Requirements

- Production `/store/feed` must materially match:
  - `admin-web/src/prototypes/store-feed-region-composer-v1.tsx`
  - `admin-web/src/styles/store-feed-prototype.css`
- The Store-shell header/sidebar stays. The feed page content uses the prototype rhythm.
- Header copy:
  - title pill: `Duyurular`
  - role pill: `Bölge müdürü` for Region Manager, `Mağaza müdürü` or role-appropriate reader pill for read-only personas
  - route title: `Duyurular`
  - copy: `Bölge mağazalarına giden hızlı duyuru ve paylaşım akışı.` for Region Manager; reader copy can be the same without suggesting write ability.
- Metrics:
  - `Görünür duyuru`: visible published post count
  - `Sabitlenen`: pinned visible post count
  - `Bugün paylaşılan`: visible posts published today
  - `Bölge mağazası`: scoped store count from `readScope.storeIds` plus fallback `scope.storeIds`
- Composer:
  - Region Manager only.
  - Textarea placeholder: `Bölge mağazalarına ne duyurmak istiyorsun?`
  - Context text uses the active region label when available; otherwise a safe role label.
- Feed list:
  - `Bölge akışı` heading.
  - `N kayıt` counter.
  - Post body is primary. No visible title headline unless a real post only has title and no body.
  - Pinned, edited, link/metric badges follow prototype density.
- Empty state:
  - Keep visually in the same card/list system.
  - Copy must be short and user-facing; no API, scope, DB, or debug wording.

## Implementation Tasks

- [ ] Read the locked prototype TSX and CSS side-by-side with `StoreFeedPage.tsx`. Do not implement a near-match from memory.
- [ ] Promote the locked prototype structure first:
  - [ ] Copy the prototype's page skeleton, metric cards, composer, notice strip, feed list, post row, inline edit, and menu structure into the production feed surface.
  - [ ] Copy the prototype CSS into route-local production CSS with the same sizing, colors, spacing, radius, shadow, typography, and responsive rules.
  - [ ] Only after visual parity is present, replace prototype data and local handlers with real feed data and mutations.
- [ ] Add `updateFeedPost()` to `admin-web/src/features/feed/api.ts`.
- [ ] Add a role/scope query-key helper for feed queries or keep it local to `StoreFeedPage.tsx`; update `admin-web/src/app/route-data-preloaders.ts` if the key changes.
- [ ] Replace `StoreFeedPage.tsx` with a role-aware production surface:
  - [ ] `canComposeRegionFeed = roleCodes.includes('REGION_MANAGER')`.
  - [ ] Region Manager composer and menu are rendered only when `canComposeRegionFeed` and at least one region id exists.
  - [ ] Store Manager/personnel/visual merchandiser render read-only mode.
  - [ ] Visible posts are sorted pinned-first and newest-first.
  - [ ] Metrics are derived from real feed rows and auth scope.
- [ ] Create route-local production CSS, for example `admin-web/src/styles/store-feed-command.css`, by translating the prototype CSS selectors from `.feed-prototype` to production selectors. Import it in `admin-web/src/index.css`.
- [ ] Add a short parity checklist comment in the PR description with the exact items verified: header, metrics, composer, notice, feed row, menu, inline edit, mobile layout.
- [ ] Preserve prototype interaction details:
  - [ ] composer disabled state
  - [ ] pin toggle pressed state
  - [ ] inline edit
  - [ ] outside click and Escape menu close
  - [ ] last menu opens upward
  - [ ] archive notice and cancellable `Geri al`
- [ ] Ensure Turkish text is valid UTF-8 in source and browser output.
- [ ] Remove internal/debug copy from the production route.
- [ ] Keep `/admin/feed` untouched unless a shared API wrapper type requires a harmless import update.

## Test Plan

- [ ] Add or update a targeted frontend test for `/store/feed` using mocked feed API responses:
  - [ ] Region Manager sees composer, `Sabitle`, `Paylaş`, and post menus.
  - [ ] Store Manager sees the same list/metrics but no composer and no post menus.
  - [ ] Store personnel/visual merchandiser read-only mode does not expose mutation controls.
  - [ ] Pinned posts render before unpinned posts.
  - [ ] Inline edit calls `PUT /admin/feed/:id` with updated `body` and derived `title`.
  - [ ] Archive can be undone before the delayed mutation fires.
  - [ ] Last row menu is not clipped.
- [ ] Run `npm.cmd run lint` in `admin-web`.
- [ ] Run the targeted e2e/spec command if one exists for store routes; otherwise run the closest Playwright feed/store spec.
- [ ] Run `npm.cmd run build` in `admin-web`.
- [ ] Capture desktop and mobile screenshots for PR evidence and compare against the locked prototype. If screenshots show different card sizing, font weight, gradients, button treatment, or row rhythm, fix before opening/merging the PR.

## PR Plan

### PR1 - Store Feed Production Parity

- Add/update the API wrapper and query keys.
- Replace `/store/feed` with the locked prototype visual surface.
- Implement Region Manager command mode and read-only store-role mode.
- Add frontend test coverage for visibility and basic actions.
- Evidence: desktop/mobile screenshots and test output.

### PR2 - Command Hardening If Needed

Only open this if PR1 exposes backend/API gaps. Expected candidates:

- permission message cleanup for missing Region Manager region scope,
- update endpoint type mismatch,
- archive undo behavior that needs a safer backend restore endpoint.

Do not add PR2 unless PR1 has a real blocker.

## Acceptance Criteria

- `/store/feed` visually matches the locked prototype for Region Manager.
- Store Manager and other store roles see the same premium feed list in read-only mode.
- Production route uses the same visual skeleton as the locked prototype; it is not a StoreSurface primitive rewrite.
- Header, metric cards, composer, notice strip, feed list, post cards, menu, inline edit state, buttons, colors, spacing, and mobile behavior match the locked prototype.
- No composer or action menu appears for read-only personas.
- Region Manager posts are region-scoped, published immediately, and optionally pinned.
- Edit, pin/unpin, and archive use real API mutations.
- Archive `Geri al` does not require a backend restore endpoint.
- No read/seen UI appears.
- No internal implementation wording appears.
- Desktop and mobile have no horizontal overflow or clipped menus.
