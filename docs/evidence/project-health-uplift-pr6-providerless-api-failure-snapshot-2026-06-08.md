# Project Health Uplift PR-6 Providerless API Failure Snapshot

Date: 2026-06-08

## Scope

PR-6 implements the PR-5 approved providerless runtime slice only:

- `/admin/operations` reads the existing browser-session
  `window.__STORE_OPS_API_FAILURES__` ring buffer.
- The panel displays sanitized recent API failure diagnostics that were already
  emitted by `admin-web/src/lib/api-diagnostics.ts`.
- The panel is read-only and local-session only.

## What Changed

- Added `OperationsApiFailureSnapshotPanel`.
- Added the panel to `OperationsControlTowerPage`.
- Added localized copy that explicitly states the boundary:
  no provider, backend endpoint, DB record, or alert delivery was added.
- Added E2E coverage for:
  - empty local diagnostics,
  - populated sanitized local diagnostics.
- Added a script guard that keeps the runtime slice providerless and
  local-session only.

## What Did Not Change

- API response shape did not change.
- Backend behavior did not change.
- DB schema did not change.
- Auth, route role visibility, and permission semantics did not change.
- Scoring, ranking, snapshot, queue/import, and workflow behavior did not
  change.
- No paid observability provider or external delivery path was added.
- No fake product metric or fake monitoring event was added.

## Runtime Boundary

This is not broad-production app-level monitoring. It is a controlled-pilot
operator visibility step for failures already captured in the current browser
session.

Broad-production error tracking still needs a separate provider/owner decision
and evidence for external delivery, retention, alert routing, and privacy
posture.

## Rollback

Revert the PR. The change is frontend-only plus tests/docs and has no data
repair, queue drain, migration, or provider cleanup requirement.

## Verification

Expected PR verification:

- `node --test scripts/observability-runtime-foundation.test.mjs`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- operations-surfaces.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --check`
