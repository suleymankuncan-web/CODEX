# Admin Operational UX V2 PR-2 Surface Standards Evidence

Date: 2026-06-01
Status: closed as docs-only standard decision
Plan: `docs/plans/admin-operational-ux-v2-plan.md`
Audit matrix: `docs/plans/admin-operational-ux-v2-audit-matrix.md`

## Decision

Do not add a new `AdminSurface*` runtime primitive in PR-2.

The existing shared primitive layer is sufficient for the first Admin
Operational UX V2 runtime slice:

- `AdminSurfacePage`
- `AdminSurfaceHeader`
- `AdminMetricStrip`
- `AdminStatePanel`
- `AdminSurfaceSection`
- `AdminKeyValueGrid`
- `AdminKeyValue`
- `AdminSurfaceEmpty`
- `AdminFilterBar`
- `AdminActionRow`
- `AdminSurfaceBadge`
- `AdminSurfaceSkeleton`

Contract Impact: intentionally unchanged.

## Why

PR-1 found possible repeated operational patterns, but not enough proof to
justify a new shared runtime primitive before touching real pages.

The strongest candidates were:

- `ActionQueue` for Operations/Data Quality/Workflow Inbox.
- `EvidencePanel` for Integration Batch Detail and Master Data detail flows.

Both are still candidates, not approved primitives. Adding either now would be
premature because PR-1 did not prove that two route groups need the same exact
component API rather than existing `AdminSurfaceSection`, `AdminActionRow`,
`AdminKeyValueGrid`, and `AdminSurfaceBadge` composition.

## Route-Group Result

| Route group | PR-2 result | Runtime primitive action |
| --- | --- | --- |
| Operations + Data Quality + Workflow Inbox | Existing primitives are enough to start PR-3. Repeated action-queue markup should be evaluated during PR-3 implementation. | none |
| Integrations + Master Data | Existing primitives and anchored integration/master-data helpers are enough for PR-4 planning. | none |
| Snapshots + Reports | Existing primitives are enough; snapshot semantic golden matters more than abstraction. | none |
| Targets + KPI Config | Existing primitives and KPI-specific helper are enough. | none |
| Checklist Templates + Competitions | Domain-specific authoring helpers should remain local unless later repetition proves a shared primitive. | none |
| Auth + Audit + Pilot Feedback | Existing primitives are enough; security evidence is domain-specific. | none |
| Parked routes | `/admin/session` and `/admin/feed` stay outside runtime primitive enforcement until reopened. | none |

## Guard Impact

No change to `scripts/admin-ui-refactor-guard.test.mjs` is required in PR-2.

The current guard already enforces:

- migrated admin pages are anchored to approved `AdminSurface*` primitives,
- known parked exceptions remain explicit,
- synthetic legacy dashboard primitive and primitive-sprawl violations fail.

If PR-3 or later introduces a new shared primitive or helper path, that PR must
update the guard and evidence in the same slice.

## Protected Behavior

This PR does not change:

- API request or response shape,
- backend code,
- DB schema or migrations,
- auth, permission, role, or scope semantics,
- scoring, ranking, snapshot interpretation, import lifecycle, queue behavior,
  polling, retry, status, approval, or business workflow,
- route graph or navigation visibility,
- runtime UI rendering.

## Verification

Required local verification for this docs-only decision:

```powershell
npm.cmd run test:scripts
git diff --stat
git diff --check
```

## Rollback

Rollback is a docs-only revert. No migration, data repair, queue drain,
deployment change, or runtime recovery is required.

## Next Slice

Proceed to PR-3: Operations + Data Quality + Workflow Inbox.

PR-3 may still extract a shared primitive only if implementation proves a
repeated component API across at least two route groups. Otherwise, keep the
composition local and continue with existing primitives.
