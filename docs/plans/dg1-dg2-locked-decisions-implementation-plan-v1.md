# DG1-DG2 Locked Decisions Implementation Plan V1

Status: active
Shelf: architecture
Use when: implementing the owner-locked DG1 authorization truth and DG2 data-preservation decisions
Do not use when: widening unrelated Report Viewer access, changing action permissions, deleting staging data, or claiming PR-10 is already authorized
Source of truth: owner decisions dated 2026-07-11, `project-wide-audit-remediation-plan-v1.md`, and current repository/runtime contracts
Last verified: 2026-07-11
Target executor: ChatGPT 5.6 Luna Max

## 1. Reader And Required Outcome

This is an execution plan, not a discovery brief. A cold executor must be able
to implement the approved behavior without reconstructing the earlier chat.

After reading, the executor must know:

- exactly what DG1 and DG2 decisions are locked;
- which access is read-only and which action access must not change;
- why Norm Kadro requires presentation cleanup rather than database cleanup;
- why live database preflight cannot run until its TLS path is hardened;
- which work is authorized now and which work remains evidence-gated;
- the exact PR order, tests, rollback, stop conditions, and evidence expected.

The target is seven authorized slices plus one conditional database-constraint
phase. The seven slices normally map to seven PRs. The conditional phase may be
one or more PRs only after its evidence gates close. This plan document lands
with slice DG1-A; do not open a separate plan-only PR.

The current `codex/dg1-dg2-implementation-plan` branch is a preparation branch.
Do not push it or open a PR while it contains docs only. Add DG1-A's approved
implementation and proof first, unless the owner gives a newer instruction
explicitly authorizing a plan-only PR.

## 2. Luna Max Execution Contract

Follow these rules literally.

1. Before every slice, fetch origin, fast-forward local main, verify the clean
   main SHA, and create a new branch from that SHA. Do not rebase shared work.
2. Use the `codex/` branch prefix unless the owner gives a newer instruction.
3. Implement one slice story at a time. Do not mix the next slice into the current
   diff.
4. The owner has explicitly authorized autonomous PR closeout and merge for
   this train. After the `hr-axis-pr-closeout` gates are satisfied, merge each
   PR non-interactively, sync `origin/main`, verify the merge commit, and
   continue from the merged SHA. Do not merge a red, non-mergeable, unclear,
   or actionable-review-blocked PR.
5. Do not request, trigger, mention as required, or wait for GitHub Codex
   review. It is disabled by explicit owner instruction.
6. Local review, relevant tests, required GitHub checks, mergeability, and
   deployment checks where applicable remain mandatory.
7. After a PR is opened, monitor checks in the background. Prepare independent
   next-PR work in a separate worktree while checks run. Never run two full
   release suites concurrently.
8. A dependent PR must start from the merged predecessor on fresh main. A
   preparation worktree may not be treated as accepted runtime truth.
9. Never print or commit database URLs, CA contents, tokens, cookies, raw UUID
   samples, employee data, or provider secrets.
10. Slices DG1-A through DG2-C perform no business-row DML. The conditional
    constraints phase may perform only its separately approved DDL; it still
    may not auto-repair or delete real staging data.
11. Stop when a condition in Section 16 is met. Do not invent a workaround.
12. Record facts from the current branch and live checks, not from old PR
    descriptions.

## 3. Locked Decisions

### 3.1 DG1 Authorization Product Truth

| ID | Locked decision | Exact interpretation |
| --- | --- | --- |
| DG1-1 | Store Manager and store teams cannot access incentives. | `/store/incentives` requires Region Manager and preserves the existing Super Admin emergency bypass. Remove Store Manager access. Remove Store Personnel incentive figures from `/store/me`; retire the own-incentive endpoint only after the required consumer/usage classification. Non-incentive self-performance remains. |
| DG1-2 | Report Viewer is upper management and may see Store-side content across its assigned company. | Implement the explicit read-only allowlist below for every store inside the company IDs assigned specifically to the Report Viewer role. It receives no mutation permission. |
| DG1-3 | Report Viewer may see personnel details across its company. | For `/store/personnel/:employeeId`, Report Viewer may read the existing personnel-performance response only when the employee's current active assignment belongs to one of its role-specific company IDs. It receives no write or workflow permission. |
| DG1-4 | Production Admin Session is read-only. | Mock/header/bearer editing, save, reset, and edit-then-verify controls exist only in local development. Non-development builds show status and safe verification output without editable credentials or mock headers. |

The DG1-2 allowlist is intentionally explicit. Luna Max must not infer routes
from the word “all”. Report Viewer receives company-scoped read access to:

- `/store` and `/store/home`;
- `/store/checklists`, limited to existing result/acknowledgement reads;
- `/store/tasks`, including workflow and Store Action plan reads;
- `/store/kpis` and store score breakdown reads;
- `/store/personnel/:employeeId`;
- `/store/rankings`;
- `/store/feed`;
- `/store/competitions`;
- `/store/approvals`;
- `/store/targets`;
- `/store/workforce`, as a read-only company portfolio with no request/form
  mode;
- `/store/reports`;
- `/store/settings`.

Explicit exceptions:

- `/store/me` remains a self-performance route for Store Manager/Store
  Personnel and is not a Report Viewer route;
- `/store/incentives` requires Region Manager for ordinary Store roles; the
  existing Super Admin emergency bypass is unchanged;
- checklist visit execution, action-assisted lookup endpoints, and all
  mutations remain outside Report Viewer scope.

Decision interpretation is locked for execution: “store teams cannot access
incentives” includes the current Store Personnel own-incentive projection, not
only the Region Manager command page. The endpoint retirement still requires a
read-only consumer/usage classification so an unknown client is not broken
silently. Likewise, “all Store-side content” means the explicit read-only
allowlist above, not an unbounded role shortcut. A newer owner instruction is
required to change either product interpretation before DG1-C.

### 3.3 Mapping To The Parent Audit Plan

| Slice | Parent-plan mapping | Status |
| --- | --- | --- |
| DG1-A | Parent PR-2 backend authorization split | Authorized |
| DG1-B | Parent PR-2 frontend/read-only portfolio split | Depends on DG1-A |
| DG1-C | Parent PR-2 incentive alignment split | Authorized; endpoint retirement usage-gated |
| DG1-D | Parent PR-2 production Session split | Authorized |
| DG2-A | Owner-requested Norm Kadro presentation cleanup adjacent to DG2 | Authorized |
| DG2-B | Parent PR-9 live-evidence runner hardening | Authorized |
| DG2-C | Parent PR-9 approved staging evidence completion | Depends on DG2-B and owner-approved target |
| DB-CONSTRAINTS | Parent PR-10 | Conditional; not authorized yet |

### 3.2 DG2 Data And Presentation Truth

| ID | Locked decision | Exact interpretation |
| --- | --- | --- |
| DG2-1 | Staging contains real data. | Treat employee assignments, turnover events, workforce plans, snapshots, reports, KPIs, targets, and related records as real. Preserve them. |
| DG2-2 | The presentation-only issue is limited to Norm Kadro store percentages. | Remove the numeric turnover percentage exposure introduced for the Norm Kadro demo and restore the prior honest `Veri yok` state there. |
| DG2-3 | Do not perform automatic cleanup. | No `UPDATE`, `DELETE`, reset, reseed, bulk correction, or compensating fake value is allowed. |
| DG2-4 | Real turnover reporting remains valid. | Do not change `ops.turnover_event`, `rpt.turnover_snapshot`, turnover reports, monthly report packages, roster reconciliation, or their formulas. |
| DG2-5 | Database constraints remain evidence-gated. | The data-preservation decision does not substitute for approved staging invariant counts, temporal semantics, target enforcement semantics, or a measured lock strategy. |

The important technical fact is that no fake percentage row is stored. Commit
`dcfbe2b5` (`Show workforce turnover demo data`) added a read-time projection
from real `ops.employee_assignment_history` and `ops.turnover_event` data, then
exposed that projection on Norm Kadro. Therefore the correct cleanup is a
surgical presentation/API projection reversal, not a database repair.

## 4. Current Verified Baseline

- Base architecture remains a React/Vite frontend, NestJS modular monolith,
  and PostgreSQL database.
- `admin-web/src/app/store-route-registry.ts` already exposes Store KPI and
  personnel-detail routes to Report Viewer and keeps Store incentives Region
  Manager-only, but rankings, competitions, and workforce still need explicit
  Report Viewer route/read-only alignment.
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts` currently
  omits Report Viewer from `store-kpi-highlights` and
  `personnel-performance/:employeeId`.
- The personnel service currently authorizes self, Store Manager assigned
  stores, Region Manager regions, and Super Admin scope. It has no Report
  Viewer company branch.
- Store Action plan reads, workforce reads, rankings, and score breakdowns do
  not yet implement the complete Report Viewer company-read allowlist.
- `backend/nestjs/src/modules/store-ops/web/store-sales-target-incentive.controller.ts`
  currently allows Store Manager on `GET /api/store/incentives`; all incentive
  commands already require Region Manager in their ordinary route metadata.
- Auth Admin preview currently overstates Store incentives roles.
- `GET /api/store/me/incentives` and its self-performance UI still expose an
  incentive projection to Store Personnel and must be retired under DG1-1.
- `admin-web/src/pages/SessionReadinessPage.tsx` currently renders editable
  mock/header and bearer controls without a non-development read-only boundary.
- PR-9 read-only invariant tooling is merged, but no approved staging result is
  recorded.
- The current invariant CLI has a TLS defect: with
  `DB_SSL_MODE=verify-full`, it builds `ssl:false`. It must not be run against
  staging before DG2-B fixes this path.

## 5. Architecture And Security Boundaries

### 5.1 Read Scope Is Not Action Scope

For Report Viewer:

```text
effective read companies = actor.roleScopes.REPORT_VIEWER.companyIds
effective action stores   = none added by this plan
effective mutation rights = unchanged
```

`AuthenticatedUser.scope` / `readScope` may be a union of several roles. Do not
use that union as the primary source for Report Viewer authorization. Use the
role-specific `actor.roleScopes?.REPORT_VIEWER.companyIds`. A fallback to
`readScope.companyIds` is allowed only in an explicitly tested mock/provider
development compatibility path where role-specific scopes are unavailable.

Never derive company access from a query parameter, route parameter, frontend
state, preview persona, another role's region/store scope, or
`actionScope.assignedStoreIds`. The authenticated backend role assignment owns
the company boundary.

If a session has multiple company IDs, Report Viewer may read the union of
those companies and nothing outside them. If it has zero company IDs, it must
not fall back to global, region, assigned-store, or first-record access.

List queries must be company-filtered in repository SQL. Direct ID reads for a
store, employee, or Store Action plan must resolve the target company and deny
it before returning data when the company is outside scope. A mixed-role user
must not inherit Report Viewer company access from an unrelated role's store or
region assignment.

Before DG1-B exposes the frontend allowlist, DG1-A must create
`docs/architecture/report-viewer-store-read-contract-v1.md`. That contract is
an exhaustive route -> frontend call -> GET endpoint -> controller -> service
-> repository/scope-check inventory derived from the current system-flow and a
source scan. It includes every query mounted by each allowlisted page, not only
the headline endpoint. At minimum it must classify:

- `GET /api/org/stores`, used by company portfolio/selectors;
- home/checklist acknowledgement, mobile-today, and workflow reads;
- Store Action plan list/detail;
- Store KPI, score breakdown, rankings, and personnel detail;
- competition list/detail;
- target/approval/request-center reads;
- workforce headcount and store-employees reads;
- Store monthly reports, feed, and settings/session-backed reads.

For every mapped GET, the contract records one of:

- `role_specific_company_enforced` with exact positive/negative test;
- `no_business_data` with reason;
- `not_exposed_to_report_viewer` with the frontend guard;
- `blocked` with the missing implementation.

DG1-A cannot complete and DG1-B cannot open while any mapped business-data GET
is unclassified, uses unioned scope for Report Viewer, or lacks same-company,
cross-company, zero-company, and mixed-role proof. In particular,
`OrgController` must not feed a Report Viewer portfolio from unioned
`request.user.scope`.

### 5.2 Response And Privacy Boundary

- Keep current endpoint paths and successful response shapes.
- Do not add personal fields to the personnel response.
- Do not expose credentials, auth identities, tokens, bank/payroll fields, or
  fields not already returned by the current personnel-performance contract.
- Out-of-company access must return the existing safe forbidden behavior and
  must not return any target employee data.
- Do not change Store Personnel self-scope, Store Manager assigned-store scope,
  Region Manager region scope, or Super Admin behavior.
- Authorize personnel detail against the employee's current active assignment
  company, not a historical snapshot company.

### 5.3 DG2 Data Boundary

DG2-A may reverse only the Norm Kadro turnover projection/exposure introduced
by `dcfbe2b5` and its direct tests/generated flow artifacts. It must not touch:

- `db/**` or any migration;
- `ops.turnover_event` or employee assignment data;
- `ops.workforce_norm_plan`;
- `rpt.turnover_snapshot`;
- `ReportsTurnoverPage`;
- snapshot/report/monthly-report repositories;
- pilot roster reconciliation;
- KPI, target, incentive, or Store Action behavior.

## 6. Out Of Scope

- New modules, mobile implementation, microservices, or broad redesign.
- Broad production activation or a production database preflight.
- Report Viewer mutation/action permissions or action-assisted lookup access.
- Global changes to Admin routes outside production Session diagnostics.
- New personnel fields, payroll/bank data, or a new reporting response shape.
- New KPI, ranking, turnover, incentive, target, checklist, or workforce
  formulas.
- Deleting, rewriting, reseeding, or fabricating staging data.
- Combining Norm Kadro presentation cleanup with database constraints.
- Opening DB-CONSTRAINTS before its live-evidence, semantics, lock, and rollback gates.
- Branch/worktree/stash cleanup.

## 7. Functional Requirements

### DG1

- FR-DG1-01: Report Viewer can open every route in the Section 3.1 allowlist
  and no Store route outside that allowlist.
- FR-DG1-02: Company access comes from the authenticated Report Viewer
  role-specific company scope, not from a unioned scope or client input.
- FR-DG1-03: `GET /api/reports/store-kpi-highlights`, store score breakdown,
  and rankings support company-scoped Report Viewer reads.
- FR-DG1-04: A requested Store KPI, score, or ranking detail outside all Report
  Viewer company IDs is denied before data is returned.
- FR-DG1-05: `GET /api/reports/personnel-performance/:employeeId` accepts
  Report Viewer only for an employee actively assigned inside a permitted
  company.
- FR-DG1-06: Store Action plan list/detail and workforce headcount/personnel
  reads support the same company boundary.
- FR-DG1-07: Existing competition, target/approval, checklist acknowledgement,
  report, feed, settings, home, and organization reads remain available only
  after the exhaustive contract proves role-specific company isolation or no
  business-data exposure.
- FR-DG1-08: Report Viewer receives no new POST, PUT, PATCH, DELETE, approval,
  assignment, target, incentive, checklist-execution, workforce-request, or
  Store Action command permission.
- FR-DG1-09: Report Viewer workforce resolves to a read-only company portfolio,
  never a Store Manager request/form mode.
- FR-DG1-10: `/store/me` remains unavailable to Report Viewer.
- FR-DG1-11: `/store/incentives` is absent from Store Manager/store-team
  navigation and denied on direct navigation before its protected query fires.
- FR-DG1-12: `GET /api/store/incentives` rejects Store Manager, Store Personnel,
  and Report Viewer, requires Region Manager at the route contract, and leaves
  the existing Super Admin emergency bypass unchanged.
- FR-DG1-13: Store Personnel incentive figures and the
  `GET /api/store/me/incentives` contract are retired after consumer/usage
  classification; non-incentive self-performance remains. Unknown active use
  blocks retirement rather than being ignored.
- FR-DG1-14: Region Manager incentive read/commands retain their current
  service scope checks and the global Super Admin emergency bypass is neither
  widened nor removed by this plan.
- FR-DG1-15: Runtime route registry, backend role metadata, Auth Admin preview,
  human matrices, generated operating truth, and tests describe one policy.
- FR-DG1-16: Non-development Admin Session renders read-only session status and
  verification state.
- FR-DG1-17: Editable session mode, token, mock identity, role, company,
  region, store, read-scope, action-scope, save, and reset controls are absent
  from the non-development DOM.
- FR-DG1-18: Local development keeps the existing diagnostic editing workflow.
- FR-DG1-19: The route-to-GET read contract classifies and tests every business
  data request mounted by every allowlisted Report Viewer route before DG1-B.

### DG2

- FR-DG2-01: Norm Kadro does not display a numeric store turnover percentage
  in its summary, row, detail, progress bar, or CSV output.
- FR-DG2-02: Norm Kadro uses the prior honest empty state (`Veri yok` and the
  existing empty-state note) rather than a replacement percentage.
- FR-DG2-03: The Norm Kadro headcount-gap read no longer computes or exposes
  the demo-only `turnover_rate` projection.
- FR-DG2-04: Canonical turnover reporting and persisted turnover facts remain
  unchanged.
- FR-DG2-05: No data mutation or migration is part of Norm Kadro cleanup.
- FR-DG2-06: The staging invariant runner uses the same verified TLS pool
  configuration contract as the runtime database client.
- FR-DG2-07: A staging invariant run requires `verify-full`, a CA, exact
  expected host/database identity, read-only acknowledgement, bounded timeouts,
  and sanitized output.
- FR-DG2-08: Every invariant result is classified. A non-zero or uncertain
  result blocks schema enforcement and triggers no automatic repair.
- FR-DG2-09: PR-10 constraints are opened only for explicitly approved
  invariant families with existing-row, lock, validation, and rollback proof.

## 8. Non-Functional Requirements

- NFR-01 Security: backend authorization is authoritative; frontend hiding is
  defense in depth, not enforcement.
- NFR-02 Isolation: company scope comes from the authenticated session and is
  applied in repository/service reads.
- NFR-03 No enumeration: a denied personnel or store request returns no target
  record payload.
- NFR-04 Compatibility: successful API response shapes remain stable except
  for the usage-classified retirement of `GET /api/store/me/incentives` and
  removal of the demo-only Norm Kadro `turnover_rate` field from its specific
  headcount-gap response. Regenerate OpenAPI/types for both intentional changes.
- NFR-05 Data safety: DG1-A through DG2-C contain no business-row DML.
- NFR-06 Secret safety: logs and evidence contain counts and bounded hashes,
  never connection details, CA material, or raw business/personnel records.
- NFR-07 Performance: company-scoped reads use bounded/index-compatible scope
  predicates; no per-store or per-employee N+1 request is added.
- NFR-08 Release: each runtime PR passes the repository's canonical required
  release path; targeted tests supplement but do not replace it.
- NFR-09 Observability: authorization denials use existing structured/error
  behavior and do not log personal payloads.
- NFR-10 Reversibility: each PR has an independent code revert; no rollback
  requires deleting business data.

## 9. Acceptance Scenarios

### AC-01 Report Viewer KPI positive scope

Given a Report Viewer session with `companyIds = [A]`
and Store X belongs to company A,
when the user opens `/store/kpis` for Store X,
then the route and backend read succeed,
and the response contains only the existing KPI contract,
and no action capability is added.

### AC-02 Report Viewer KPI negative scope

Given the same session
and Store Y belongs to company B,
when Store Y is requested directly,
then the backend denies the request without returning Store Y data.

### AC-03 Report Viewer personnel positive scope

Given a Report Viewer session assigned to company A
and an employee with an active assignment in company A,
when `/store/personnel/:employeeId` is opened,
then the existing personnel profile is readable in live and closed modes.

### AC-04 Report Viewer personnel negative scope

Given a Report Viewer session assigned only to company A
and an employee assigned to company B,
when the profile is requested,
then the request is forbidden and no profile fields are returned.

### AC-05 Empty Report Viewer scope

Given a Report Viewer session with no company IDs,
when KPI or another employee profile is requested,
then access fails closed and never becomes global access.

### AC-05A Report Viewer Store portfolio

Given a Report Viewer assigned to company A,
when each route in the approved Store allowlist is opened,
then company-A read content is available,
company-B records are absent or forbidden,
and no mutation control or action-assisted lookup is rendered.

Given `/store/me` or `/store/incentives`,
then direct navigation is forbidden before protected requests fire.

### AC-06 Incentives policy

Given a Store Manager, Store Personnel, or other non-Region-Manager session,
when `/store/incentives`, `GET /api/store/incentives`, or the retired own
incentive endpoint is requested,
then direct navigation is denied before the protected frontend request,
and the backend denies or no longer exposes the direct API contract,
and `/store/me` contains no incentive figure.

Before the own endpoint is retired, its repository/frontend/external consumer
inventory is recorded. Unknown or active external use stops the removal and
produces a compatibility decision packet; it is not silently broken.

Given a Region Manager in valid region scope,
when the same route is used,
then the current projection and commands continue to work.

The existing Super Admin emergency bypass is regression-tested and remains
unchanged; this plan does not redefine the global bypass policy.

### AC-07 Production Admin Session

Given a non-development build,
when `/admin/session` is opened,
then session status and safe verification state are visible,
and no editable mock/header/token field or save/reset control exists in the DOM.

Given a local development build,
then the current diagnostic editor remains usable.

### AC-08 Norm Kadro presentation honesty

Given a hostile forward-compatibility fixture still includes unknown raw
`turnover_rate` values such as `12.5` and `8.1`, even though the canonical
post-change response omits that field,
when a Region Manager opens Norm Kadro,
then `%12,5`, `%8,1`, their progress bars, and a numeric regional average are
not rendered or exported,
and the controlled `Veri yok` state is shown.

### AC-09 Real turnover preservation

Given real turnover events and turnover snapshots exist,
when DG2-A is applied,
then turnover reports and monthly report contracts are unchanged,
and the diff contains no database file or data operation.

### AC-10 Safe staging preflight

Given the exact staging target is owner-approved,
`DB_SSL_MODE=verify-full`, and a valid CA is supplied outside Git,
when the invariant preflight runs,
then the connection is certificate-verified,
the transaction proves read-only mode,
the timeout is bounded,
and output contains only sanitized counts and hashes.

## 10. API And Data Contracts

| Contract | Before | After | Mutation impact |
| --- | --- | --- | --- |
| `GET /api/reports/store-kpi-highlights` | Store Manager, Region Manager | Add Report Viewer with session-company read scope; preserve existing roles | None |
| `GET /api/reports/personnel-performance/{employeeId}` | Store Personnel, Store Manager, Region Manager, Super Admin | Add Report Viewer with session-company read scope | None |
| Store score breakdown and rankings GETs | Narrow store/region roles | Add Report Viewer with role-specific company read scope | None |
| Store Action plan list/detail GETs | Existing operational roles | Add Report Viewer with role-specific company read scope | None |
| Workforce headcount and store-employee GETs | Store/region/admin roles | Add Report Viewer company read; do not add request/form lookups | None |
| `GET /api/store/incentives` | Store Manager, Region Manager | Region Manager only | None; access contracts tighten |
| `GET /api/store/me/incentives` | Store Personnel | Remove frontend visibility; retire endpoint only after read-only consumer/usage classification | None; usage-gated intentional breaking removal |
| Norm Kadro headcount-gap response | Includes demo-only calculated `turnover_rate` | Remove that projection/field and restore honest empty presentation | None |
| Canonical turnover report/snapshot contracts | Real turnover data | Unchanged | None |

### Data Model Impact

- DG1 reuses the existing `AuthenticatedUser.roleScopes.REPORT_VIEWER`
  company-scope assignment and current organization/assignment relations.
- Personnel scope is derived from the existing current active assignment and
  its canonical company; no new personnel or authorization table is created.
- DG2 removes a computed read projection. It does not delete or alter a stored
  turnover event, assignment, norm plan, snapshot, or report row.
- DG1-A through DG2-C add no table, column, index, constraint, trigger, RLS policy, or data
  migration.
- DB-CONSTRAINTS owns any later schema impact and must document the exact DDL separately
  after its evidence gates close.

No DG1 schema migration is allowed. DG2-A has no schema or data migration. A
future DB-CONSTRAINTS phase may add constraints only after the evidence and approvals defined
below.

## 11. Ordered PR Train

### DG1-A - Report Viewer Role-Specific Company Read Backend And Inventory

Purpose: implement the backend security boundary for DG1-2 and DG1-3. This slice
also includes this plan document and its docs-library/current-handoff links.

Primary implementation points:

- `AuthenticatedUser.roleScopes` handling and a small reusable Report Viewer
  company-scope resolver;
- the complete `report-viewer-store-read-contract-v1.md` inventory, including
  `/api/org/stores` and every allowlisted page query;
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`;
- `ReportingService.assertCanReadPersonnelPerformance`;
- `RankingService.canReadPersonnelProfileFromActiveAssignment` and ranking
  access policy;
- `ReportingStoreKpiReadService.assertCanReadStore`;
- Store Action plan GET list/detail controller/service/repository paths;
- workforce `headcount-gap` and `store-employees` GET paths;
- positive/negative backend authorization specs for every changed endpoint.

Required backend allowlist changes:

- reporting: personnel performance, Store KPI highlights, store score
  breakdown, and rankings GETs;
- Store Action: plan list and plan detail GETs;
- workforce: headcount gap and store employees GETs.

Tasks:

- [x] Resolve company IDs from `roleScopes.REPORT_VIEWER`, with only the
      documented development fallback.
- [x] Generate and review the exhaustive route-to-GET inventory before adding
      any new frontend entitlement.
- [x] Audit and, where necessary, fix every existing allowlisted GET so it does
      not authorize Report Viewer from a unioned scope.
- [x] Reject Report Viewer with an empty company scope.
- [x] Apply company filters in list repository SQL.
- [x] For direct store, employee, and action-plan IDs, resolve target company
      and reject cross-company reads before returning data.
- [x] Use current active-assignment company for personnel authorization.
- [x] Keep every POST/PATCH, action-scope, and action-assisted lookup contract
      unchanged.
- [x] Add same-company, cross-company, empty-scope, and mixed-role escalation
      tests for every changed endpoint family.
- [x] Prove cross-company denials return no target payload and do not run an
      unscoped repository read.
- [x] Link this plan from `docs/README.md` and update `current-state.md`.

Do not change frontend route access in DG1-A. Backend must be safe before the
company portfolio is exposed.

Rollback: revert the resolver, endpoint roles, service/repository filters, and
tests together. Keep the negative-scope tests if they still describe a valid
security boundary.

### DG1-B - Report Viewer Explicit Store Read-Only Portfolio

Purpose: expose the Section 3.1 allowlist after DG1-A makes every mounted
backend read company-safe.

Primary frontend points:

- `admin-web/src/app/store-route-registry.ts` role sets and
  `navigationByPersona.admin`;
- `admin-web/src/features/auth/authorization.ts` workforce access;
- `StoreCompetitionsPage.tsx` read access;
- `store-rankings-page-model.ts` privileged company read;
- `StoreMyPerformancePage.tsx` personnel-detail helper, while `/store/me`
  remains excluded;
- `StoreTasksPage.tsx` Store Action plan read helper;
- `StoreWorkforcePage.tsx::resolveWorkforceMode` read-only portfolio mode;
- `store-kpi-highlights-model.ts` company store selection, reusing
  `GET /api/org/stores` rather than inventing a new endpoint;
- Auth Admin preview, Store route matrix fixtures, and persona Playwright.

Tasks:

- [x] Encode the exact allowlist; do not use a generic “all Store routes” role
      shortcut.
- [x] Add Report Viewer to rankings, competitions, workforce, and any missing
      read-only navigation entries.
- [x] Keep `/store/me` and `/store/incentives` forbidden.
- [x] Use a company store selector/portfolio for KPI and workforce when no
      store ID is preselected; never select an arbitrary first global store.
- [x] Use `GET /api/org/stores` only after DG1-A proves or fixes its
      role-specific Report Viewer company scope.
- [x] Hide all mutation controls, request/form modes, visit execution, and
      action-assisted lookup controls for Report Viewer.
- [x] Add one dedicated Report Viewer Playwright persona that visits every
      allowlisted route and asserts forbidden routes make no protected request.
- [x] Add negative UI/network assertions for target approval/create, Store
      Action commands, workforce requests, checklist execution, competition
      writes, and incentives.
- [x] Update Auth Admin preview, `pilot-route-role-matrix.md`, and
      `pilot-access-matrix-v1.md` to describe company read versus no action.
- [x] Improve the authorization truth generator so approved endpoint
      expectations are assertions, not only three hard-coded drift fixtures.
- [x] Regenerate operating truth and require zero approved route/endpoint
      drift without hiding an unrelated mismatch.

Rollback: revert frontend allowlist/persona/truth changes together. DG1-A's safe
backend support may remain temporarily; hidden frontend access is not the
security boundary.

### DG1-C - Store Incentives Region Manager Route And Store-Team Closure

Purpose: implement DG1-1 across command and self-projection surfaces.

Primary files and contracts:

- `StoreSalesTargetIncentiveController` and
  `SalesTargetIncentiveApiService`;
- Store self-performance incentive API consumer/card;
- generated OpenAPI types and relevant fixtures;
- Auth Admin preview and Store route/persona tests;
- `store-incentives-contracts.spec.ts`, Store Manager/Personnel persona specs;
- both authorization/access matrices and generated operating truth.

Tasks:

- [ ] Produce a read-only consumer/usage classification for
      `GET /api/store/incentives` and `GET /api/store/me/incentives`: repository
      call graph, generated system-flow/OpenAPI clients, and a sanitized
      provider access-count window approved by the owner. Record counts and
      client classes, never identity/PII.
- [ ] If usage is unknown or an external client is active, stop backend
      removal and publish a compatibility decision packet. Frontend hiding may
      proceed, but the slice remains incomplete and the compatibility drift is
      explicitly marked temporary.
- [ ] After classification clears removal, remove Store Manager from
      `GET /api/store/incentives`.
- [ ] Preserve current Region Manager service scope checks and the global Super
      Admin emergency bypass; changing the bypass is outside this decision.
- [ ] Remove Store Personnel incentive figures from `/store/me` while keeping
      non-incentive self-performance intact.
- [ ] After the same classification clears removal, retire
      `GET /api/store/me/incentives`, its frontend call, OpenAPI entry,
      generated type, and obsolete fixture in one intentional breaking change.
- [ ] Set Auth Admin preview for `/store/incentives` to Region Manager only.
- [ ] Prove Store Manager, Store Personnel, and Report Viewer cannot read an
      incentive projection; regression-test the unchanged Super Admin bypass.
- [ ] Prove Region Manager read/review/correction/submission remains available.
- [ ] Prove direct forbidden routes make no protected incentive request.
- [ ] Regenerate OpenAPI and authorization truth; incentive drifts must close.

Rollback: prefer a forward compatibility fix. If an emergency full revert is
required, record that it temporarily restores store-team visibility, obtain the
owner's rollback approval, revert controller/UI/OpenAPI/truth artifacts
together, and immediately open the bounded corrective slice. Do not describe a
partial rollback as policy-compliant.

### DG1-D - Non-Development Admin Session Read-Only Boundary

Purpose: implement DG1-4 without removing local diagnostics.

Primary files:

- `admin-web/src/pages/SessionReadinessPage.tsx`;
- a small pure environment/display-policy helper if needed;
- session-readiness localization messages;
- `admin-web/e2e/admin-routing.spec.ts`;
- `admin-web/e2e/auth-cookie-session.spec.ts`;
- focused unit/component tests for save-session behavior.

Tasks:

- [ ] Define editing availability with compile-time `import.meta.env.DEV`, not
      a runtime flag or current session mode.
- [ ] In non-development builds, do not render mode selectors, tokens, mock
      headers, identity/scope inputs, save, or reset.
- [ ] Keep read-only mode/transport/readiness and safe scope counts.
- [ ] Keep a Verify action only if it calls the current session read directly
      and never calls `saveSession`.
- [ ] Do not render token fragments or mock/header previews outside development.
- [ ] Preserve the development editor and move any production-editor-dependent
      cookie-session proof into a unit/component test instead of deleting it.
- [ ] Add production-build DOM assertions against every editable label/control.

Rollback: revert the display policy and tests. No backend or stored session
data rollback exists.

### DG2-A - Norm Kadro Store Percentage Presentation Cleanup

Purpose: implement DG2-1 through DG2-4 by surgically reversing the demo-only
Norm Kadro turnover projection from `dcfbe2b5`.

Exact scope:

- `admin-web/src/features/workforce/api.ts`;
- `admin-web/src/pages/store-workforce-region-view.tsx`;
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`;
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.spec.ts`;
- `admin-web/e2e/store-workforce-contracts.spec.ts`;
- `admin-web/scripts/store-data-honesty-contract.test.mjs`;
- regenerated `docs/flows/store-ops-system-flow.json` and `.html` when the
  generator reports a change.

Tasks:

- [ ] Remove `turnover_rate` from the Norm Kadro headcount-gap projection and
      API mapping.
- [ ] Restore the Region Manager Norm Kadro turnover values to `null` and the
      existing controlled `Veri yok` / empty-history state.
- [ ] Ensure no numeric regional average, row percentage, detail percentage,
      progress bar percentage, or CSV percentage is produced.
- [ ] Keep the existing label/empty-state layout unless a focused layout test
      proves an empty element is unusable. Do not invent a replacement metric.
- [ ] Add a data-honesty source guard so this surface cannot silently reconnect
      to live turnover values without an explicit future decision.
- [ ] Keep prototype-only static examples inside the prototype shelf only.
- [ ] Assert the diff contains no `db/**` path and no mutation statement.
- [ ] Do not touch canonical turnover reporting files.

Required targeted commands, in order:

```powershell
npm.cmd run system-flow:generate
git diff --check
npm.cmd --prefix backend/nestjs test -- store-ops.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run test:e2e -- store-workforce-contracts.spec.ts store-workforce-norm-status.spec.ts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
npm.cmd run check:release
```

Rollback: revert the PR merge on a rollback branch and rerun the same targeted
tests. Do not run a database rollback; DG2-A has no data operation.

### DG2-B - Verify-Full Hardening For The Invariant Preflight Runner

Purpose: make the already merged PR-9 runner safe to use with the DG3 staging
TLS posture. This PR performs no live database run.

Primary files:

- `backend/nestjs/scripts/database-invariant-preflight.ts`;
- `backend/nestjs/src/shared/database/database-pool-config.ts` or a narrow
  reusable adapter around it;
- `backend/nestjs/test/database-invariant-preflight-cli.spec.ts`;
- `scripts/database-invariant-preflight-contract.test.mjs`;
- `docs/plans/database-invariant-preflight-spec-v1.md`.

Tasks:

- [ ] Remove the runner's inline SSL branch that maps only `require` and turns
      `verify-full` into `ssl:false`.
- [ ] Reuse the canonical database pool configuration so connection-string SSL
      overrides are stripped and verified CA handling is identical to runtime.
- [ ] For a staging target, require `DB_SSL_MODE=verify-full` and non-empty
      `DB_SSL_CA`; refuse `require`, `disable`, missing CA, or unknown mode.
- [ ] Keep pool max at one and all existing read-only/timeout/identity gates.
- [ ] Add tests proving verified TLS config, missing-CA refusal, `require`
      refusal, connection-string override removal, and secret-safe errors.
- [ ] Add a contract assertion that the runner contains no inline
      `rejectUnauthorized:false`.
- [ ] Update the preflight spec; do not claim staging evidence.

Rollback: revert runner/config/tests/spec together. A rollback returns the live
preflight to blocked status; it does not authorize using the older runner.

### DG2-C - Approved Read-Only Staging Invariant Evidence

Purpose: collect the real evidence DG2 requires. This is an evidence operation,
not a cleanup or migration PR.

Preconditions:

- [ ] DG2-B is merged and fresh main contains it.
- [ ] The owner confirms the exact staging host and database identity out of
      band.
- [ ] `DATABASE_URL` and `DB_SSL_CA` are injected without echoing or committing
      them.
- [ ] Target class is `staging`, acknowledgement is
      `read-only-approved`, and environment is not production.
- [ ] `DB_SSL_MODE=verify-full`.

Execution:

```powershell
npm.cmd --prefix backend/nestjs run preflight:database:invariants
```

The executor must capture only the sanitized JSON output allowed by
`database-invariant-preflight-spec-v1.md` in
`docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md`.
The evidence document must contain these sections and no raw runner dump:

1. metadata: run date, reviewed commit SHA, target class, and approver role;
2. safety proof: target identity matched (without naming it), verify-full,
   transaction read-only, timeout, and redaction status;
3. result table: check ID, count, classification, and reason;
4. samples: at most five 12-character hashes per check, exactly as emitted by
   the reviewed runner;
5. unresolved semantics: ASSIGN-01, TARGET-02, TARGET-03, and KEY-01;
6. decision: Go, Conditional Go, or No-Go per invariant family;
7. explicit statement that no mutation or repair occurred.

Record:

- every check ID and count;
- stable bounded sample hashes only, at most five per check;
- transaction read-only proof;
- provider version/extension metadata already allowed by the runner;
- classification of every non-zero count;
- candidate parent-key presence;
- an explicit `Go`, `Conditional Go`, or `No-Go` for each invariant family.

Do not invent or run additional live SQL for relation size, validation cost,
or lock planning. The reviewed PR-9 runner is the only approved query set for
DG2-C. If DB-CONSTRAINTS later needs measurements not emitted by that runner,
first create a separate reviewed read-only query/spec slice.

If the runner safely returns non-zero counts, finish recording and classifying
all emitted checks, then stop before any repair or DB-CONSTRAINTS work. A
non-zero count produces a No-Go for automatic constraints; it is not a reason
to discard the rest of the sanitized read-only result.
Even an all-zero run does not decide:

- ASSIGN-01 primary-assignment temporal overlap semantics;
- TARGET-02 allocation-count enforcement ownership;
- TARGET-03 duplicate employee enforcement ownership;
- KEY-01 acceptable validation/lock timing.

Those items remain blocked until the owner approves the presented options and
the lock strategy is measured. Do not translate “preserve real data” into an
enforcement choice.

Rollback: none; the run is read-only. If evidence contains a forbidden raw
value, do not commit it, remove the local artifact safely, and report the leak.

### DB-CONSTRAINTS - Conditional Database Integrity Constraints

Status: not authorized until DG2-C and the unresolved decisions above close.

Purpose: implement only approved invariant families from the original PR-10.

Before creating the branch, require:

- approved staging count for every included invariant;
- classification and correction plan for every non-zero result;
- owner-approved temporal/target semantics where applicable;
- exact DDL and dependency order;
- measured lock/validation strategy;
- application compatibility proof;
- disposable database forward migration and rollback rehearsal.

Implementation rules:

- add parent composite keys before dependent child constraints;
- prefer additive `NOT VALID` then `VALIDATE CONSTRAINT` when supported and
  justified by evidence;
- do not combine Norm Kadro presentation cleanup with schema changes;
- do not auto-repair existing rows;
- split DB-CONSTRAINTS by invariant family if one safe rollback cannot cover the set;
- do not add unrelated indexes, normalization, RLS, grants, or triggers.

If DG2-C evidence or business decisions are incomplete, stop after DG2-C and
mark DB-CONSTRAINTS blocked. That is correct completion of the authorized work, not a
failure.

## 12. Verification Matrix

| Slice | Minimum focused proof | Canonical proof |
| --- | --- | --- |
| DG1-A | Exhaustive read contract plus same/cross/no-company and mixed-role tests for every mapped business-data GET | `npm.cmd run check:release` |
| DG1-B | Report Viewer allowlist persona, forbidden-route/no-request tests, truth generation, frontend lint/build | `npm.cmd run check:release` |
| DG1-C | Usage classification, incentive role negatives, self-projection removal, Region Manager/Super Admin regressions, OpenAPI/auth truth | `npm.cmd run check:release` |
| DG1-D | Development and non-development display-policy tests; Admin Session Playwright; frontend lint/build | affected selector, then canonical release if selected |
| DG2-A | Exact commands listed in DG2-A | `npm.cmd run check:release` |
| DG2-B | Preflight CLI tests, database pool config tests, root script contracts, disposable smoke | `npm.cmd run check:release` |
| DG2-C | Sanitized live read-only receipt plus script contracts | docs/affected checks; no frontend release solely for evidence if selector says no |
| DB-CONSTRAINTS | Schema contract, violation fixture rejection, fresh DB migration, migration status/checksum, backend regression, disposable rollback rehearsal | full backend and root release |

### Exact Existing Test Commands

Use these existing paths. If a named file has moved, find its rename from Git;
do not invent a replacement filename or silently omit the proof.

DG1-A:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.controller.spec.ts org.controller.spec.ts reporting-store-kpi-read.service.spec.ts reporting.service.kpi-benchmark-scoring.spec.ts store-action-plan.controller.spec.ts store-action-plan.service.spec.ts workforce.service.headcount-gap.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.e2e-spec.ts auth-action-scope.e2e-spec.ts --runInBand
npm.cmd run authorization-truth:generate
```

DG1-B:

```powershell
npm.cmd --prefix admin-web run test:e2e:store-contracts
npm.cmd --prefix admin-web run test:e2e -- store-manager-persona.spec.ts store-personnel-persona.spec.ts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run authorization-truth:generate
```

DG1-C:

```powershell
npm.cmd --prefix backend/nestjs test -- sales-target-incentive.controller.spec.ts sales-target-incentive-api.service.spec.ts sales-target-incentive-read-api.e2e-spec.ts --runInBand
npm.cmd --prefix admin-web run test:e2e -- store-incentives-contracts.spec.ts store-me-contracts.spec.ts store-manager-persona.spec.ts store-personnel-persona.spec.ts
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd run authorization-truth:generate
```

DG1-D:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts auth-cookie-session.spec.ts
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

DG2-B:

```powershell
npm.cmd --prefix backend/nestjs test -- database-pool-config.spec.ts database-invariant-preflight-core.spec.ts database-invariant-preflight-cli.spec.ts --runInBand
node --test scripts/database-invariant-preflight-contract.test.mjs
npm.cmd run smoke:database:invariants
```

For every slice PR also run:

```powershell
git diff --check
npm.cmd run test:scripts
npm.cmd run check:affected-verification
```

Use the affected-verification result to select additional work. Do not skip a
named focused test merely because the selector does not discover it.

## 13. Edge Cases That Must Be Tested

- Report Viewer with one company, multiple companies, and zero companies.
- Store ID supplied for a different company.
- Employee active assignment in another company.
- Employee with no active assignment.
- Employee whose historical assignment was in scope but active assignment is
  now out of scope.
- Multi-role user containing Report Viewer plus a narrower role: broader read
  may apply only when Report Viewer is actually present; action scope stays
  unchanged.
- Super Admin with and without explicit scope retains current behavior.
- Store Manager cannot regain incentives through direct API access, preview,
  prefetch, cached navigation, or typed URL.
- Local development Session editor remains usable after production controls
  are hidden.
- Non-development DOM contains no hidden editable token/mock input.
- A hostile forward-compatibility Norm Kadro fixture may include an unknown raw
  numeric turnover field; the canonical contract omits it and the UI ignores it.
- Norm Kadro zero stores, partial headcount data, and CSV export.
- Preflight missing CA, wrong host, wrong database, `require` mode, production
  environment, non-read-only transaction, timeout, and non-zero violations.

## 14. Evidence And PR Description Template

Every PR description must contain:

```md
## Story
<one sentence>

## Locked decision implemented
<DG1-x or DG2-x identifiers>

## Scope
- changed:
- explicitly unchanged:

## Authorization/data impact
- read scope:
- action scope:
- database mutation:

## Verification
- command: result

## Rollback
<exact code revert or migration procedure>

## Remaining gate
<none, or exact unresolved external/evidence input>
```

Do not add a Codex review section or request.

## 15. Parallel Check Discipline

When a PR is open:

1. Start one background status monitor using the repository's canonical
   30-second GitHub status loop.
2. If checks are pending, create a separate worktree from the appropriate base
   and prepare only independent next-PR work.
3. If the next PR depends on the current behavior, limit preparation to
   read-only analysis or a patch plan until the predecessor merges.
4. A failing predecessor check interrupts lower-priority preparation.
5. Do not launch another full release while one full release is running.
6. Refresh complete check and mergeability state immediately before asking the
   owner to merge.

## 16. Mandatory Stop Conditions

Stop and report the exact blocker if any of these occurs:

- company scope would need to come from client input instead of the session;
- Report Viewer access requires a mutation/action widening;
- the personnel response would expose new sensitive fields;
- Store Personnel non-incentive self-performance would be removed as collateral
  damage, or the intentional own-incentive retirement is not reflected in
  OpenAPI/tests/docs;
- Auth preview, runtime route, and backend cannot be made consistent in the
  same owning slice;
- incentive endpoint consumer/usage classification is unavailable or reports
  an active external client without a compatibility decision;
- non-development Session controls remain in the DOM;
- Norm Kadro cleanup touches real turnover facts, reports, snapshots,
  reconciliation, assignments, workforce plans, or `db/**`;
- the current unfixed preflight CLI is about to be run against staging;
- TLS is not `verify-full`, CA is missing, or expected target identity is
  uncertain;
- a preflight query can mutate, transaction read-only proof fails, output leaks
  raw data, or the run cannot finish all sanitized checks;
- after all safe counts are recorded/classified, any non-zero result blocks
  repair and DB-CONSTRAINTS work;
- a constraint needs unapproved temporal or target semantics;
- validation/lock cost is claimed without measurement;
- required checks fail, the branch is behind main, mergeability is not clean,
  or the diff contains multiple stories;
- a GitHub Codex review is requested or treated as required.

## 17. Definition Of Done

DG1 implementation is done when:

- Report Viewer can use every explicit Store read-only route in Section 3.1 and
  sees only records inside its role-specific assigned companies;
- the exhaustive route-to-GET contract has no unclassified or union-scope
  Report Viewer business-data read;
- Report Viewer gains no action permission;
- Store incentives require Region Manager for ordinary users at route, preview,
  backend, matrix, generated truth, and test layers; the existing Super Admin
  emergency bypass is unchanged;
- Store Manager and Store Personnel see no incentive projection, while
  non-incentive self-performance remains available;
- both incentive endpoint removals have a completed consumer/usage
  classification or DG1-C is honestly blocked rather than declared done;
- non-development Admin Session is read-only and development diagnostics remain;
- all four DG1 slices are merged and post-merge truth is verified.

DG2 authorized implementation is done when:

- Norm Kadro shows no numeric store turnover percentages and real turnover data
  remains untouched;
- the invariant preflight runner is verify-full safe;
- one approved, sanitized, read-only staging evidence record exists;
- every invariant family has an honest Go/Conditional Go/No-Go state;
- no automatic data repair occurred.

DB-CONSTRAINTS is done only if its independent evidence gates close and its
approved constraints merge with disposable rollback proof. If those gates
remain open, the correct final state is: DG1-A through DG2-C complete,
DB-CONSTRAINTS explicitly blocked, real data preserved, and no schema claim
made.

## 18. Compact Instruction For ChatGPT 5.6 Luna Max

Use this document as the execution authority. Start with DG1-A on the branch
that carries this plan. Do not implement later slices in that diff. Preserve the
locked read/action/data boundaries, run the named verification, open no Codex
review, and use `hr-axis-pr-closeout` to monitor checks, close, and merge each
authorized PR. While checks run, prepare only independent next-PR work in a
separate worktree. After each merge, fetch origin, fast-forward local main,
verify the merge commit and post-merge state, then create the next branch from
that exact main SHA. Stop rather than guess whenever Section 16 applies.
