# StoreOpsRepository Risk Review - 30 April 2026

## Purpose

Review `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts` as a backend maintainability, scope, and scale risk without changing production code.

This is not a refactor plan and not a new workforce/checklist feature plan.

No application behavior was changed by this review.

## Current Shape

Observed file:

- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts` - 2008 physical source lines

The file currently owns several operational persistence responsibilities:

- seller-code request lifecycle: latest FM reference, create, list, read, duplicate check, approve, reject, resubmit
- seller-code approval side effects: create employee and active assignment
- offboarding request lifecycle: active employee lookup, create, list, read, approve, reject, resubmit
- offboarding approval side effects: terminate employee, close active assignment, write turnover event
- store list by actor scope and requested filters
- store personnel targeting rows for target distribution
- store headcount gap read model
- legacy checklist instance create, response upsert, and complete writes
- audit events for workforce and checklist transitions

This repository is large because it still contains several older operational flows that predate the more focused repositories now present in the module.

## Green Signals

- The module already has focused repositories for newer or heavier domains:
  - `ChecklistRepository`
  - `ChecklistAcknowledgementRepository`
  - `TargetDistributionRepository`
  - `ReportingRepository`
  - `CompetitionRepository`
  - `FeedRepository`
  - `KpiConfigRepository`
- Seller-code flow has 7 e2e tests in `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts`.
- Offboarding flow has 5 e2e tests in `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts`.
- Legacy checklist flow has 5 e2e tests in `backend/nestjs/test/integration/checklist-flow.e2e-spec.ts`.
- Scope/action-scope behavior is covered by `auth-scope.e2e-spec.ts` and `auth-action-scope.e2e-spec.ts`.
- `StoreOpsRepository` has a focused unit contract that keeps empty scope fail-closed behavior for `listStoresByScope`.
- Seller-code request rows store `national_id_hash` and `national_id_last4`, not raw national ID.
- Approval flows use database transactions for multi-table writes.
- Existing schema has useful indexes for store/company request queues, employee assignment dates, checklist instance lookup, and offboarding pending employee uniqueness.
- No `TODO`, `FIXME`, `HACK`, `XXX`, `console.log`, `debugger`, `test.only`, or broad `SELECT *` marker was found in this file.

## Risks

### P1 - Repository Ownership Density

One repository owns personnel request lifecycle, workforce read helpers, store scope listing, target distribution support reads, headcount gap reads, and legacy checklist writes.

Risk:

- future personnel work, checklist work, and org/scope work may continue landing in the same file,
- review diff context can become broad and easier to misread,
- a future checklist change could accidentally touch workforce approval behavior.

This is a maintenance risk, not an active production bug.

### P1 - Personnel Approval Side Effects Have High Blast Radius

Seller-code approval writes:

- `ops.employee`
- `ops.employee_assignment_history`
- `ops.seller_code_request`
- `audit.event_log`

Offboarding approval writes:

- `ops.employee`
- `ops.employee_assignment_history`
- `ops.turnover_event`
- `ops.employee_offboarding_request`
- `audit.event_log`

Risk:

- future changes here can affect master data, assignment history, turnover reporting, and audit evidence at the same time,
- these flows deserve especially small implementation slices and targeted tests.

Decision:

- do not modify these workflows inside unrelated cleanup,
- any future split should keep SQL behavior identical first.

### P1 - Audit Actor FK Inconsistency

Workforce request audit events currently set `audit.event_log.actor_user_id` to `NULL` and keep the actor in `metadata_json.actorUserId`.

Legacy checklist events write `actor_user_id` directly.

Risk:

- a future global audit feed or support workflow may need to join actor details more consistently,
- actor evidence is present, but not always in the same first-class column.

Decision:

- do not change this inside a repository review,
- future improvement should be a small audit-helper pass that resolves known `ops.user_account.user_id` values safely and keeps metadata evidence.

### P1 - Region Queue Scale Needs Measurement

Request list queries support store, region, and company scopes. Current schema has request queue indexes for store/status and company/status, but no dedicated region/status index for seller-code or offboarding queues.

Risk:

- region-manager or HR queue pages may become slower if real request volume grows by region,
- adding indexes now without volume evidence could add unnecessary write cost.

Decision:

- no index now,
- measure region-scoped queue queries after real pilot usage or realistic staging volume.

### P2 - Legacy Checklist Writes Still Live Outside ChecklistRepository

Newer checklist template, mobile checklist, and acknowledgement logic already uses focused checklist repositories. The older create/add-response/complete checklist instance methods still live in `StoreOpsRepository`.

Risk:

- checklist behavior is split across old and new repository boundaries,
- a future checklist workflow change could update one boundary and forget the other.

Decision:

- do not move this now,
- when checklist workflow changes again, move legacy checklist instance writes into `ChecklistRepository` as a separate mechanical slice.

### P2 - Fixed Queue Limit Without Pagination

Seller-code and offboarding list methods return the latest 50 rows without offset/cursor support.

Risk:

- acceptable for pilot and small HR queues,
- limiting if historical review or high-volume regional queues become real workflows.

Decision:

- not active debt today,
- add pagination only when the UI/operator workflow actually needs it.

### P2 - FM Seller-Code Lookup Is Scan-Oriented

`getLatestFranchiseSellerCode` scans employee refs and approved request refs using regex and numeric suffix sorting.

Risk:

- fine for pilot scale,
- can become slower if employee history grows significantly.

Decision:

- no speculative index now,
- revisit when real employee count and seller-code operation latency are measured.

### P2 - Repeated Audit Insert Pattern

The file repeats similar `audit.event_log` insert blocks across request transitions.

Risk:

- new audit metadata fields may drift between transitions,
- correlation/actor evidence can be forgotten in future additions.

Decision:

- not worth changing alone,
- if a workforce repository split happens, include a local private audit helper in that new boundary.

## No-Go Decisions

- Do not split `StoreOpsRepository` only because it is large.
- Do not add request queue indexes without measured region/company/store query evidence.
- Do not mix personnel lifecycle cleanup with checklist migration work.
- Do not change seller-code or offboarding approval semantics inside a mechanical repository split.
- Do not move checklist V1 legacy methods without targeted checklist flow tests.
- Do not open new workforce/account provisioning behavior while master-data baseline evidence is still being prepared.

## Recommended Future Split Order

If a future workforce or store-ops change touches this repository, use this order:

1. Extract `WorkforceRequestRepository` for seller-code and offboarding request lifecycle, keeping SQL and return shapes identical.
2. Move legacy checklist instance write methods into `ChecklistRepository` if checklist workflow changes again.
3. Extract an org/store-scope read repository only if store listing grows beyond the current simple scope surface.
4. Move headcount gap and personnel targeting reads only if workforce reporting or target distribution changes require it.
5. Add a local audit helper inside the moved boundary only after the first mechanical split is stable.

## Recommended Performance Review Trigger

Open a measured performance/index review only when one of these is true:

- real pilot request queues contain enough seller-code/offboarding rows to exercise region and company filters,
- region managers or HR report slow queue pages,
- master-data baseline has realistic employee and assignment volume,
- checklist instance history grows enough to affect mobile today or monthly checklist reads.

Candidate measurements:

- `ops.seller_code_request(region_id, request_status, created_at DESC)`
- `ops.employee_offboarding_request(region_id, request_status, created_at DESC)`
- `UPPER(ops.employee.external_employee_ref)` or a normalized seller-code column
- active assignment lookups by store and employee

No index should be added without before/after query evidence.

## Decision

Status: `planned_investment`

`StoreOpsRepository` is a real pressure point, but not an urgent refactor target.

The correct near-term rule is: do not keep adding unrelated personnel, checklist, and org behavior here without a boundary decision. The first actual split should happen only when a concrete workforce/personnel or checklist change touches one of the named boundaries.

## CODEX DURUST YORUM

This file is not a mess; it is an older operational hub that now deserves boundaries because the project has grown up around it.

The good news: the dangerous personnel workflows are not untested. Seller-code, offboarding, checklist, and scope behavior already have meaningful e2e coverage.

The honest risk: personnel approval flows mutate important master-data tables. That means future changes here should be slower, smaller, and more heavily verified than normal CRUD work.

My recommendation: no refactor today. Treat the first workforce repository split as a planned investment, not as panic cleanup.

## Recommended Next Move

Do not refactor this repository now.

If no external source/master-data evidence is available, the next local review candidate is `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`, because it is broad, read-heavy, and will matter when KPI/ranking/checklist reports receive real pilot volume.
