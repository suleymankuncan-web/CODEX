# Incentive rate, notes and store review — 2026-09-10

Scope: extend the rebuilt Primler list and drawers, keeping existing regional review, correction and final-approval contracts. This is a root self-review, not an independent review. No PR or deployment was performed.

## Result

- Store rows expose a shadcn Checkbox for regional review. Existing capability, period-close, pending-request and stale-workspace gates apply. Report Viewer/Admin shows the state without gaining write permission.
- Personnel entries have a prominent “Prim oranı ve not” action and show saved correction notes.
- The correction drawer separates its sections with blue surfaces. A shadcn ToggleGroup selects persisted incentive rates and displays each rate's proposed amount. Duplicate rate brackets share one option; thresholds remain visible.
- Rate changes recalculate the final amount using the existing decimal money helper. Only one option is selected, and reopening an existing correction selects the rate matching its saved amount, when one exists. The automatic calculation rate remains separately identified.
- The note is mandatory (3–1000 characters). Saving an unchanged amount is disabled to match the existing server rule. Inputs lock during submission. No new endpoint or backend permission was introduced.

## Local synthetic data boundary

Only the 18 explicitly named synthetic `UI-KPI-*` and `UI-RV-KPI-*` stores in the local Docker `store_ops` database were seeded. Each has six participants (108 total). Of these, 75 have a positive calculated incentive and 33 have zero, using the existing calculator.

The fixture preserves existing synthetic store monthly sales amounts, creates synthetic approved target references, and populates personnel sales. The dedicated `ui-prim-local-synthetic` mock import is clearly marked `LOCAL-SYNTHETIC-UI-FIXTURE`. The application requires the integration source contract for incentive calculations; these local records are mock integration inputs, not evidence of a provider import. Synthetic monthly personnel sales/targets in this cohort are updated as part of this fixture and may also be reflected in local KPI/target pages. Unrelated stores and production/provider data were not changed.

September 2026 closure is simulated through the existing close repository for these stores only, to allow the requested interactions in the default displayed month. This is not a real September period close; no product close-date guard was weakened. No final approval was performed or permission granted.

Private local recovery assets (outside Git): `C:/Users/suley/.codex/tmp/incentive-rate-review-20260910/`. Contains a pre-seed database dump, pre-edit UI backup, transactional seed script and verification logs. The seed refuses an already-closed cohort and rolls back on failure. Do not run it on another database. A full dump restore would revert other later local DB work and must not be done casually.

## Verification

- Live regional UI: Ada Demo 1 in Atlas AVM · Demo changed to 1.50%, yielding TRY 10,114.29. A synthetic note was saved and displayed in the store drawer; the store total updated to TRY 27,814.29. Reopening preserved the rate matching the saved amount.
- Live checkbox: Atlas regional review persisted after page reload. The same state is disabled/read-only in Report Viewer/Admin.
- Live viewer: selecting Ayşe Demir shows populated store/personnel details; no regional correction controls are exposed.
- Final source: `npm.cmd run build:e2e` passed (TypeScript + Vite); `npm.cmd run lint` passed; scoped `git diff --check` passed. Vite retains the existing large-chunk warning.
- Final UI run: **45/45 passed** across incentive contracts, list/drawer parity and projection/accessibility specs. Includes 320/390/1024/1440px layouts, rate recalculation/exact payload, required note and unchanged-amount gates, pending checkbox state, closed-period/read-only gates, rollback, focus restoration and Axe checks. Final run log: private recovery folder `playwright-final.log`.
- The separate five final-approval tests passed in the initial run of this task. They were not rerun after the final label/contrast fixes. No backend approval implementation changed.
- Visually inspected final 320px store and correction drawer screenshots and live desktop views for both roles.

## Review observations

The first verification pass found low contrast on disabled checkbox labels and an outdated contract test that attempted to save an unchanged amount. Labels retain readable contrast; the test now changes the amount and separately asserts the unchanged-amount and short-note gates. Visible action labels and accessible names match. Drawer focus starts at the header instead of scrolling directly to the selected rate.
