# Store Operational Surfaces Command Canvas Closeout V1

Date: 2026-07-17
Status: `PENDING_REPAIRED_HEAD_CI_AND_STAGING_RECERTIFICATION`

PR 6 is merged. The first PR 7 visual assumption was invalidated by the
owner-observed KPI, Talep Merkezi and Görevler geometry differences recorded
in `parity-gap-audit-2026-07-17.md`. The repaired local head now passes the
locked prototype and stable-geometry contracts. This record becomes final only
after the repaired head is green in CI, deployed, and protected staging is
recertified.

- Prototype parity: PASS_LOCAL — KPI Özetleri
- Prototype parity: PASS_LOCAL — Talep Merkezi
- Prototype parity: PASS_LOCAL — Norm Kadro
- Prototype parity: PASS_LOCAL — Görevler

Report Viewer remains company-scoped and read-only. Region Manager remains
assigned-region/store scoped. Store Manager remains own-store/action-store
scoped. Production identity, authorization, API and database truth remain
authoritative.

The zero-reference manifest is
`docs/evidence/store-operational-surfaces-command-canvas/legacy-deletion-manifest-v1.md`.
Its mechanical guard proves that no Labs helper or fixture is present in the
production source or bundle.

## Deterministic production evidence

| Route | Evidence | Covered viewports and roles |
|---|---|---|
| KPI Özetleri | `docs/evidence/store-command-canvas-parity/kpis/` | Region Manager at all four accepted viewports; role hierarchy and Profile Git contracts for Report Viewer, Region Manager and Store Manager |
| Talep Merkezi | `docs/evidence/store-command-canvas-parity/approvals/` | Region Manager at all four accepted viewports; Report Viewer company hierarchy/read-only capture |
| Norm Kadro | `docs/evidence/store-command-canvas-parity/workforce/` | all three roles, four Store Manager viewports and long history overlays |
| Görevler | `docs/evidence/store-command-canvas-parity/tasks/` | all three roles, four Store Manager viewports and long audit overlays |

The evidence uses deterministic sanitized Playwright data only for repeatable
rendering. Production source and bundles contain none of those fixtures.
