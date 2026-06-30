# PR7 - Admin Feed

Date: 2026-06-30

## Scope

Route covered:

- `/admin/feed`

Prototype contract:

- `admin-web/src/prototypes/admin/feed-operational-v1.tsx`

## Behavior Frozen

- Admin feed list query and visible store feed query keys stay unchanged.
- Create, publish, pin, unpin, and archive mutations keep the same API functions and payload fields.
- HR admin and super admin can publish company, region, or store scoped posts.
- Region manager composer remains region scoped and keeps its own default region.
- Store feed visibility, pinned ordering, edit menu, archive undo, and store home feed link behavior stay covered by `feed-surfaces.spec.ts`.

## Component Map

- Header: `AdminOperationalHeader`
- Metrics: `AdminOperationalMetrics`
- Composer: `AdminOperationalSection` around the existing feed form contract
- Guardrail: `AdminOperationalSection` plus `AdminOperationalKeyGrid`
- Post library: `AdminOperationalSection`, `AdminOperationalBadge`, `AdminOperationalKeyValue`
- Actions: shadcn `Button`

## UI Implementation

- The admin feed page now uses the shared admin operational page rhythm.
- The old dashboard hero, metric grid, guardrail panel, and stacked post rows were replaced with operational primitives.
- Native form controls remain intentionally unchanged in this PR because feed publishing has a broad payload surface and existing e2e specs freeze the current labels and values.
- No feed write workflow, query invalidation, scope defaulting, or store feed read behavior was changed.

## Verification

Commands run locally before PR:

```text
npm.cmd --prefix admin-web run test:e2e -- feed-surfaces.spec.ts   # PASS, 8 tests
npm.cmd --prefix admin-web run lint                                # PASS
npm.cmd --prefix admin-web run build                               # PASS
```

## Residual Risk

- The composer still uses the existing native form controls. Replacing them with shadcn Select/Input should be a separate behavior-preserving PR because the feed payload surface is wide.
- Feed copy files still contain existing legacy encoding artifacts; this PR does not rewrite localization catalogs.
