# PR2 - Integrations / Master Data

Date: 2026-06-30
Branch: `codex/admin-operational-pr2-integrations-master-data`

## Scope

Routes in this PR:

- `/admin/integrations`
- `/admin/integrations/:batchId`
- `/admin/master-data`
- `/admin/master-data/:batchId`

Frozen behavior:

- Existing API calls stay unchanged.
- Existing route role gates stay unchanged.
- Upload, CSRF recovery, retry, external-id mapping, validate, promote, and master-data edit mutations stay unchanged.
- No DB migration, auth change, import payload change, polling change, or promotion semantic change is introduced.

## Prototype Contract

Production-bound prototype file:

- `admin-web/src/prototypes/admin/integrations-master-data-v1.tsx`

Parity approach:

- Prototype and live routes use the shared `AdminOperational*` command-surface family.
- Live pages keep their existing forms, table rows, upload controls, retry buttons, validation/promote buttons, mapping controls, and route links.
- The changed surface is the command header and primary metric strip: integrations, import-batch detail, and master-data now share the same compact operational rhythm established by PR1.

## Page Mapping

`/admin/integrations`

- New compact operational command header.
- Import health metrics use the operational metric strip.
- Upload tabs, Power BI upload, sample batch creation, queue filtering, CSV export, pagination, and retry action remain unchanged.

`/admin/integrations/:batchId`

- Batch detail now opens with the same operational page/header/metric rhythm.
- Batch retry, mapping approval, reconciliation, quality evidence, lineage, error row export, and audit export remain unchanged.

`/admin/master-data`

- Master-data command header and metric strip moved to the operational rhythm.
- Batch tabs, store/personnel master edits, history placeholder, and bulk save behavior remain unchanged.

`/admin/master-data/:batchId`

- Selected batch detail remains inside the existing route and keeps validate/promote actions.
- Promotion readiness, rows, and detail evidence remain unchanged.

## Verification

Passed:

- `git diff --check`
- `npm.cmd run test:scripts`
  - 488 passed.
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts integration-retry-contracts.spec.ts integration-upload-csrf.spec.ts master-data-surfaces.spec.ts`
  - 18 passed.
  - Covers import queue retry, batch detail retry, upload CSRF recovery, upload success, external-id mapping, mobile overflow, master-data store/personnel edits, validate/promote evidence, and selected batch workflow actions.

File-size guard note:

- `IntegrationDashboardPage.tsx`, `ImportBatchDetailPage.tsx`, and `MasterDataBootstrapPage.tsx` all finish one line below their previous frozen baselines.
