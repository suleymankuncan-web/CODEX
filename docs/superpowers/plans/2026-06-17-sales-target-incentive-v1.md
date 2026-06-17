# Sales Target Incentive V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 "prim" module as a sales-target-based incentive projection and close workflow for company stores only. The feature must let personnel, store managers, region managers, and admins see only the incentive data they are allowed to see, while franchise/operator stores and cashier users see no incentive surface in V1.

**Architecture:** V1 is a backend-owned calculation and authorization slice with read-only projection UI first, then controlled admin correction and period close. It reuses existing target, sales import, store assignment, role, and Store/Admin surface primitives instead of creating a parallel operational system. The implementation is split into small PRs so money math, access scope, data model, UI, correction, and close behavior can be reviewed independently.

**Tech Stack:** NestJS, PostgreSQL migrations/repositories, TypeScript calculation services, decimal-safe money arithmetic, React 19, TanStack Query, shadcn/Tailwind/lucide UI primitives, Vitest/Jest/Playwright, existing Store/Admin auth helpers.

---

## Metadata

- Status: PR-1 implementation in progress; PR-2+ blocked until PR-1 merges
- Date: 2026-06-17
- Author: Codex
- Owner: Store Ops product flow
- Primary module: Incentives / Prim
- Source modules: Targets, Integration / PowerBI Import, Store Ops, Auth, Workforce
- Primary personas: `STORE_PERSONNEL`, `STORE_MANAGER`, `REGION_MANAGER`, `SUPER_ADMIN`
- Explicitly hidden in V1: franchise/operator store users and `CASHIER` position users
- Parked: cashier incentive formula/UI, payroll export, salary-based logic, worked-day proration

## Iteration Control

This plan follows the VS Code iteration-plan style, adapted to this repo's PR/slice discipline.

- Milestone: Prim V1 Foundation
- Scope unit: PR count, not calendar estimate
- Planned train: 8 PRs
- Endgame begins after PR-7 merges.
- Endgame is done only after PR-8 passes persona smoke, admin smoke, root release gate, and close/correction evidence.
- PR-2 and later are blocked until PR-1 merges with concrete GitHub tracking issues for the remaining train and locked currency precision, period cutoff, and rule-version behavior.

Tracking issues:

| PR | Issue |
| --- | --- |
| PR-2 Calculation Kernel | https://github.com/suleymankuncan-web/CODEX/issues/724 |
| PR-3 Data Model And Migrations | https://github.com/suleymankuncan-web/CODEX/issues/725 |
| PR-4 Read Model And Source Binding | https://github.com/suleymankuncan-web/CODEX/issues/726 |
| PR-5 Read API And Authorization | https://github.com/suleymankuncan-web/CODEX/issues/727 |
| PR-6 Store UI Projection | https://github.com/suleymankuncan-web/CODEX/issues/728 |
| PR-7 Admin Read, Audit, And Manual Correction | https://github.com/suleymankuncan-web/CODEX/issues/729 |
| PR-8 Period Close And Endgame Evidence | https://github.com/suleymankuncan-web/CODEX/issues/730 |

Legend:

| Mark | Meaning |
| --- | --- |
| `[ready]` | ready for implementation |
| `[investigation]` | must remove uncertainty before code proceeds |
| `[blocked]` | cannot start until the named prerequisite closes |
| `[large]` | intentionally split or watched because it can outgrow one PR |
| `[stretch]` | not required for V1 acceptance |
| `[issue-required]` | PR-1 must create/link a GitHub issue before implementation |

## Product Decisions Locked

- Incentive applies only to company stores.
- Franchise (`bayi`) and operator (`isletme`) stores/users see no incentive navigation, card, empty state, API result, or explanation.
- `CASHIER` users see no incentive screen, card, navigation item, or API row in V1. Cashier incentive is parked until the formula and UI content are provided.
- Incentive is based only on sales targets and sales amounts.
- Salary, payroll net, tax, deduction, seniority, attendance, and worked-day prorating are out of scope.
- No payout cap.
- No business rounding to whole TL, no smoothing, and no cap. Sub-kurus outcomes are locked in PR-1 as `truncate toward zero to two decimal places`; raw earned amounts keep at least six decimal places for audit.
- Incentive period keys use `YYYY-MM` in `Europe/Istanbul`. Final close cannot run before period end; automatic close is eligible from the first day of the next month `02:00:00 Europe/Istanbul`; `closeCutoffAt` is the actual close-run timestamp.
- Every projection and final snapshot must bind the incentive rule version/rate table version used for calculation.
- Store manager has no individual sales basis; the store manager is paid from total store actual net sales.
- Sales personnel and assistant managers are paid from their own positive sales only, but only after the store reaches the 80% monthly gate.
- Store target revision can affect incentive only after the existing target
  workflow marks it approved. Current approver roles are `REGION_MANAGER` and
  `SUPER_ADMIN`; the incentive train must not re-interpret approval by role.
- Month-end automatic close/control is required before a period is considered final.
- Manual correction capability is required and must be admin-audited.

## Existing Repo Evidence

PowerBI sales import already has the correct direction for the incentive source split:

- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
  - `sourceKind: "personnel_gross_sales"` for personnel rows.
  - `sourceKind: "store_net_sales"` for store rows.
  - `countPersonnelGrossSalesRows` uses positive personnel sales rows.
  - negative personnel rows are counted separately as reconciliation evidence.
- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
  - includes "imports personnel gross sales from positive rows and ignores negative return rows".
  - includes "keeps store net sales as the store KPI source without applying personnel returns twice".
- `docs/plans/project-debt-ledger.md`
  - states personnel KPI uses positive gross sales only.
  - states store KPI uses scoped store net sales.
  - states negative personnel rows remain reconciliation evidence.

This plan must not invert that source policy. Personnel incentive uses the seller's positive sales. A return/exchange accepted by another store does not reduce the original seller's incentive; it affects the receiving store's net sales path.

Existing target revision approval already allows both region manager and super
admin approval:

- `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
  guards target approval with `@RequireRoles("SUPER_ADMIN", "REGION_MANAGER")`.
- `admin-web/src/features/auth/authorization.ts` mirrors this with
  `targetRequestApproveRoles = ['SUPER_ADMIN', 'REGION_MANAGER']`.

The incentive train must read the existing approved target/revision state and
must not require a region-manager-specific approval when the target workflow has
already approved the revision.

## Role And Position Mapping

Auth role visibility:

- `STORE_PERSONNEL`: own incentive projection only, if the user is in an eligible non-cashier company-store position.
- `STORE_MANAGER`: own store manager incentive plus own eligible store personnel list in `/store/incentives`.
- `REGION_MANAGER`: store-by-store and personnel-by-personnel view for assigned company stores only.
- `SUPER_ADMIN`: all company stores/personnel plus admin controls.

Eligible position codes:

- `STORE_MANAGER`: store manager formula.
- `ASSISTANT_MANAGER`: sales personnel formula.
- `SENIOR_SALES_CONSULTANT`: sales personnel formula.
- `SALES_ASSOCIATE`: sales personnel formula.
- `SHIFT_LEAD`: legacy/invalid for this product; normalize/classify as `ASSISTANT_MANAGER` where encountered.

Excluded position codes:

- `CASHIER`: no V1 calculation and no V1 UI/API visibility.

## Calculation Model

### Period, Timezone, And Late Import Policy

PR-1 locks the exact period/cutoff rule before calculation code starts:

- Canonical period key: `YYYY-MM`.
- Canonical timezone: `Europe/Istanbul`.
- Period boundary: from the first day of the month at `00:00:00 Europe/Istanbul` up to, but not including, the first day of the next month at `00:00:00 Europe/Istanbul`.
- Final close cannot run before the period ends.
- Automatic close is eligible to run from the first day of the next month `02:00:00 Europe/Istanbul`.
- Sales rows must be assigned to the incentive period by source sales date/period, not by upload timestamp.
- Projection may use same-period imports that have been accepted before the query time.
- Period close must record `closeCutoffAt`, the actual close-run timestamp.
- Final close must include only accepted imports with source sales date/period in the incentive period and accepted at or before `closeCutoffAt`.
- Imports accepted after close for a closed period must not rewrite the final snapshot. They require an explicit admin adjustment/reclose decision recorded as evidence.
- If source period/date is missing or ambiguous, the affected row is `no_source`/`blocked`; it must not be inferred from upload time.

### Money Precision

PR-1 locks the exact precision rule before calculation code starts:

- Use decimal arithmetic only; JS floating point money math is forbidden.
- Store imported/source amounts with the existing source precision.
- Store `rawEarnedAmount` with at least six decimal places to preserve multiplication output.
- Store/display payable, final, correction, and adjustment amounts with exactly two decimal places.
- Sub-kurus outcomes truncate toward zero to two decimal places.
- Do not round to whole TL and do not apply business-friendly smoothing.
- The fixture file `docs/implementation/sales-target-incentive-v1-fixtures.md` is the PR-2 source for precision edge tests.

### Rule Version And Rate Table Binding

PR-1 locks the initial calculation rule identity:

- Initial rule version code: `sales-target-incentive-v1.0.0`.
- Initial manager rate table version: `manager-sales-target-v1.0.0`.
- Initial personnel rate table version: `personnel-sales-target-v1.0.0`.
- Projection DTOs must expose the rule version used for the projection.
- Final snapshots must persist the rule version and rate table version used at close.
- Later rule versions must not recalculate closed snapshots.

### Rate Bracket Boundary Semantics

PR-1 locks rate lookup semantics before PR-2 calculation code starts:

- Achievement is calculated with exact decimal arithmetic from
  `actual / target * 100`.
- Rate lookup must not round, floor, or truncate the achievement before
  selecting a bracket.
- Rate brackets are lower-bound inclusive and upper-bound exclusive.
- Display labels such as `80% - 84,9%` are not authoritative calculation
  boundaries.
- Example: `89.9600%` and `89.9999%` remain in the `>= 85.0000% and <
  90.0000%` bracket; only `90.0000%` moves to the next bracket.

### Missing, Zero, And Negative Source Rules

Calculation code must not silently convert unavailable source data into a valid zero payout.

- Missing approved store target: row state `blocked`, no manager/personnel calculation, period close blocked for that store.
- Store target `<= 0`: row state `blocked`, no division, period close blocked for that store.
- Missing approved personnel target for an eligible person: person row state `blocked`, no personal calculation.
- Personnel target `<= 0`: person row state `blocked`, no division.
- Missing store sales import: projection state `no_source`, close blocked for the store.
- Missing personnel sales import while store source exists: person row state `no_source`.
- Valid zero actual sales with valid target: achievement `0%`, rate `0`, earned amount `0`.
- Negative store net sales: achievement can be negative, manager rate `0`, store gate fails for personnel.
- Personnel incentive uses only positive personnel sales source rows; negative personnel rows remain reconciliation evidence.

### Store Manager

Inputs:

- Monthly store target.
- Store actual net sales from the store sales source.
- Approved target revision, if any.

Formula:

```text
storeAchievementPct = (storeNetSales / approvedStoreTarget) * 100
managerRate = rateByStoreAchievementPct(storeAchievementPct)
managerIncentiveRaw = storeNetSales * managerRate
managerPayableAmount = applyLockedCurrencyPrecision(managerIncentiveRaw)
```

Rate table:

| Store achievement | Rate |
| --- | ---: |
| < 80.0000% | 0.0000 |
| >= 80.0000% and < 85.0000% | 0.0020 |
| >= 85.0000% and < 90.0000% | 0.0030 |
| >= 90.0000% and < 95.0000% | 0.0040 |
| >= 95.0000% and < 100.0000% | 0.0050 |
| >= 100.0000% and < 110.0000% | 0.0070 |
| >= 110.0000% | 0.0100 |

Confirmed example:

- Store actual sales: 1,000,000 TL.
- Store achievement: 115%.
- Rate: 0.0100.
- Store manager incentive: 10,000 TL.

### Sales Personnel And Assistant Manager

Inputs:

- Monthly store target.
- Store actual net sales from the store sales source.
- Monthly personnel target.
- Personnel positive gross sales from the personnel sales source.
- Approved personnel target revision, if any.

Gate:

```text
storeAchievementPct = (storeNetSales / approvedStoreTarget) * 100

if storeAchievementPct < 80.0000:
  personalIncentiveRaw = 0
```

Formula after store gate passes:

```text
personalAchievementPct = (personalPositiveSales / approvedPersonalTarget) * 100
personalRate = rateByPersonalAchievementPct(personalAchievementPct)
personalIncentiveRaw = personalPositiveSales * personalRate
personalPayableAmount = applyLockedCurrencyPrecision(personalIncentiveRaw)
```

Rate table:

| Personal achievement | Rate |
| --- | ---: |
| < 80.0000% | 0.0000 |
| >= 80.0000% and < 85.0000% | 0.0050 |
| >= 85.0000% and < 90.0000% | 0.0050 |
| >= 90.0000% and < 95.0000% | 0.0065 |
| >= 95.0000% and < 100.0000% | 0.0075 |
| >= 100.0000% and < 110.0000% | 0.0150 |
| >= 110.0000% | 0.0165 |

Confirmed gate example:

- Store target: 6,000,000 TL.
- Store actual sales: 3,750,000 TL.
- Store achievement: 62.5%.
- Personnel target: 1,500,000 TL.
- Personnel actual positive sales: 2,000,000 TL.
- Personnel achievement: 133.33%.
- Normal personal rate would be 0.0165, but store gate fails.
- Final personnel incentive: 0 TL.

### Daily Progress

Daily import updates must produce current monthly progress, not daily-prorated payout:

- day 10 can show "monthly target progress: 30%".
- day 25 can show "monthly target progress: 80%".
- final payout still uses the full approved monthly target denominator.

Projection rows must make the distinction visible:

- current period progress,
- current eligible rate,
- gate state,
- projected/current earned amount,
- last import timestamp/source.

### Target Revision

- Store manager can create a target revision through the existing target workflow.
- Existing target workflow approval is required. The approved revision may have
  been approved by `REGION_MANAGER` or `SUPER_ADMIN`.
- Until approval, incentive calculations continue using the currently approved target.
- After approval, incentive calculations use the approved revised store/personnel target for the period.
- Revision history must be visible enough to explain why a target changed.
- Rejected/pending revisions must not change incentive results.
- Period close is blocked if a pending revision would make the final payout ambiguous.

### Transfer And Assignment

V1 uses the latest approved assignment at period close for final calculation:

- Store manager who changes store earns according to the store they moved to.
- Personnel who changes store earns according to the store they moved to.
- No day-count, no worked-day prorating, and no partial-period split in V1.
- Projection can use the current approved assignment, but final close freezes an assignment snapshot for the period.
- Closed periods must never recalculate from a later assignment change.

Implementation must document the assignment cutover source so historical periods remain explainable.

### Manual Correction

Manual correction is required, but it must be controlled:

- admin-only in V1,
- requires reason text,
- pre-close correction can change the current projection/correction amount before the final snapshot is frozen,
- post-close correction must create an adjustment record against the closed snapshot,
- stores before/after amount and the correction phase (`pre_close` or `post_close`),
- stores changed target/sales/rate/amount fields separately when those fields are correction inputs,
- writes audit actor, timestamp, period, store, personnel where relevant,
- never mutates raw imported sales rows,
- produces a visible projected/corrected/final/adjusted amount distinction.

Corrections after close must create an adjustment record, not silently rewrite the closed calculation.

### Period Close

Month-end close/control must:

- verify required imports exist,
- verify approved targets exist,
- verify no pending target revision is blocking final calculation,
- freeze assignment snapshot for the period,
- freeze rule version/rate table version for the period,
- record close cutoff and accepted import evidence set,
- calculate all eligible company-store rows,
- freeze final incentive snapshots,
- expose close status and close evidence to admin,
- keep projection and final states separate.

## Privacy, Security, And Evidence Controls

Incentive data is personnel performance and compensation-adjacent data even though it is not payroll.

- Service-level company-store filtering is mandatory.
- Route guards alone are not enough.
- Region manager queries must filter by assigned stores.
- Store manager queries must filter by own store.
- Store personnel queries must filter by own identity and eligible position.
- Franchise/operator data must be filtered before DTO construction.
- `CASHIER` data must be filtered before DTO construction in V1.
- Application logs must not print raw incentive amounts, raw personal sales rows, bearer tokens, or local credentials.
- Error responses must use generic failure copy and correlation ids, not raw calculation evidence.
- Screenshots/evidence for PRs must be sanitized when they show real personnel names or amounts.
- Export/download is out of scope for V1 unless a separate PR defines access, audit, and retention.

## UI Requirements

### Shared UI Principles

- Use existing Store/Admin surface primitives, shadcn/Tailwind tokens, and lucide icons.
- Do not create fake/sample incentive data in product UI.
- Show only real values from API; if missing, show a source-specific unavailable state.
- Rate tables must be visible in the relevant UI for store manager and eligible personnel.
- Product UI labels must be Turkish.
- Currency must be formatted as TL with the locked kurus precision policy.

### `/store/me`

For eligible company-store personnel:

- show own monthly incentive card,
- show store 80% gate status,
- show own target, own actual sales, own achievement, current rate, current earned amount,
- show last import/source timestamp,
- show rate table or compact "rate rule" disclosure.

For cashier, franchise, and operator users:

- no incentive card,
- no menu label,
- no API-visible incentive state,
- no explanatory "not eligible" panel in V1.

### `/store/incentives` - Store Manager

For eligible company-store store manager:

- show own manager incentive card from store net sales,
- show store target, store actual, store achievement, rate, earned amount,
- show manager rate table,
- show eligible personnel list with target, actual positive sales, achievement, rate, earned amount, and gate state,
- exclude cashier rows in V1,
- show sales personnel rate table,
- show approved target revision indicator when relevant.

### `/store/incentives` - Region Manager

For region manager:

- show only assigned company stores,
- group by store,
- show store gate and manager incentive,
- show eligible personnel incentive rows inside each store,
- exclude cashier rows in V1,
- allow drilldown but no admin-only correction in V1 unless explicitly scoped later.

### Admin Surface

Admin must be able to:

- see all company store incentive rows for eligible V1 positions,
- verify cashier users are excluded from V1 calculation/UI,
- inspect rule version/rate table,
- inspect import and target evidence,
- apply manual corrections,
- run or inspect period close,
- view audit history.

Default admin route is `/admin/incentives`. If implementation finds an existing admin route pattern that must be reused instead, PR-7 must update this plan and API/UI evidence before merge.

## Backend/API Requirements

Data model must separate these concepts:

- incentive rule version,
- rate bracket,
- period projection,
- final closed snapshot,
- final assignment snapshot,
- final rule-version snapshot,
- manual correction/adjustment,
- source evidence pointers,
- close run/evidence.

Initial read DTO contract:

```ts
type IncentiveProjection = {
  period: string
  periodTimezone: "Europe/Istanbul"
  closeCutoffAt: string | null
  ruleVersionId: string
  storeId: string
  storeName: string
  storeOwnershipType: "company"
  roleScope: "own" | "store" | "region" | "admin"
  storeTarget: string | null
  storeActualNetSales: string | null
  storeAchievementPct: string | null
  storeGatePassed: boolean | null
  calculationState: "projected" | "no_source" | "blocked" | "closed" | "corrected" | "adjusted"
  blockedReason: string | null
  lastImportAt: string | null
  rows: IncentivePersonRow[]
}

type IncentivePersonRow = {
  userId: string
  displayName: string
  positionCode: "STORE_MANAGER" | "ASSISTANT_MANAGER" | "SENIOR_SALES_CONSULTANT" | "SALES_ASSOCIATE"
  target: string | null
  actualPositiveSales: string | null
  achievementPct: string | null
  rate: string | null
  rawEarnedAmount: string | null
  payableAmount: string | null
  correctionAmount: string | null
  adjustmentAmount: string | null
  finalAmount: string | null
  status: "projected" | "no_source" | "blocked" | "closed" | "corrected" | "adjusted"
  blockedReason: string | null
  explanation: string
}
```

## PR Train

### PR-1: Spec Lock, Tracking, And Fixtures `[ready]`

Risk class: R0 docs/process plus guard fixture only.

- [x] Add this plan to active planning index if the repo uses one.
- [x] Create or link GitHub tracking issues for PR-2 through PR-8, then update this plan with those issue URLs before code work starts.
- [x] Add calculation fixture document with confirmed examples, missing-source states, zero-target states, cashier exclusion, and transfer close snapshot behavior.
- [x] Lock the deterministic currency precision policy for sub-kurus outcomes.
- [x] Lock `YYYY-MM` / `Europe/Istanbul` period behavior, close cutoff, and late-import handling.
- [x] Lock rule-version/rate-table binding for projection and final snapshots.
- [x] Add/update a lightweight guard documenting that `/store/incentives` is no longer only a parked concept once implementation begins.
- [x] Add backend contract test skeletons or snapshots for company-store, cashier, franchise/operator, and role-scope visibility expectations before building data access.

Verification:

- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-2: Calculation Kernel `[blocked: PR-1]` `[issue-required]`

Risk class: R3 business calculation.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/724

- [ ] Add pure TypeScript calculation service for manager and personnel formulas.
- [ ] Add decimal-safe calculation helpers; JS floating point money math must fail review.
- [ ] Add rate bracket fixtures for manager and personnel.
- [ ] Add tests for all bracket edges and near-threshold values: `79.9999`, `80.0000`, `84.9999`, `85.0000`, `89.9600`, `89.9999`, `90.0000`, `94.9999`, `95.0000`, `99.9999`, `100.0000`, `109.9999`, `110.0000`, and above.
- [ ] Add tests for missing target, zero target, missing import, zero actual sales, negative store net sales, store gate fail/pass, no cap, and locked currency precision.
- [ ] Add tests for period boundary, timezone, close cutoff, and late-import exclusion behavior.
- [ ] Add tests proving a calculation binds the expected rule version/rate table version.
- [ ] Add tests for `SHIFT_LEAD` normalization to `ASSISTANT_MANAGER`.
- [ ] Add tests proving `CASHIER` is excluded from V1 calculation.
- [ ] Keep the service isolated from database and UI.

Verification:

- [ ] backend targeted unit tests
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-3: Data Model And Migrations `[blocked: PR-2]` `[issue-required]`

Risk class: R4 migration/schema.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/725

- [ ] Add or explicitly reuse schema for rule versions, rate brackets, projections/final snapshots, assignment snapshots, rule-version snapshots, close runs, and corrections/adjustments. Any reuse must prove ownership boundaries, immutable evidence pointers, and final snapshot separation in PR evidence.
- [ ] Keep raw imported sales immutable; new tables point to evidence instead of copying source rows blindly.
- [ ] Add migration tests or schema smoke evidence according to repo migration discipline.
- [ ] Add seed/reference rows only for rule versions/rate brackets, not fake incentive results.
- [ ] Ensure final snapshots persist `ruleVersionId`, period key, timezone, close cutoff, and source evidence pointers.

Verification:

- [ ] backend migration/schema targeted tests
- [ ] `npm.cmd run test:scripts`
- [ ] `npm.cmd run smoke:migration:fresh-db`
- [ ] `git diff --check`
- [ ] migration smoke evidence attached to PR

### PR-4: Read Model Repository And Source Binding `[blocked: PR-3]` `[issue-required]`

Risk class: R4 data/source semantics.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/726

- [ ] Add repository/service layer that reads approved targets, approved revisions, current assignments, store net sales, and personnel positive sales.
- [ ] Bind store manager calculation to store net sales source.
- [ ] Bind personnel calculation to positive personnel gross sales source.
- [ ] Apply company-store, cashier, franchise/operator, and role-scope filtering before DTO construction.
- [ ] Add tests for missing source states and close-blocking states.
- [ ] Add tests proving returns/exchanges from other stores do not reduce the original seller's personnel source.
- [ ] Add tests proving source period/date, not upload timestamp, controls period assignment.

Verification:

- [ ] backend repository/service tests
- [ ] PowerBI source-policy regression tests where touched
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-5: Read API And Authorization `[blocked: PR-4]` `[issue-required]`

Risk class: R4 auth/API contract.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/727

- [ ] Add `/store/me` incentive read endpoint for eligible own-user projection.
- [ ] Add `/store/incentives` read endpoint for store manager and region manager scopes.
- [ ] Add admin read endpoint for all eligible company-store incentive records; admin mutation remains later.
- [ ] Add tests for franchise/operator invisibility.
- [ ] Add tests for cashier invisibility.
- [ ] Add tests for store manager, region manager, personnel, and admin scoping.
- [ ] Add tests proving API error/log paths do not expose raw personnel sales or raw incentive amounts.
- [ ] Add generated OpenAPI/client updates for the new endpoints, or record the repo-specific no-generation decision in the PR evidence.

Verification:

- [ ] backend integration tests for auth/store filters
- [ ] backend targeted incentive API tests
- [ ] OpenAPI/client parity checks or documented no-generation decision
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-6: Store UI Projection `[blocked: PR-5]` `[issue-required]`

Risk class: R3 Store UI plus sensitive data visibility.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/728

Frontend package note: Store and Admin surfaces currently live in `admin-web`; Store UI verification therefore uses `npm.cmd --prefix admin-web ...`.

- [ ] Add `/store/me` incentive card for eligible non-cashier company-store personnel.
- [ ] Hide incentive card/navigation for cashier, franchise, and operator users.
- [ ] Add `/store/incentives` store manager view.
- [ ] Add `/store/incentives` region manager view.
- [ ] Add manager and personnel rate tables in Turkish.
- [ ] Show gate, target, actual, achievement, rate, earned amount, last import, and revision state.
- [ ] Use existing Store surface primitives and current toolbar/sidebar patterns.
- [ ] Add loading, empty, error, unauthorized, blocked, and no-source states.
- [ ] Add responsive screenshots for eligible and hidden personas.

Verification:

- [ ] `npm.cmd --prefix admin-web run lint`
- [ ] `npm.cmd --prefix admin-web run build`
- [ ] targeted Store Playwright route smoke for eligible, cashier, franchise/operator, store manager, and region manager
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-7: Admin Read, Audit, And Manual Correction `[blocked: PR-5]` `[issue-required]`

Risk class: R4 admin workflow plus compensation-adjacent data.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/729

- [ ] Add `/admin/incentives` read surface or existing-pattern admin location.
- [ ] Add admin-only manual correction workflow.
- [ ] Add audit trail for corrections.
- [ ] Add projected/corrected/final/adjusted amount distinction.
- [ ] Enforce pre-close correction versus post-close adjustment semantics.
- [ ] Add tests proving corrections do not mutate raw sales/import evidence.
- [ ] Add privacy-safe error/log behavior for correction failures.

Verification:

- [ ] backend correction tests
- [ ] admin UI tests for correction permissions
- [ ] audit evidence checks
- [ ] `npm.cmd --prefix admin-web run lint`
- [ ] `npm.cmd --prefix admin-web run build`
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

### PR-8: Period Close And Endgame Evidence `[blocked: PR-7]` `[issue-required]`

Risk class: R5 close/finalization.

Tracking issue: https://github.com/suleymankuncan-web/CODEX/issues/730

- [ ] Add close run inspection and close status.
- [ ] Add close-run validation for imports, targets, revisions, assignment snapshot, rule-version snapshot, close cutoff, and calculation completeness.
- [ ] Freeze final snapshots separately from current projections.
- [ ] Ensure corrections after close create adjustments rather than rewriting closed calculations.
- [ ] Add endgame evidence covering eligible personnel, store manager, region manager, admin, cashier hidden, franchise/operator hidden, and missing-source blocked states.
- [ ] Update current-state/handoff only if the implementation changes active project state.

Verification:

- [ ] backend close-run tests
- [ ] period close integration tests
- [ ] targeted persona Playwright smoke
- [ ] root `npm.cmd run check:release`
- [ ] `git diff --check`

## Acceptance And Verification Matrix

| Requirement | Required proof |
| --- | --- |
| Company-store eligible personnel can see only their own incentive projection in `/store/me`. | PR-5 API scope test and PR-6 Store UI smoke |
| Cashier users see no incentive UI/API signal in V1. | PR-2 calculation exclusion, PR-5 API invisibility test, PR-6 hidden-persona smoke |
| Franchise/operator users see no incentive UI/API signal. | PR-5 API invisibility test and PR-6 hidden-persona smoke |
| Store manager can see own manager incentive and eligible store personnel incentives. | PR-5 scope test and PR-6 store manager smoke |
| Region manager can see only assigned company stores/personnel. | PR-5 assigned-store scope test and PR-6 region manager smoke |
| Admin can see all eligible company-store incentive records and audit evidence. | PR-5 admin API scope test, PR-7 admin UI test, and audit evidence |
| Store manager calculation uses store net sales and manager achievement bracket. | PR-2 calculation fixture and PR-4 source binding test |
| Personnel calculation uses store 80% gate plus personal positive sales achievement bracket. | PR-2 gate tests and PR-4 source binding test |
| Missing/zero target and missing import states do not silently become valid zero payouts. | PR-2 blocked/no-source tests and PR-8 close validation tests |
| Period assignment uses `YYYY-MM` in `Europe/Istanbul`, source sales date/period, and locked close cutoff. | PR-1 fixture, PR-2 period tests, PR-4 source-period tests, PR-8 close evidence |
| Target revision affects incentive only after existing workflow approval by `REGION_MANAGER` or `SUPER_ADMIN`. | PR-4 approved/pending/rejected revision tests |
| Final snapshots bind rule version/rate table version and do not recalculate under later rate changes. | PR-2 rule-version fixture, PR-3 schema proof, PR-8 close snapshot test |
| Transfer behavior is based on final close assignment snapshot, not later current state. | PR-8 assignment snapshot tests |
| Month-end close freezes final snapshots separately from current projections. | PR-8 close-run tests |
| Manual correction is audited, separates pre-close correction from post-close adjustment, and does not rewrite raw import data. | PR-7 correction/audit tests and PR-8 post-close adjustment tests |
| PowerBI source semantics remain intact. | PR-4 source-policy regression |
| Logs, errors, and PR evidence do not expose raw personnel sales, raw incentive amounts, or unsanitized personnel evidence. | PR-5 API privacy tests, PR-7 correction privacy tests, PR-8 endgame evidence |

## Risks And Stop Rules

- Stop if store ownership type is not reliably available at the service layer.
- Stop if cashier exclusion cannot happen before DTO construction.
- Stop if approved target/revision source cannot be identified without changing target workflow semantics.
- Stop if money calculation would require JS floating point arithmetic.
- Stop if PR-1 does not lock the sub-kurus precision policy.
- Stop if PR-1 does not lock period timezone, close cutoff, and late-import policy.
- Stop if final snapshots cannot bind the rule version/rate table version used for calculation.
- Stop if implementation requires exposing incentive hints to franchise/operator or cashier users.
- Stop if assignment snapshotting cannot prevent closed-period recalculation drift.
- Stop if final-close behavior cannot distinguish projection from closed snapshot.
- Stop if logs/errors would expose raw personnel sales or incentive amounts.

## Parked For V2

- Cashier incentive formula, UI, and visibility.
- Payroll export or payroll-system integration.
- Salary/tax/net payout calculations.
- Worked-day prorating or split-period transfer calculations.
- Advanced rule editor beyond admin-owned V1 rate configuration.
- Notifications for incentive changes.
- Dispute/approval workflow for personnel-facing incentive challenges.
- Export/download workflows for incentive data.
