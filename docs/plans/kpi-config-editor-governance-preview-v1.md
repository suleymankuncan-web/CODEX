# KPI Config Editor Governance Preview V1

Date: 26 April 2026

## Purpose

The admin KPI config editor already has a draft/publish workflow. This step makes the publish decision safer by showing what would change before a draft becomes live.

The goal is not to open a new versioned config model yet. The goal is to make the existing surface more honest and decision-ready.

## Scope

Added to `/admin/kpi-config`:

- `Governance preview`
- `Publish decision preview`
- draft/live diff counts for:
  - store profile metrics
  - personnel profile metrics
  - ownership matrix rows
  - grading bands
- explicit status when unpublished changes exist
- explicit reminder that versioned schema is not active yet
- explicit reminder that snapshot anchoring is required before admin-editable interpretation changes

## Implementation

Frontend:

- `admin-web/src/pages/AdminKpiConfigPage.tsx`
  - builds a local governance preview from the existing editor payload
  - compares draft rows against published rows by stable `code`
  - reuses the existing `formatDiffSummary` language: `+added / ~changed / -removed`
  - does not mutate config
  - does not change publish behavior

Test:

- `admin-web/e2e/admin-kpi-config.spec.ts`
  - mocks the KPI config editor API
  - proves the publish decision preview is visible
  - proves store metric and grading diffs are shown
  - proves versioned schema and snapshot anchoring caveats are visible

## Boundaries

No backend change.

No API contract change.

No DB schema change.

No migration.

No score formula change.

No new `dm` or `config` schema.

No admin-editable interpretation versioning yet.

This remains a frontend governance preview over the existing draft/published editor contract.

## Verification

Targeted frontend verification:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/admin-kpi-config.spec.ts
```

Result:

- build passed
- `admin KPI config page explains publish governance preview` passed

Official root release verification:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Result:

- root script tests passed: 9/9
- backend release passed: lint, 32 test suites / 248 tests, build, `npm audit --omit=dev`
- frontend release passed: lint, script tests 7/7, build, 24 Playwright tests, `npm audit --omit=dev`

## CODEX DURUST YORUM

This is the right-sized step.

The risky move would be turning KPI interpretation into an admin-editable, versioned config system before the snapshot model is ready. That would look powerful on the screen, but it could create historical reporting confusion.

This preview gives HR/admin users better judgment before publish without pretending that historical interpretation is solved. The system is more transparent, but the deeper governance work remains intentionally planned.

## Next Logical Step

If staging IdP values are available, run guarded staging action evidence.

If not, the next local product step should be `Ranking completeness / segment-ready behavior`: Turkey-wide, store, and metric mini-ranks should become clearer before we open deeper KPI config versioning.
