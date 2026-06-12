# Store Persona Polish PR Train V1

Date: 2026-06-13

Status: locked and tightened plan. User-approved execution plan for the Store
persona follow-up polish, checklist, ranking/KPI, and Norm Kadro fixes.

Tightening pass: 2026-06-13. This plan may be narrowed by implementation
evidence, but it must not be loosened without a new explicit user decision.

## Reader And Action

Reader:

- a future Codex session or engineer executing the Store persona follow-up PR
  train.

After reading, they should be able to:

- implement the requested fixes in small, reviewable PRs,
- preserve current API shape, DB schema, auth/permission semantics, scoring,
  ranking, checklist weights, target/workforce lifecycle behavior, and queue or
  provider behavior,
- keep the locked Store Home / Store shell prototype language and Plum Glacier
  palette coherent across the touched Store surfaces.

## Source Context

This plan follows the Store Home dashboard parity line and the locked sidebar
direction:

- Store/Admin left toolbar follows the approved prototype rhythm.
- Lufian/header brand area remains unchanged.
- Store pages use shadcn/ui, Tailwind v4 utilities/tokens, lucide icons, and
  the Store UI refactor discipline.
- Plum Glacier token values are the active palette reference for this line.
- No fake production data is allowed.

Primary reference docs:

- `current-state.md`
- `discipline.md`
- `docs/prototypes/plum-glacier-token-set-v1.md`
- `docs/plans/store-surfaces-redesign-implementation-plan-v1.md`
- `docs/plans/store-workforce-and-approvals-split-v1-plan.md`

## Locked User Findings

1. Rankings KPI table is missing the `CR` column.
2. If `Checklist yap` is opened and then cancelled before completion, a draft
   remains and visit date appears. Visit date must not be written or shown until
   the checklist is completed.
3. The checklist detail popup shown to the Store Manager after completion, and
   to the Region Manager after Store Manager acknowledgement, does not meet the
   current Store UI quality bar and must be redesigned.
4. Norm Kadro status currently shows a technical real-data style label. It
   should interpret the store state as `Eksik`, `Tam`, or `Fazla`.
5. Norm Kadro action column `Detay` button is too far to the right.
6. Tasks page source text such as `Review checklist source` is too dark, not
   Turkish enough, and visually too far left.
7. Talep Merkezi action column buttons are too dark.
8. Region Manager KPIs page stacks checklist values vertically. They must be
   separated as `BM Checklist` and `VM Checklist` side by side.
9. KPI page action buttons are too dark.
10. Region Manager Norm Kadro view should show the date a store fell below norm
    and how many days it has worked below norm, such as `5 gundur eksik` or
    `15 gundur eksik`.

## Locked Decisions

1. Execute as four PRs, not one large mixed PR.
2. PR order is fixed:
   - PR-1 Checklist flow and detail modal.
   - PR-2 Norm Kadro status and region shortage signal.
   - PR-3 Rankings and KPI table corrections.
   - PR-4 Store visual polish and Turkish copy cleanup.
3. `Talep Merkezi` remains the Store approvals/request-center label.
4. Toolbar/sidebar visual rhythm remains the locked prototype rhythm.
5. Lufian/header brand area must not be replaced with `HR Axis` branding.
6. Checklist visit date is a completed-result signal, not a draft-start signal.
7. `CR` belongs in Store Rankings KPI table when the backend/model provides it.
8. BM and VM checklist values in Region Manager KPI overview must be separate
   readable fields, not stacked inside one ambiguous column.
9. Norm Kadro status must be business-language, not technical source language.
10. Missing or future workforce data must not be invented. If shortage start
    date is not present in the current contract, the UI may be prepared for it
    but must not fake a date or a duration.

## Non-Goals

This train must not:

- change DB schema,
- change backend permission or auth semantics,
- change API response shape unless a PR explicitly stops and replans as a
  contract PR,
- change checklist scoring, checklist weights, acknowledgement lifecycle, or
  completion semantics,
- change KPI score math, ranking sort, benchmark policy, or snapshot
  interpretation,
- change target distribution, seller-code, offboarding, or workforce request
  lifecycle behavior,
- introduce fake KPI, fake staffing, fake shortage duration, or fake visit data,
- rewrite the Store shell globally,
- change the Lufian/header brand area,
- expose internal words such as API, DB, contract, route, scope, provider,
  staging, mock, evidence, queue, or Redis in user-facing Store copy.

## Pre-PR Scout Gate

Every runtime PR in this train starts with a short source scout before code
edits. The PR body must include the scout result.

Required scout findings:

1. PR-1 must classify the checklist visit-date bug as one of:
   - display derivation from draft state,
   - persisted write of a draft date,
   - backend/API contract ambiguity.
2. PR-1 must prove the fix is not only CSS hiding. After cancel, the source used
   by the visit-date cell must not classify the draft as a completed visit.
3. PR-2 must inspect the current workforce/headcount response and record whether
   a real below-norm start timestamp exists.
4. PR-2 must explicitly state one of:
   - shortage start date/duration is fully implemented from a real field,
   - shortage start date/duration is prepared but parked because the real field
     does not exist.
5. PR-3 must confirm `CR` exists in the ranking row metrics or fixture source
   before adding it as a visible ranking column.
6. PR-4 must confirm whether task source wording is frontend-translated,
   backend-provided, or mixed before normalizing Turkish copy.

If a scout result shows that API shape, DB schema, auth, scoring, checklist
weights, or workflow lifecycle must change, that PR stops and a separate
contract plan is required.

## PR-1: Checklist Flow And Detail Modal

Risk class: R2 frontend data binding plus workflow-adjacent UI.

Goal:

- prevent cancelled checklist drafts from surfacing as completed visits,
- redesign the completed checklist detail popup for Store Manager and Region
  Manager contexts.

Expected files:

- `admin-web/src/pages/StoreChecklistsPage.tsx`
- `admin-web/src/pages/store-checklists-modals.tsx`
- `admin-web/src/pages/store-checklists-result-modal.tsx`
- `admin-web/src/pages/store-checklists-visit-panel.tsx`
- `admin-web/src/pages/store-checklists-logic.ts`
- `admin-web/src/pages/store-checklists-model.ts`
- `admin-web/e2e/checklist-today-surfaces.spec.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

Implementation requirements:

1. Inspect the visit-date derivation path before editing.
2. Classify whether the date is coming from UI derivation, cached draft state,
   or persisted backend response.
3. Make visit-date display depend only on a completed checklist result or
   completed acknowledgement source, not an active/cancelled draft.
4. Do not change start/autosave/complete command payloads unless a real bug
   proves it is necessary and the PR is reclassified.
5. Keep cancelled draft recovery behavior if it already exists, but suppress
   visit date until completion.
6. Add an explicit guard so a draft can be resumed without being treated as a
   completed visit.
7. Redesign `ChecklistResultModal` with current Store UI language:
   - compact header,
   - store/date/status/role context,
   - score/result summary,
   - acknowledgement or next-action area where applicable,
   - grouped checklist findings,
   - mobile-readable layout,
   - no old dashboard/modal remnants.
8. Preserve Store Manager acknowledgement behavior and Region Manager detail
   visibility behavior.

Verification:

- frontend lint,
- frontend build,
- targeted checklist Playwright flow:
  - open `Checklist yap`,
  - cancel before completion,
  - assert visit date is absent,
  - assert the completed-result/visit-date source remains absent after cancel,
  - complete checklist,
  - assert visit date is present,
  - open result detail for Store Manager and Region Manager paths,
- desktop and mobile visual smoke for the redesigned modal.

Rollback:

- revert PR-1 only. It must not be coupled to Norm Kadro, KPI, or Talep Merkezi
  changes.

Stop if:

- fixing the cancelled draft requires changing checklist persistence semantics,
- result modal redesign would hide required acknowledgement actions,
- visit-date source cannot distinguish draft from completion without backend
  contract change,
- the UI can hide the date while the underlying model still classifies the draft
  as a completed visit.

## PR-2: Norm Kadro Status And Shortage Signal

Risk class: R2 frontend data binding. Escalate to R3 only if a backend read
contract is required.

Goal:

- replace technical data-source labels with business staffing interpretation,
- add future-ready below-norm start date and duration display without faking
  missing data.

Expected files:

- `admin-web/src/pages/StoreWorkforcePage.tsx`
- `admin-web/src/pages/store-workforce-headcount.ts`
- `admin-web/src/pages/store-workforce-region-view.tsx`
- `admin-web/src/pages/store-workforce-region-model.ts`
- `admin-web/src/pages/store-workforce-region-metrics.tsx`
- `admin-web/src/features/workforce/api.ts`
- `admin-web/src/features/localization/messages/store-workforce.ts`
- relevant Store workforce e2e coverage.

Implementation requirements:

1. Inspect the current headcount/workforce data contract before editing and
   record whether a real shortage-start timestamp exists.
2. Add a pure helper for norm status interpretation. The helper must parse
   headcount fields as finite numbers before comparing because the current
   frontend workforce contract carries headcount values as strings:
   - planned > active: `Eksik`,
   - planned = active: `Tam`,
   - active > planned: `Fazla`,
   - non-finite or missing planned value: honest not-configured fallback.
3. Use existing fields first:
   - `plannedHeadcount`,
   - `activeHeadcount`,
   - `headcountGap`,
   - existing active personnel fallback only where already permitted.
4. Remove user-facing `Gercek veri` style status language from Norm Kadro
   status cells.
5. Adjust Region Manager row layout so `Detay` is not visually pinned too far
   right.
6. Show below-norm start date and `N gundur eksik` only when a real date exists.
7. Do not add an optional frontend field as if it were real unless the response
   actually carries that field or a separate contract PR introduces it.
8. If the real date does not exist, do not fabricate from today's date, import
   time, row render time, or first frontend observation.
9. If shortage timestamp is missing, implement the `Eksik` status and action
   alignment fixes, then park the date/duration portion with an explicit note.

Verification:

- helper/unit coverage or targeted frontend test for `Eksik`, `Tam`, `Fazla`,
  and missing planned data,
- explicit assertion that no shortage duration renders when no real timestamp
  exists,
- frontend lint,
- frontend build,
- targeted Store workforce e2e for Store Manager and Region Manager views,
- desktop/mobile visual smoke for action column alignment.

Rollback:

- revert PR-2 without affecting checklist, KPI, or visual polish PRs.

Stop if:

- real shortage start date requires DB or backend lifecycle tracking,
- frontend would need to infer a persisted shortage date from transient view
  state,
- row layout fix requires broad Store shell/table rewrite,
- a PR body attempts to claim shortage date/duration fully closed without a real
  timestamp source.

## PR-3: Rankings And KPI Table Corrections

Risk class: R2 frontend data binding.

Goal:

- add the missing `CR` column to Store Rankings KPI table,
- split Region Manager KPI checklist values into separate BM and VM columns.

Expected files:

- `admin-web/src/pages/StoreRankingsPage.tsx`
- `admin-web/src/pages/store-rankings-page-model.ts`
- `admin-web/src/pages/store-rankings-table.tsx`
- `admin-web/src/pages/store-rankings-detail-panel.tsx`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/src/pages/store-kpis-region-overview.tsx`
- `admin-web/src/pages/store-kpi-highlights-model.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

Implementation requirements:

1. Add `CR` to the Store Rankings KPI column list.
2. Reuse existing `CR` label/format helpers where already present.
3. Update any test that currently asserts `CR` is absent.
4. Keep ranking access, sort behavior, pagination, and detail authorization
   unchanged.
5. In Region Manager KPI overview, replace the single checklist column that
   stacks chips with two readable columns:
   - `BM Checklist`,
   - `VM Checklist`.
6. Preserve BM and VM checklist values and tones.
7. Update grid tracks and mobile card layout so desktop and mobile do not
   overflow.
8. Do not perform the broad KPI action-button tone cleanup in this PR. PR-3 owns
   data columns and layout only; PR-4 owns dark action-button polish.

Verification:

- frontend lint,
- frontend build,
- targeted Store rankings/KPI Playwright coverage:
  - `CR` column visible,
  - CR formatted correctly,
  - BM and VM checklist fields visible side by side on desktop,
  - mobile layout remains readable,
- visual smoke for Store Manager and Region Manager KPI/rankings pages.

Rollback:

- revert PR-3 only. No checklist or workforce behavior should be entangled.

Stop if:

- `CR` is not present in the backend/model data for the relevant rows,
- adding the column changes backend ranking sort or access semantics,
- Region Manager KPI split requires a new backend aggregation,
- the fix requires restyling unrelated KPI actions beyond what is necessary for
  the table layout.

## PR-4: Store Visual Polish And Turkish Copy Cleanup

Risk class: R1 UI-only, with copy/localization checks.

Goal:

- finish the visual polish issues across Store Tasks, Talep Merkezi, KPIs, and
  shared Store action buttons/chips.

Expected files:

- `admin-web/src/pages/StoreTasksPage.tsx`
- `admin-web/src/features/store-actions/StoreActionPlansPanel.tsx`
- `admin-web/src/features/localization/messages/store-tasks.ts`
- `admin-web/src/pages/StoreApprovalsPage.tsx`
- `admin-web/src/pages/store-approvals-request-center-sections.tsx`
- `admin-web/src/pages/store-kpis-region-overview.tsx`
- Store navigation/sidebar files if the `Talep Merkezi` label needs a final
  consistency pass.

Implementation requirements:

1. Ensure toolbar/sidebar label is `Talep Merkezi`, not `Talepler / Onaylar`.
2. Lighten Talep Merkezi action buttons.
3. Lighten KPI action buttons, including the Region Manager KPI open/detail
   actions left intentionally out of PR-3.
4. Translate and normalize task source text such as `Review checklist source`
   into product Turkish.
5. Lighten dark task source chips/links.
6. Fix source/chip alignment where it appears too far left.
7. Use Plum Glacier tokens and existing Store primitive/shadcn button language.
8. Do not introduce new ad hoc dark purple/cyan values.
9. Do not change task workflow status, action-plan lifecycle, request-center
   data, or approval behavior.

Verification:

- frontend lint,
- frontend build,
- targeted Store pages visual smoke:
  - tasks,
  - Talep Merkezi,
  - KPIs,
  - sidebar/nav,
- copy scan for the removed English/internal source wording,
- computed-style or screenshot evidence that dark action buttons/chips are no
  longer using the old heavy tone,
- mobile and desktop viewport check for button/chip alignment.

Rollback:

- revert visual/copy PR only.

Stop if:

- a visual change requires changing workflow/action semantics,
- translation source is backend-provided and cannot be safely normalized at the
  current UI layer,
- button style changes would reduce accessibility/focus visibility.

## Execution Order

1. PR-1: checklist correctness and modal quality.
2. PR-2: Norm Kadro business status and below-norm signal.
3. PR-3: rankings/KPI data table corrections.
4. PR-4: Store visual polish and Turkish copy cleanup.

Rationale:

- Checklist has the highest trust/workflow risk.
- Norm Kadro has data-interpretation risk and a known future-data boundary.
- Rankings/KPI changes are table/model binding changes and can be isolated.
- Visual polish should close after functional/data corrections to avoid
  repeated style churn.

## Branch Naming

Suggested branches:

- `codex/store-checklist-visit-result-modal`
- `codex/store-workforce-norm-status`
- `codex/store-rankings-kpi-columns`
- `codex/store-visual-polish-copy`

## PR Body Requirements

Every PR must include:

- problem,
- scope,
- contract impact,
- what did not change,
- verification run,
- visual evidence note for UI changes,
- rollback notes,
- any parked risk.

Required contract wording unless a PR explicitly escalates:

```text
Contract Impact: intentionally unchanged.
API shape, DB schema, auth/permission semantics, scoring/ranking/checklist
weights, queue/import/provider behavior, and business workflows are unchanged.
```

## Verification Ladder

Minimum per PR:

1. `git diff --check`
2. `npm.cmd --prefix admin-web run lint`
3. `npm.cmd --prefix admin-web run build`
4. targeted Playwright/e2e for the touched Store surface
5. desktop/mobile visual smoke for layout-sensitive pages

Run broader Store e2e or release gate only if shared shell/navigation behavior
changes beyond the planned label/style corrections.

Final train closeout must also attempt Store Manager and Region Manager staging
persona smoke for the touched surfaces. If real credential/session input is not
available, record that as blocked evidence instead of claiming deployed persona
proof.

## Done Definition

This PR train is done only when:

- all ten locked user findings are addressed or explicitly parked with a real
  contract reason,
- cancelled checklist drafts no longer surface visit dates,
- completed checklist details look and behave correctly for Store Manager and
  Region Manager,
- Norm Kadro status uses `Eksik`, `Tam`, or `Fazla` where data supports it,
- shortage start date/duration is shown only from real data,
- if shortage start date data does not exist, the status/layout fixes are
  shipped and the date/duration portion is explicitly parked,
- Rankings includes `CR`,
- Region Manager KPI overview separates BM and VM checklist values,
- Store action buttons/chips use the lighter approved visual language,
- `Talep Merkezi` label is consistent,
- targeted local gates pass,
- PR review and merge discipline from `discipline.md` is followed.

## Parked Risk

Below-norm start date may require a backend/source-of-truth field. If the
current frontend contract does not include a real shortage-start timestamp, the
implementation may prepare optional rendering but must not claim this part fully
closed until a real source exists.
