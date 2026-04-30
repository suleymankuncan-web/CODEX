# Project Debt Ledger

## Purpose

This document counts the current project debt without mixing completed work, blocked external dependencies, and future product investments.

Rule:

- Completed means implemented, verified, documented, and committed.
- Blocked external means the local project is ready, but a real outside environment or credential is required.
- Watchlist means do not build yet; first confirm a real operator workflow.
- Strategic investment means important future product work, not a silent debt to rush today.

## Snapshot

Date: 30 April 2026

Current count:

- Closed active debts: 84
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 8
- Silent untracked quality debt in the active gate: 0

## Closed Active Debts

These are counted as paid because they have implementation or documentation evidence and were committed.

1. Package Plan Source Visibility
2. Package Plan Pre-Approval Preview
3. Operational Feed V1
4. DM/CONFIG Boundary Note
5. Store/Region Competition Experience Polish
6. Turkish UI Localization Foundation V1
7. Local Keycloak Real-Provider And Action Evidence
8. PostgreSQL UUID DTO Validation Contract
9. Staging Auth Smoke Guard And Runbook
10. Official Release Check Gate
11. Staging Auth Evidence Operator Checklist
12. Staging Auth Evidence JSON Guard
13. Daily Closure Ranking V2 Explainability
14. Score Meaning V1
15. KPI Source Semantics V1
16. Store Score Threshold Language V1
17. KPI Interpretation Governance V1
18. KPI Config Editor Governance Preview V1
19. Ranking Completeness Segment Readiness V1
20. Shared Inbox Maturity V1
21. Store UX TR-First Copy V1
22. KPI Config Versioning V1
23. Source-Agnostic Ingest Contract Hardening V1
24. KPI Raw Row Lineage Persistence V1
25. Import Lineage Evidence Surface V1
26. Audit Event Taxonomy Guard V1
27. Data Quality Guard V1
28. Import Batch Quality Summary V1
29. Project-Wide Scope/Auth Guard Scan V1
30. No-Empty-Scope Repository Contract Pass V1
31. Production Environment Readiness Checklist V1
32. Environment Variable Inventory + Deployment Runbook Skeleton V1
33. Environment Drift Guard V1
34. Production/Staging Incident Response Skeleton V1
35. Personnel Management V1
36. Personnel Request Return/Resubmit V1
37. Excel KPI Import V1
38. Excel KPI Import Operator Runbook V1
39. Production-Ready Migration System V1
40. Production Security Gate V1-A
41. Mobile Auth/Session V1 P0
42. Mobile API/BFF Endpoint Inventory V1
43. Checklist Acknowledgement Canonical Schema Alignment V1
44. Mobile Checklist Today V1 Design
45. Mobile Checklist Today V1
46. Checklist Store Score Integration V1
47. KPI Benchmark Scoring V1
48. Target Reference Control Surface V1
49. Target Coverage V1-B Readiness Signals
50. Personnel Master Data Bootstrap Staging Foundation V1
51. Personnel Master Data Bootstrap Validation Read Model V1
52. Master Data Bootstrap Review Queue V1
53. Master Data Bootstrap Duplicate/Conflict Preflight V1
54. Master Data Bootstrap Promotion Readiness Contract V1
55. Master Data Bootstrap Store Promotion V1
56. Master Data Bootstrap Personnel Promotion V1
57. Master Data Bootstrap Admin Review Surface V1
58. User Account / Role Assignment V1
59. Ranking Included Snapshot Contract V1
60. Monthly Ranking Score Source Contract V1
61. Ranking Score Explanation Copy V1
62. Master Data Bootstrap Promotion Safety Guard V1
63. External ID Code Normalization Guard V1
64. Source-Agnostic Import Boundary V1
65. Master Data Bootstrap Admin Dry-Run Evidence V1
66. Master Data Bootstrap Pilot Smoke Runbook V1
67. Import Decision Evidence V1
68. Scope/Auth Regression Matrix V1
69. DB Health And Migration Evidence V1
70. Test Suite Hygiene V1
71. Operator Evidence Consistency Pass V1
72. Backup Restore Drill Runbook V1
73. Backup Restore Local Drill Evidence V1
74. Migration Fresh DB Smoke V1
75. Migration Smoke Release Preflight Policy V1
76. Import Batch Source Test Split V1
77. Import Batch Evidence Test Split V1
78. Competition Repository Test Split V1
79. Competition Stage Package Plan Test Split V1
80. Snapshot Run Read Model Test Split V1
81. Competition Service Team Template Test Split V1
82. Auth Action Scope Test Split V1
83. Auth User Account Pagination Count Fix V1
84. Auth Role Assignment Active Uniqueness V1

Ranking Included Snapshot Contract V1 is counted as paid because `GET /reports/leaderboards/closed` now returns `includedSnapshotRuns`, daily ranking returns the included closed snapshot, monthly ranking returns every completed daily snapshot included in the month calculation, and `/store/rankings` uses that backend contract instead of frontend inference.

Monthly Ranking Score Source Contract V1 is counted as paid because store/personnel monthly ranking source rules are documented and guarded by root script tests. It locks `includedSnapshotRuns` as the official monthly evidence source, `TARGET` and `TURKEY_AVERAGE` metric sources, `CHECKLIST_SCORE` behavior, `%120+` cap semantics, and the boundary that imported Turkey-average rows remain reconciliation evidence. Reference: `docs/plans/monthly-ranking-score-source-contract-v1.md`.

Ranking Score Explanation Copy V1 is counted as paid because `/store/rankings` and `/store/kpis` now expose the locked source rules in the user-facing surface. Personnel ranking explains total-score averaging, target/Turkey-average metric sources, checklist exclusion, and monthly evidence. Store KPI explains target, CR/ATV/UPT, checklist fallback, cap behavior, and imported summary-row reconciliation boundary without changing scoring math.

External ID Code Normalization Guard V1 is counted as paid because import/materialization external-id resolution now keeps exact mapping precedence, safely resolves normalized code variants such as `SM-140` / `SM140`, and rejects ambiguous normalized matches instead of choosing silently.

Source-Agnostic Import Boundary V1 is counted as paid because Excel is locked as the active source path, JSON remains future-only until a real sample or official field list exists, and Excel/JSON/future sources must enter through the same canonical import payload before mapping, validation, data quality, lineage, materialization, snapshotting, scoring, or reporting. Reference: `docs/plans/source-agnostic-import-boundary-v1.md`.

Master Data Bootstrap Admin Dry-Run Evidence V1 is counted as paid because `/admin/master-data/:batchId` now exposes backend promotion-readiness row evidence before any live promotion command is executed. Operators can see ready/already-promoted/blocked row state, promoted entity evidence, and block reasons while promotion commands remain explicit and unchanged. Reference: `docs/plans/master-data-bootstrap-admin-dry-run-evidence-v1.md`.

Master Data Bootstrap Pilot Smoke Runbook V1 is counted as paid because the first real baseline promotion path is now an operator-controlled smoke with stage, validate, row evidence review, promotion dry-run review, scoped pilot promotion, sanitized evidence, and Go / Conditional Go / No-Go rules. Reference: `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`.

Import Decision Evidence V1 is counted as paid because `/admin/integrations/:batchId` now summarizes existing batch detail, quality, reconciliation, retry, and mapping evidence into an operator-visible `Go`, `Conditional Go`, or `No-Go` decision without changing backend import, scoring, materialization, mapping, retry, or endpoint behavior. Reference: `docs/plans/import-decision-evidence-v1.md`.

Scope/Auth Regression Matrix V1 is counted as paid because existing read-scope, assigned-store action-scope, role/scope, feed, competition, reporting, checklist, target distribution, and workforce lifecycle regression tests are mapped into one guarded matrix. It keeps `readScope` separate from action scope, preserves DB assignment/action checks, and changes no role semantics. Reference: `docs/plans/scope-auth-regression-matrix-v1.md`.

DB Health And Migration Evidence V1 is counted as paid because migration status can now be checked through a read-only `GET /api/admin/migrations/status` surface without executing SQL migration files, failed migration evidence and checksum mismatches remain visible, public health redacts dependency URL/credential details, and CLI/CI migration execution remains `npm.cmd run db:migrate`. Reference: `docs/plans/db-health-migration-evidence-v1.md`.

Test Suite Hygiene V1 is counted as paid because the oversized auth-admin integration file was split into six domain-focused e2e specs without deleting behavior coverage, changing production code, or changing the 28 guarded test names. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Operator Evidence Consistency Pass V1 is counted as paid because existing import and master-data operator surfaces now use the same `Go / Conditional Go / No-Go`, row evidence, dry-run evidence, sanitized evidence, retry evidence, and dependency mapping language without adding backend endpoints, workflows, scoring behavior, import behavior, or promotion behavior. Reference: `docs/plans/operator-evidence-consistency-pass-v1.md`.

Backup Restore Drill Runbook V1 is counted as paid because a guarded local/staging-only PostgreSQL recovery drill now documents `pg_dump`, disposable restore target recreation, `pg_restore`, restore proof checks, sanitized evidence, and Go / Conditional Go / No-Go states without approving production automation or destructive production restore behavior. Reference: `docs/plans/backup-restore-drill-runbook-v1.md`.

Backup Restore Local Drill Evidence V1 is counted as paid because a disposable local Docker PostgreSQL source database migrated from empty state with 42 succeeded migrations, a backup file was produced, that backup restored into the separate disposable `store_ops_restore_drill` database, source and restore schema/table counts matched, migration tracking matched 42 succeeded and 0 failed rows, no production database was touched, and the 037 checklist migration idempotency issue was fixed and guarded. Reference: `docs/plans/backup-restore-drill-local-evidence-2026-04-30.md`.

Migration Fresh DB Smoke V1 is counted as paid because `npm run smoke:migration:fresh-db` now creates only the local disposable `store_ops_fresh_migration_smoke` database, runs backend migrations from empty state, verifies `audit.schema_migration` success counts and core schema table counts, refuses production/non-local targets, and is guarded by root script tests. Reference: `docs/plans/migration-fresh-db-smoke-v1.md`.

Migration Smoke Release Preflight Policy V1 is counted as paid because the release gate now explicitly keeps Docker-dependent fresh DB smoke out of mandatory `check:release`, while production readiness requires `npm.cmd run smoke:migration:fresh-db` or a written Conditional Go whenever DB schema or migration files changed. Reference: `docs/plans/release-check-gate.md`.

Import Batch Source Test Split V1 is counted as paid because integration source CRUD, lookup, audit, duplicate-source, inactive-source, and deactivate-guard tests were moved from `import-batch.e2e-spec.ts` into `integration-sources.e2e-spec.ts` without changing production code, test names, or the 32 guarded import/integration source e2e cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Import Batch Evidence Test Split V1 is counted as paid because batch detail, lineage, reconciliation, error row, mapping, audit, and retry e2e tests were moved from `import-batch.e2e-spec.ts` into `import-batch-evidence.e2e-spec.ts` without changing production code, test names, or the 32 guarded import/integration source e2e cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Competition Repository Test Split V1 is counted as paid because team template repository tests were moved from `competition.repository.spec.ts` into `competition-team-template.repository.spec.ts` without changing production code, test names, or the 27 guarded competition repository cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Competition Stage Package Plan Test Split V1 is counted as paid because stage package plan draft/review/clone/audit tests were moved from `competition.repository.spec.ts` into `competition-stage-package-plan.repository.spec.ts` without changing production code, test names, or the 27 guarded competition repository cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Snapshot Run Read Model Test Split V1 is counted as paid because snapshot run list/detail/audit/summary/overview/needs-action/lookups/dependencies/lineage tests were moved from `snapshot-run.e2e-spec.ts` into `snapshot-run-read-models.e2e-spec.ts` without changing production code, test names, or the 13 guarded snapshot run e2e cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Competition Service Team Template Test Split V1 is counted as paid because team-template list/create/update/deactivate/clone service tests were moved from `competition.service.spec.ts` into `competition-team-template.service.spec.ts` without changing production code, test names, or the 24 guarded competition service cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Auth Action Scope Test Split V1 is counted as paid because target-distribution and checklist action-scope authorization tests were moved from `auth-scope.e2e-spec.ts` into `auth-action-scope.e2e-spec.ts` without changing production code, test names, or the 18 guarded auth scope integration cases. Reference: `docs/plans/test-suite-hygiene-v1.md`.

Auth User Account Pagination Count Fix V1 is counted as paid because `/api/auth/users` count metadata now uses only filter parameters and no longer couples the count query to `LIMIT/OFFSET`. A second-page regression test guards the fix. Reference: `docs/plans/auth-admin-repository-risk-review-2026-04-30.md`.

Auth Role Assignment Active Uniqueness V1 is counted as paid because `ops.user_role_assignment` now has a nullable-scope-safe partial unique index for open-ended active user/role/scope grants. Migration 043 preflights duplicate active rows and fails with explicit evidence instead of silently deleting or deactivating anything. Schema contract, auth role assignment regression tests, backend build, fresh DB migration smoke, and root `check:release` passed. Reference: `docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md`.

Production-Ready Migration System V1 is counted as paid because SQL migrations are tracked in `audit.schema_migration`, checksum drift is rejected, failed runs are recorded with error evidence, the HTTP migration endpoint is disabled in production, and `npm.cmd run db:migrate` is the approved CLI/CI migration path.

Production Security Gate V1-A is counted as paid because CORS allowlist, production CORS fail-fast, in-memory rate limit, and standard stack-free error responses are implemented and guarded by backend security e2e tests.

Mobile Auth/Session V1 P0 is counted as paid because `ops.mobile_device_session`, session create/resume/list/revoke/logout endpoints, active mobile session guard, and auth session audit events are implemented and guarded by backend unit/e2e tests. Backend-owned refresh tokens, Mobile BFF, and push token storage remain future phases by design.

Mobile API/BFF Endpoint Inventory V1 is counted as paid because the existing mobile-relevant API surface is mapped, broad Mobile BFF creation is intentionally blocked, first aggregate candidates are named, and root script tests guard the boundary. Reference: `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`.

Personnel Master Data Bootstrap Validation Read Model V1 is counted as paid because staged store/personnel baseline rows can now be validated into `valid`, `needs_review`, or `invalid`, row issue codes and resolved references are persisted in `stg.master_data_bootstrap_row`, batch counters are refreshed in `stg.master_data_bootstrap_batch`, and HR/Admin can review batch detail without live `ops.*` promotion.

Master Data Bootstrap Review Queue V1 is counted as paid because HR/Admin can list staged bootstrap batches, derive readiness and next action, and review problematic rows through scoped read-only endpoints while promotion into live `ops.*` tables remains closed.

Master Data Bootstrap Duplicate/Conflict Preflight V1 is counted as paid because staged validation now catches normalized duplicate store codes, duplicate personnel seller codes, duplicate national id evidence, and existing employee identity conflicts before any live `ops.*` promotion path is opened.

Master Data Bootstrap Promotion Readiness Contract V1 is counted as paid because HR/Admin can now read a scoped promotion-readiness summary for staged bootstrap batches, see row-level readiness reasons, and verify idempotent already-promoted evidence before any live promotion code is opened.

Master Data Bootstrap Store Promotion V1 is counted as paid because readiness-approved store bootstrap rows can now be promoted into `ops.store` through a scoped HR/Admin command, staged rows keep `promoted_entity_id` evidence, batch counters are refreshed, already-promoted rows are skipped, and personnel promotion remains closed.

Master Data Bootstrap Personnel Promotion V1 is counted as paid because readiness-approved personnel bootstrap rows can now be promoted into `ops.employee` and one active primary `ops.employee_assignment_history` through a scoped HR/Admin command, staged rows keep employee `promoted_entity_id` evidence, batch counters are refreshed, already-promoted rows are skipped, and user account/role creation remains a future slice.

Master Data Bootstrap Promotion Safety Guard V1 is counted as paid because store/personnel promotion now classifies every staged row before live-write repository calls, allows only `ready` plus `already_promoted` evidence, and rejects stale or inconsistent `ready_to_promote` batches before any live `ops.*` mutation.

Master Data Bootstrap Admin Review Surface V1 is counted as paid because HR/Admin can now open `/admin/master-data`, list bootstrap batches, inspect readiness counters and row-level resolved/promoted evidence, run validation, and trigger the correct store/personnel promotion command without adding a second promotion decision engine or opening user account creation.

User Account / Role Assignment V1 is counted as paid because HR/Admin can link selected pilot employees to existing Keycloak/OIDC provider subjects, assign one primary role, grant exact pilot store scope, use `VISUAL_MERCHANDISER` as a bounded store-scoped role, and resolve JWT subject claims to internal app users before DB role/scope authorization. Targeted backend/frontend checks plus root `check:release` pass.

Checklist Acknowledgement Canonical Schema Alignment V1 is counted as paid because the existing `ops.checklist_acknowledgement` migration and backend repository usage are now represented in canonical `db/schema.sql`, and a backend schema contract test guards against drift.

Mobile Checklist Today V1 Design is counted as paid because HR template ownership, region-manager scoring, store-manager acknowledgement, multiple monthly visits, weighted scoring, completed-lock behavior, and future cancel-with-reason boundary are documented and guarded by root script tests. Reference: `docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md`.

Mobile Checklist Today V1 is counted as paid because HR template versioning, weight publish guard, region-manager assigned-store visit scoring, completed-lock behavior, store-manager acknowledgement, multi-visit monthly averaging, frontend pilot routes, targeted backend/frontend checks, and root `check:release` are implemented and verified. Reference: `docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md`.

Checklist Store Score Integration V1 is counted as paid because completed BM checklist visits now feed monthly store score at `%5`, missing BM checklist is represented as `not_included` instead of a penalty, VM checklist remains future inactive, backend exposes a scoped score breakdown endpoint, store KPI highlights explain the breakdown, and targeted backend/frontend checks plus root `check:release` pass. Reference: `docs/superpowers/plans/2026-04-29-checklist-store-score-integration-v1.md`.

KPI Benchmark Scoring V1 is counted as paid because store/personnel KPI metrics now score against target or same-period Turkey-average references, preserve actual ratios, cap score contribution at `%120`, expose capped and missing-reference explanations in API/UI, and employee performance snapshots use the same scoring engine. Targeted backend/frontend checks plus root `check:release` pass. Reference: `docs/superpowers/plans/2026-04-29-kpi-benchmark-scoring-v1.md`.

Target Reference Control Surface V1 is counted as paid because approved personnel target references now have a canonical table, target allocations require real `employeeId`, region approval promotes allocations into approved target references, live reporting and employee snapshots read/anchor those references, missing targets stay explicit instead of guessed, and `/admin/targets` exposes target coverage readiness. Targeted backend/frontend checks plus root `check:release` pass. Reference: `docs/superpowers/plans/2026-04-29-target-reference-control-surface-v1.md`.

Target Coverage V1-B Readiness Signals is counted as paid because target coverage now separates `approved`, `pending_region_approval`, `pending_change_conflict`, `stale_reference`, and `missing` states without changing scoring. Admin `/admin/targets` exposes those operator signals, while live/snapshot scoring continues to read only approved target references. Targeted backend/frontend checks plus root `check:release` pass.

Personnel Master Data Bootstrap Staging Foundation V1 is counted as paid because store/personnel bootstrap batches now have dedicated staging tables, row-level raw/normalized payload evidence, review status, row hashes, and an HR/Admin staging endpoint. This closes the dangerous direct Excel-to-live-table path for the first master-data step; validation/read model and promotion remain planned next slices. Targeted backend checks plus root `check:release` pass.

## Superseded Before Overbuilding

1. Competition Format Registry V1

Decision:

- Do not build a second ranking/scoring engine for simple UPT/ATV challenges in V1.
- Use Operational Feed challenge posts to announce the challenge.
- Let existing profile/ranking/summary surfaces show the performance truth.

This is a good deletion, not lost work.

## Blocked External Dependency

### Real IdP Staging Evidence

Status: `blocked_external`

Why it is not counted as completed:

- Real staging IdP registration values are not available in the repo.
- Real staging smoke credentials are not available in the repo.
- Seeded staging assigned/unassigned store IDs are not confirmed in a real staging DB.

What is already ready:

- `npm.cmd run smoke:auth:staging`
- `npm.cmd run smoke:auth:staging:action`
- `npm.cmd run guard:auth:evidence`
- operator checklist
- evidence template
- JSON guard against raw token/code/verifier/secret leakage

Completion command when external inputs exist:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

Exit criteria:

- PKCE login/logout passes against real staging IdP.
- `/api/auth/session` returns expected role, read scope, and action scope.
- assigned-store action returns success.
- unassigned-store action returns `403`.
- guarded evidence passes and is stored sanitized.

### Real JSON Source Ingest Evidence

Status: `blocked_external`

Why it is not counted as completed:

- Real JSON delivery method is unknown.
- Real payload fields are unknown.
- Source cadence is unknown.
- Source authentication model is unknown.
- Store/personnel identity fields are unknown.
- Return/refund and latest-state/additive-event behavior are unknown.

What is already ready locally:

- `stg.integration_source`
- `stg.import_batch`
- `stg.kpi_raw`
- `stg.external_id_map`
- import scheduler, normalization, and materialization services
- source-agnostic ingest planning
- source-agnostic import boundary guard
- canonical KPI contract metadata on the payload template endpoint
- deterministic KPI import `rowHash` and readable `rawRowReference`
- first-class `stg.kpi_raw.row_hash` and `stg.kpi_raw.raw_row_reference` staging columns
- backend-owned import data quality issue catalog
- additive import error `qualityIssueCode`
- batch-level import data quality summary on import detail

Required external inputs:

- delivery type: pull API, push endpoint, file upload, SFTP, scheduled export, manual import, or intermediary service
- one sanitized sample payload or official field list
- authentication and access model
- cadence and late-correction behavior
- store identity key
- personnel/seller identity key
- business date and timezone rule
- return/refund behavior

Exit criteria:

- sample payload maps into the canonical raw KPI contract
- idempotency key is defined
- source-specific adapter can be implemented without guessing
- imported metrics and platform-derived metrics are separated

## Resolved Watchlist Decisions

### Global Audit Feed Consideration

Status: `resolved_guarded`

Decision:

- Do not build a global audit feed until an operator workflow proves it is needed.
- Existing feature-level audit trails are enough for current delivery.
- Audit Event Taxonomy Guard V1 now keeps emitted backend audit event types cataloged.
- Future global feed work must start from the catalog instead of reverse-engineering scattered strings.

Trigger to promote:

- HR/Admin needs one cross-module chronological event stream for real support, approval review, or incident investigation.

## Strategic Investment Backlog

These are important future product investments. They are not counted as hidden debt today because the current system is still deliberately growing from controlled foundations.

1. Eventual real source adapter after real source evidence
2. Full production UI/design-system pass and complete EN/TR localization expansion
3. Master-data validation/promotion test split after a separate explicit plan
4. StageBuilderForm competition admin UI split after a concrete competition UI change
5. IntegrationRepository boundary split and raw import index review after real import volume or source-adapter evidence
6. Remaining StoreOpsRepository legacy checklist/read boundary review after a concrete checklist, workforce reporting, or org-scope change
7. ReportingRepository closed-ranking/performance/snapshot-report split and reporting query/index review after a concrete reporting/ranking change or measured pilot slow-query evidence
8. AuthAdminRepository boundary split and searchable auth-admin lookups before broad user rollout

KPI config version history, publish metadata, snapshot anchoring, and pre-governance visibility are implemented in V1. Rollback UI, future effective scheduling, approval workflow, and DB-managed interpretation copy remain future depth, not active hidden debt.

Source-agnostic KPI ingest contract hardening is implemented in V1, Source-Agnostic Import Boundary V1 keeps Excel/JSON/future sources behind one canonical import payload, KPI raw row lineage is persisted as first-class staging columns, and admin import detail now surfaces KPI lineage evidence. Real source adapter work remains blocked until external source evidence exists.

Audit event taxonomy guard is implemented in V1. A global audit feed remains intentionally unbuilt until a real operator workflow requires it, but the backend now has a catalog and contract test that prevents new audit event strings from drifting silently.

Data Quality Guard V1 is implemented. Import error rows now expose stable `qualityIssueCode` values while keeping the existing `errorCategory` contract intact. Real source adapter work still waits for external source evidence.

Import Batch Quality Summary V1 is implemented. Batch detail now summarizes failed rows by stable quality issue code, and the admin import detail surface shows the dominant cleanup categories without creating a new workflow or dashboard too early.

Master-data validation/promotion test split is a planned investment, not active debt. Staging/normalization and read-model/readiness tests are already split and guarded; validation and promotion safety still protect live master-data write behavior in one focused file. Future work must start with a separate explicit plan and a stronger validation/promotion test-name guard before moving those tests. Reference: `docs/plans/project-risk-scan-2026-04-30.md`.

StageBuilderForm competition admin UI split is a planned investment, not active debt. The current file is large because it owns several tested competition admin workflows; it should not be refactored only for line count. Future work should split template and package-plan sections only when a concrete competition UI change touches them. Reference: `docs/plans/stage-builder-form-risk-review-2026-04-30.md`.

IntegrationRepository boundary split and raw import index review is a planned investment, not active debt. The repository owns source governance, raw staging writes, import evidence, retry/action queues, store import scope, and audit evidence. Future work should split it only when a concrete integration change touches one of those boundaries, and raw table indexes should wait for real row volume or measured local staging evidence. Reference: `docs/plans/integration-repository-risk-review-2026-04-30.md`.

StoreOpsRepository workforce request boundary split is implemented. Seller-code and offboarding request lifecycles now live in `WorkforceRequestRepository`; `StoreOpsRepository` keeps store scope listing, target personnel reads, headcount gap, and legacy checklist writes. Remaining future work should focus only on concrete checklist, workforce reporting, org-scope, or measured queue-performance evidence. Region queue indexes still wait for measured pilot volume. Reference: `docs/plans/store-ops-repository-risk-review-2026-04-30.md`.

ReportingRepository split and reporting query/index review is a planned investment, not active debt. The repository owns snapshot report read models, live KPI performance reads, Turkey benchmark aggregations, store score breakdown inputs, closed rankings, leaderboards, and identity-to-employee lookup helpers. Future work should split only when a concrete reporting/ranking change touches a clean read family or measured pilot data proves a slow query. Reference: `docs/plans/reporting-repository-risk-review-2026-04-30.md`.

AuthAdminRepository boundary split and searchable auth-admin lookups are planned investments, not active hidden debt today. The current pilot path is guarded, and active role assignment uniqueness is now protected at the database level. Broader user rollout should still avoid dropdown-only lookup limits and should split auth-admin persistence only when a concrete auth-admin change touches a clean family of operations. References: `docs/plans/auth-admin-repository-risk-review-2026-04-30.md`, `docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md`.

Project-Wide Scope/Auth Guard Scan V1 is implemented. The scan found and closed two concrete backend risks: production JWT default-secret fallback is now rejected unless JWKS is configured, and empty/foreign actor scope paths in store listing and target-distribution request listing are now guarded by no-access and narrowest-scope contract tests.

No-Empty-Scope Repository Contract Pass V1 is implemented. Reporting, checklist acknowledgement, competition read, and visible feed repository surfaces now fail closed when actor read scope has no company, region, or store IDs. Empty scope returns no data without querying, and tests lock the behavior.

Production Environment Readiness Checklist V1 is implemented. Environment values, secrets, real IdP registration, database migration order, audit retention, backup assumptions, smoke evidence, and JSON source readiness now have one guarded operator checklist. Root script tests keep the checklist from quietly losing required sections or no-secret evidence rules.

Environment Variable Inventory + Deployment Runbook Skeleton V1 is implemented. Backend runtime, frontend build-time, and auth smoke variables are documented; deployment order now covers preflight, release gate, migration, backend deploy, frontend deploy, smoke evidence, rollback, and sign-off. Root script tests guard the critical sections and env example alignment.

Environment Drift Guard V1 is implemented. Root script tests now extract backend env usage from `AppConfigService`, frontend env usage from `import.meta.env`, and auth smoke env usage from `AUTH_SMOKE_*` code paths, then compare the result with committed examples and the env inventory.

Production/Staging Incident Response Skeleton V1 is implemented. Auth, import/data quality, and deploy/release failures now have a guarded operator skeleton covering severity, ownership, triage, sanitized evidence, rollback/forward-fix/No-Go decisions, JSON source holding rules, incident notes, and post-incident review.

Personnel Management V1 is implemented. Store managers can submit seller-code/new-personnel requests and offboarding requests from assigned stores, while HR/Admin remains the official approval point. Seller-code approval creates employee and active assignment records. Offboarding approval terminates the employee, closes the active assignment, and writes turnover event evidence. The canonical plan is `docs/plans/personnel-management-v1.md`.

Personnel Request Return/Resubmit V1 is implemented. HR/Admin can return seller-code and offboarding requests with a required note, store managers can edit the returned request on `/store/approvals`, and resubmission keeps the same request id while moving the row back to `pending_hr_approval`. Return/resubmit does not mutate employee, assignment, or turnover records; audit events record rejected and resubmitted transitions.

Personnel Master Data Bootstrap V1 is being closed in guarded slices instead of as one risky mega-feature. Staging, validation, review queue, duplicate/conflict preflight, promotion readiness, store promotion, personnel promotion, and admin review visibility are now counted above. User account creation and auth role assignment remain future slices. Reference: `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`.

Master Data Bootstrap Admin Dry-Run Evidence V1 is implemented. The admin review surface now shows backend promotion-readiness row evidence before live promotion, which makes the already-existing backend dry-run useful to operators without changing the promotion command or opening a new automation path.

Master Data Bootstrap Pilot Smoke Runbook V1 is implemented. The first true baseline promotion now has a guarded operator sequence: stage the scoped baseline, validate, inspect row evidence, inspect dry-run evidence, promote only the approved pilot batch, and capture sanitized evidence.

Backend Foundation Hardening Plan V1 is a planning/control artifact and is not counted as a closed active debt item. It records the no-new-module hardening order for existing backend, data, auth, import, and operator evidence surfaces. Reference: `docs/plans/backend-foundation-hardening-plan-v1.md`.

Project MVP Focus Map is recorded as a consolidation decision, not a new closed debt item. The decision is to keep the project, avoid restarting, narrow near-term work to MVP readiness, and prioritize Excel KPI Import V1 as the next local real-data proof. Reference: `docs/plans/project-mvp-focus-map-2026-04-28.md`.

Excel KPI Import V1 is implemented and verified. Personnel KPI uses positive gross sales only, store KPI uses scoped store net sales, `FF` is a first-class base metric, period `ATV`, `UPT`, and `CR` are recomputed from summed base metrics, negative personnel rows stay as reconciliation evidence, and duplicate-safe re-upload uses deterministic source batch ids. References: `docs/plans/excel-kpi-import-v1.md`, `docs/superpowers/plans/2026-04-28-excel-kpi-import-v1.md`.

Excel KPI Import Operator Runbook V1 is implemented and guarded. The runbook turns Excel uploads into a repeatable operator process: environment preflight, file preflight, store scope review, upload, summary review, identity mapping, reconciliation, retry/re-upload, materialization decision, sanitized evidence, and Go / Conditional Go / No-Go. Reference: `docs/plans/excel-kpi-import-operator-runbook.md`.

UI status note:

- A production UI/design-system strategy note now exists.
- Broad UI redesign is intentionally deferred.
- Future UI changes should be small reversible pilots until the backend/data foundation is stronger.

## Repo Hygiene Note

Current repo hygiene is not counted as active debt in this ledger because:

- `.gitignore` exists.
- generated `node_modules` and `dist` directories are ignored, not tracked.
- module and root release gates pass.
- the 27 April 2026 project-wide scan found no tracked `.env`, no critical committed secret, and no unsafe frontend DOM sink pattern.
- the 27 April 2026 no-empty-scope pass hardened remaining actor-scoped store/region/company list surfaces found in store-ops repositories.
- the 27 April 2026 production readiness checklist added a guarded operator gate for environment, secret, migration, evidence, backup, audit, and JSON source readiness.
- the 27 April 2026 env/deployment runbook pass aligned committed env examples with production-relevant variables and PKCE response type.
- the 27 April 2026 environment drift guard made env inventory/example alignment dynamic instead of relying only on a static checklist.
- the 27 April 2026 incident response skeleton linked auth/import/deploy failures to severity, evidence, rollback, and No-Go decisions before real staging pressure exists.
- the 28 April 2026 Excel KPI Import V1 implementation added gross-personnel/net-store import behavior, scoped store import gating, reconciliation evidence, and duplicate-safe upload identity.
- the 28 April 2026 Excel KPI Import Operator Runbook V1 made the real Excel import process repeatable and guarded by root script tests before pilot use.
- the 28 April 2026 Production Security Gate V1-A added CORS allowlist, production CORS fail-fast, in-memory rate limit, and standard stack-free error responses.
- the 28 April 2026 Mobile Auth/Session V1 P0 added backend-owned mobile device sessions without taking refresh-token ownership from the IdP.
- the 28 April 2026 Mobile API/BFF Endpoint Inventory V1 documented endpoint reuse and stopped a broad mobile BFF from opening before a real screen contract exists.
- the 28 April 2026 Checklist Acknowledgement Canonical Schema Alignment V1 aligned the existing checklist acknowledgement migration/code path with canonical schema before mobile checklist expansion.
- the 28 April 2026 Mobile Checklist Today V1 Design locked HR template versioning, region-manager visit scoring, store-manager acknowledgement, multi-visit monthly averaging, and completed-lock behavior before implementation.
- the 28 April 2026 Mobile Checklist Today V1 implementation added HR-owned versioned templates, region-manager visit scoring, store-manager acknowledgement, completed-lock behavior, monthly multi-visit averaging, and frontend pilot surfaces behind targeted and root release gates.
- the 29 April 2026 Target Reference Control Surface V1 implementation made approved personnel target references queryable, anchored them into live/snapshot scoring, and added an admin coverage panel behind targeted and root release gates.
- the 29 April 2026 Target Coverage V1-B implementation split missing target coverage into approved, pending, conflict, stale, and missing operator signals without changing scoring semantics.
- the 29 April 2026 Personnel Master Data Bootstrap Staging Foundation V1 implementation created dedicated bootstrap staging tables and an HR/Admin batch staging endpoint before any live store/personnel promotion.
- the 29 April 2026 Personnel Master Data Bootstrap Validation Read Model V1 implementation added staged row validation, issue codes, resolved reference evidence, batch counters, and a review endpoint while keeping live promotion closed.
- the 29 April 2026 Master Data Bootstrap Review Queue V1 implementation added scoped batch and row review endpoints so staged baseline data can be inspected without live promotion.
- the 29 April 2026 Master Data Bootstrap Duplicate/Conflict Preflight V1 implementation added duplicate and identity conflict guards before any live promotion path is opened.
- the 29 April 2026 Master Data Bootstrap Promotion Readiness Contract V1 implementation added a scoped read-only readiness endpoint that explains which staged rows can be promoted later and which rows block promotion.
- the 29 April 2026 Master Data Bootstrap Store Promotion V1 implementation opened only the reviewed store promotion path, upserts stores with staged evidence, and kept personnel promotion closed for a later guarded slice.
- the 29 April 2026 Master Data Bootstrap Personnel Promotion V1 implementation opened only the reviewed personnel promotion path, upserts employee identity plus one active primary assignment, and keeps user account/role creation outside V1.
- the 29 April 2026 Master Data Bootstrap Admin Review Surface V1 implementation exposed bootstrap batch readiness, row evidence, promoted entity ids, and guarded validate/promote actions in `/admin/master-data` behind frontend and root release gates.

Still monitor:

- avoid committing local `.env` files
- avoid committing generated `dist` output
- keep `current-state.md` as handoff state, not a permanent product spec

## CODEX Honest View

The project is not debt-free in the sense that there is nothing left to build. It is debt-controlled.

The dangerous kind of debt would be:

- hidden auth assumptions
- unguarded release process
- improvised incident handling under staging/production pressure
- second scoring engine
- unclear feed vs competition ownership
- raw auth evidence handling
- store-facing mixed-language trust gaps
- source row lineage hidden only inside JSON payloads
- persisted source row lineage hidden from admin import detail
- stack traces or inconsistent error payloads leaking to clients
- production CORS origin assumptions staying implicit
- uncataloged audit event strings blocking a future coherent audit stream
- generic import errors without stable data quality codes
- row-level quality codes without a batch-level operator summary
- production auth fallback accepting default secrets
- empty actor scope widening into full-data list access

Those have been actively reduced. The remaining work is mostly planned product depth, real external staging proof, real source ingest evidence/adapter work, and a future coordinated visual/localization investment. That is a healthy place to be.

## Next Logical Step

If staging provider and seeded DB values are available, run the guarded staging action smoke.

If they are not available, check whether real JSON source ingest details are available. If JSON source delivery details or a sample payload are unavailable, do not write a source-specific connector yet.

The next local backend candidate should be chosen through the intake gate. Source-agnostic KPI ingest contract hardening, KPI raw row lineage persistence, admin lineage evidence visibility, audit event taxonomy guard, data quality guard, import batch quality summary, the first project-wide scope/auth guard scan, the no-empty-scope repository contract pass, production environment readiness checklist, env/deployment runbook skeleton, environment drift guard, and production/staging incident response skeleton are now done, so do not repeat them as busywork; pick a nearby backend/data surface only if it strengthens existing behavior without guessing external source details.

Recommended local candidate if external evidence is still unavailable:

- If a true store/personnel baseline list with store codes and seller codes is available, start Personnel Master Data Bootstrap V1 through the intake gate.
- If no baseline/source evidence exists, keep source-specific adapter work closed and choose the next small guard only through the intake gate.
