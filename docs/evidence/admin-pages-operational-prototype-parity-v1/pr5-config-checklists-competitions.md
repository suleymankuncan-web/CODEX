# PR5 - KPI Config, Checklist Templates, Competitions

Date: 2026-06-30

## Scope

Routes covered:

- `/admin/kpi-config`
- `/admin/checklists`
- `/admin/competitions`

Prototype contract:

- `admin-web/src/prototypes/admin/config-checklists-competitions-v1.tsx`

## Route And Workflow Read

### KPI Config

Main runtime file:

- `admin-web/src/pages/AdminKpiConfigPage.tsx`

Related coverage:

- `admin-web/e2e/admin-kpi-config.spec.ts`
- `admin-web/e2e/kpi-config-surfaces.spec.ts`
- `admin-web/e2e/kpi-config-versioning.spec.ts`

Behavior frozen:

- KPI version loading, draft save, publish, audit loading, validation messages, contribution weights, active version semantics, scoring math, backend DTOs, and publish payloads.

Component map:

- Header: `AdminOperationalHeader`
- Metrics: `AdminOperationalMetrics`
- Main workbench: existing KPI config editor primitives
- Validation and audit: existing editor sections plus operational page rhythm
- Loading/error: `AdminOperationalPage` wrapper with current error/loading states

### Checklist Templates

Main runtime files:

- `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- `admin-web/src/pages/AdminChecklistTemplateSurface.tsx`

Related coverage:

- `admin-web/e2e/checklist-template-surfaces.spec.ts`
- `admin-web/e2e/admin-routing.spec.ts`

Behavior frozen:

- Template authoring, company selection from the current user context, answer types, score weights, low-score thresholds, expected value payloads, save, publish, archive, mutation feedback, and backend payload shape.

Component map:

- Header: `AdminOperationalHeader`
- Metrics: `AdminOperationalMetrics`
- Main workbench: existing checklist template editor
- Validation: existing validation panel and product copy
- Loading/error: current mutation and validation states

### Competitions

Main runtime files:

- `admin-web/src/pages/CompetitionDashboardPage.tsx`
- `admin-web/src/features/competitions/competition-admin-surface-primitives.tsx`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/features/competitions/stage-builder-package-section.tsx`

Related coverage:

- `admin-web/e2e/competition-surfaces.spec.ts`

Behavior frozen:

- Competition list/detail loading, lifecycle actions, scoring, finalization, stage execution, review, cancel, clone, role visibility, read-only view, package plans, team templates, and all mutation payloads.

Component map:

- Header: `AdminOperationalHeader`
- Metrics: `AdminOperationalMetrics`
- Main workbench: existing competition list/detail/stage sections
- Builder controls: project shadcn `Select`, `Input`, `Textarea`, and `Button` primitives
- Read-only evidence: visible contribution and warning sections
- Loading/error: existing query and mutation states

## UI Implementation

- The three page headers and metric strips now use the shared admin operational surface rhythm.
- Competition builder dropdowns no longer use native `<select>`; the existing builder API is preserved through the same `onChange(event.target.value)` call shape.
- Checklist missing company copy now uses product language instead of internal wording.
- Competition read sections now use product-facing TR/EN copy instead of internal scope wording.

## Prototype Parity

Prototype parity target:

- compact operational header,
- small decision metrics,
- builder/editor as the main work area,
- validation and publish readiness visible without dashboard framing,
- no long internal explanatory copy,
- shadcn-compatible controls for editable option sets.

Status:

- Prototype parity: PASS.

The runtime implementation intentionally keeps the existing domain editors and mutation forms where they own complex business behavior. The visual translation is limited to the shared page rhythm, product copy cleanup, and shadcn control replacement where it does not alter payloads.

## Verification

Commands run locally before PR:

```text
git diff --check                                                               # PASS
npm.cmd --prefix admin-web run lint                                            # PASS
npm.cmd --prefix admin-web run build                                           # PASS
npm.cmd --prefix admin-web run test:e2e -- admin-kpi-config.spec.ts kpi-config-surfaces.spec.ts kpi-config-versioning.spec.ts checklist-template-surfaces.spec.ts competition-surfaces.spec.ts  # PASS, 33 tests
npm.cmd --prefix admin-web run test:scripts                                    # PASS, 63 tests
npm.cmd run test:scripts                                                       # PASS, 488 tests
```

Mobile/overflow evidence:

- Targeted Playwright coverage includes mobile-bounded checks for KPI config, checklist template authoring, and competitions.
- Manual screenshot artifacts were not added for this PR because the scoped parity check is covered by existing browser specs plus the prototype contract file.

## Residual Risk

- KPI config, checklist template authoring, and competition stage/package builders remain complex editor surfaces. This PR intentionally avoids moving business controls into a new abstraction because that would create payload risk.
- Full screenshot capture can still be added later if the team wants visual artifacts per route, but this PR has local browser coverage for the affected admin surfaces.
