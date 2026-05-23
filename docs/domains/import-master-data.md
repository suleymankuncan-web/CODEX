# Import And Master Data Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer, support operator, or future agent changing Excel import, source
  boundaries, KPI raw rows, external mapping, master-data bootstrap, validation,
  review, or promotion.

After reading, they should know which import/master-data boundary owns the
change and whether live `ops.*` mutation is allowed.

## Source Documents

Use these first:

- `docs/plans/source-agnostic-import-boundary-v1.md`
- `docs/plans/excel-kpi-import-operator-runbook.md`
- `docs/plans/import-decision-evidence-v1.md`
- `docs/plans/import-lineage-evidence-surface-v1.md`
- `docs/plans/import-upload-authorization-decision-v1.md`
- `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`
- `docs/plans/master-data-bootstrap-admin-dry-run-evidence-v1.md`
- `docs/plans/master-data-bootstrap-promotion-safety-guard-v1.md`
- `docs/plans/operator-evidence-consistency-pass-v1.md`

## Active Rules

- Power BI/Excel is the active operating source.
- JSON source integration is suspended until real source evidence exists.
- Source-specific data must enter through the canonical import boundary.
- Master-data bootstrap must stage, validate, review, and dry-run before scoped
  promotion.
- Live `ops.*` mutation needs explicit command scope and sanitized evidence.

## Parked Or High-Risk

- JSON adapter, scheduler, source-specific endpoint, guessed field map, or
  provider integration.
- Direct Excel-to-live-table mutation.
- Broad `HR_ADMIN` upload delegation.
- Promotion without true baseline store/personnel data.

Open those only with real files, official fields, identity semantics, auth
decision, and rollback evidence.
