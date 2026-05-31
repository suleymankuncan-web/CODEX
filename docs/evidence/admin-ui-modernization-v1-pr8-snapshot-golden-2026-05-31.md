# Admin UI Modernization V1 PR-8 Snapshot Golden Evidence

Date: 2026-05-31

## Scope

- `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- `admin-web/src/pages/SnapshotsDashboardPage.tsx`
- `admin-web/src/pages/SnapshotRunDetailPage.tsx`
- `admin-web/src/features/snapshots/snapshot-surface-semantics.ts`
- `admin-web/e2e/master-data-surfaces.spec.ts`
- `admin-web/e2e/snapshots-surfaces.spec.ts`
- `admin-web/e2e/fixtures/snapshot-status-golden.ts`

## Contract Impact

Unchanged.

- No API response shape changes.
- No DB, migration, auth, permission, snapshot creation, rerun, validation, or promotion workflow changes.
- Snapshot semantic golden locks status label, badge tone, action availability, and detail visibility with deterministic fixtures.
- Master data bootstrap assertions lock selected-batch action availability and evidence visibility.

## Visual QA

Captured against `admin-web` production build served by `vite preview` on `http://127.0.0.1:4174`.

- `docs/evidence/admin-ui-modernization-v1-pr8/master-data-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr8/master-data-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr8/snapshots-dashboard-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr8/snapshots-dashboard-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr8/snapshot-detail-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr8/snapshot-detail-mobile.png`

## Verification

- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run test:e2e -- master-data-surfaces.spec.ts snapshots-surfaces.spec.ts`
- `npm.cmd --prefix admin-web run smoke:pilot`
- `npm.cmd run test:scripts`
- `git diff --check`
