# Admin KPI Config Row Context V1

## Purpose

Record the first Product Readiness V1 implementation slice after the refreshed
surface audit. This slice improves Admin KPI Config accessibility and keyboard
reviewability for repeated editor rows without changing config persistence,
validation rules, API calls, auth, permissions, DB state, KPI scoring, ranking
interpretation, or publish/draft semantics.

## Sokrates Triage

Claim:

- Repeated metric, ownership, and grading-band rows need row-specific accessible
  context so operators and assistive technology can distinguish repeated
  controls such as remove buttons.

Assumptions:

- Adding `role="group"` and contextual `aria-label` values changes accessibility
  semantics only, not business behavior.
- The visible labels can remain compact; the additional context belongs in the
  accessibility tree and targeted Playwright coverage.

Repo evidence:

- `AdminKpiConfigPage.tsx` renders repeated score-profile metric rows,
  ownership matrix rows, and grading-band rows.
- The visible remove actions were intentionally compact, but repeated action
  names did not identify which row would be removed.
- `admin-web/e2e/admin-kpi-config.spec.ts` already covers localization,
  editability, save payloads, and weight-total blocking, making it the right
  targeted test home for this accessibility slice.

Counterargument:

- This does not make the large page smaller and does not visually redesign the
  form. That is acceptable because the chosen gap is accessibility context, not
  a broad layout rewrite.

Risk:

- LOW. The change is limited to ARIA labels and a pure row-reference helper.
- MEDIUM only if tests later reveal downstream selectors depended on exact
  accessible button names. The local targeted suite did not show that.

Door:

- Two-way door. The ARIA naming can be adjusted or reverted without touching
  data, API, auth, DB, scoring, or workflow semantics.

Stop rules applied:

- No validation rule changes.
- No save/publish behavior changes.
- No API response or request payload changes.
- No CSS/global layout change.
- No broad redesign.

## What Changed

- Metric rows are named as accessible groups with localized row terminology,
  for example `Store Score Metric row TARGET_ACHIEVEMENT` in English.
- Ownership rows are named as accessible groups, for example
  `Ownership Matrix: TARGET_ACHIEVEMENT`.
- Grading rows are named as accessible groups, for example `Grading Bands: A`.
- Remove buttons now include row context in their accessible name while keeping
  the visible button copy unchanged.
- Targeted Playwright coverage now asserts the row/action names and verifies the
  Admin KPI Config page does not horizontally overflow at a 390px mobile
  viewport for this route state.

## Verification

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-kpi-config.spec.ts --workers=1
git diff --check
```

Result:

- All commands passed locally in the clean `codex/admin-kpi-config-v1`
  worktree.

## Next Product Readiness Target

Continue with the Store KPI / Rankings family if this PR merges cleanly. Keep
that slice focused on responsive/readability/accessibility/test evidence, and
do not change KPI scoring, ranking semantics, or source-trust interpretation.
