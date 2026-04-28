# Project Debt Ledger

## Purpose

This document counts the current project debt without mixing completed work, blocked external dependencies, and future product investments.

Rule:

- Completed means implemented, verified, documented, and committed.
- Blocked external means the local project is ready, but a real outside environment or credential is required.
- Watchlist means do not build yet; first confirm a real operator workflow.
- Strategic investment means important future product work, not a silent debt to rush today.

## Snapshot

Date: 28 April 2026

Current count:

- Closed active debts: 43
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
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

Production-Ready Migration System V1 is counted as paid because SQL migrations are tracked in `audit.schema_migration`, checksum drift is rejected, failed runs are recorded with error evidence, the HTTP migration endpoint is disabled in production, and `npm.cmd run db:migrate` is the approved CLI/CI migration path.

Production Security Gate V1-A is counted as paid because CORS allowlist, production CORS fail-fast, in-memory rate limit, and standard stack-free error responses are implemented and guarded by backend security e2e tests.

Mobile Auth/Session V1 P0 is counted as paid because `ops.mobile_device_session`, session create/resume/list/revoke/logout endpoints, active mobile session guard, and auth session audit events are implemented and guarded by backend unit/e2e tests. Backend-owned refresh tokens, Mobile BFF, and push token storage remain future phases by design.

Mobile API/BFF Endpoint Inventory V1 is counted as paid because the existing mobile-relevant API surface is mapped, broad Mobile BFF creation is intentionally blocked, first aggregate candidates are named, and root script tests guard the boundary. Reference: `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`.

Checklist Acknowledgement Canonical Schema Alignment V1 is counted as paid because the existing `ops.checklist_acknowledgement` migration and backend repository usage are now represented in canonical `db/schema.sql`, and a backend schema contract test guards against drift.

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

KPI config version history, publish metadata, snapshot anchoring, and pre-governance visibility are implemented in V1. Rollback UI, future effective scheduling, approval workflow, and DB-managed interpretation copy remain future depth, not active hidden debt.

Source-agnostic KPI ingest contract hardening is implemented in V1, KPI raw row lineage is persisted as first-class staging columns, and admin import detail now surfaces KPI lineage evidence. Real source adapter work remains blocked until external source evidence exists.

Audit event taxonomy guard is implemented in V1. A global audit feed remains intentionally unbuilt until a real operator workflow requires it, but the backend now has a catalog and contract test that prevents new audit event strings from drifting silently.

Data Quality Guard V1 is implemented. Import error rows now expose stable `qualityIssueCode` values while keeping the existing `errorCategory` contract intact. Real source adapter work still waits for external source evidence.

Import Batch Quality Summary V1 is implemented. Batch detail now summarizes failed rows by stable quality issue code, and the admin import detail surface shows the dominant cleanup categories without creating a new workflow or dashboard too early.

Project-Wide Scope/Auth Guard Scan V1 is implemented. The scan found and closed two concrete backend risks: production JWT default-secret fallback is now rejected unless JWKS is configured, and empty/foreign actor scope paths in store listing and target-distribution request listing are now guarded by no-access and narrowest-scope contract tests.

No-Empty-Scope Repository Contract Pass V1 is implemented. Reporting, checklist acknowledgement, competition read, and visible feed repository surfaces now fail closed when actor read scope has no company, region, or store IDs. Empty scope returns no data without querying, and tests lock the behavior.

Production Environment Readiness Checklist V1 is implemented. Environment values, secrets, real IdP registration, database migration order, audit retention, backup assumptions, smoke evidence, and JSON source readiness now have one guarded operator checklist. Root script tests keep the checklist from quietly losing required sections or no-secret evidence rules.

Environment Variable Inventory + Deployment Runbook Skeleton V1 is implemented. Backend runtime, frontend build-time, and auth smoke variables are documented; deployment order now covers preflight, release gate, migration, backend deploy, frontend deploy, smoke evidence, rollback, and sign-off. Root script tests guard the critical sections and env example alignment.

Environment Drift Guard V1 is implemented. Root script tests now extract backend env usage from `AppConfigService`, frontend env usage from `import.meta.env`, and auth smoke env usage from `AUTH_SMOKE_*` code paths, then compare the result with committed examples and the env inventory.

Production/Staging Incident Response Skeleton V1 is implemented. Auth, import/data quality, and deploy/release failures now have a guarded operator skeleton covering severity, ownership, triage, sanitized evidence, rollback/forward-fix/No-Go decisions, JSON source holding rules, incident notes, and post-incident review.

Personnel Management V1 is implemented. Store managers can submit seller-code/new-personnel requests and offboarding requests from assigned stores, while HR/Admin remains the official approval point. Seller-code approval creates employee and active assignment records. Offboarding approval terminates the employee, closes the active assignment, and writes turnover event evidence. The canonical plan is `docs/plans/personnel-management-v1.md`.

Personnel Request Return/Resubmit V1 is implemented. HR/Admin can return seller-code and offboarding requests with a required note, store managers can edit the returned request on `/store/approvals`, and resubmission keeps the same request id while moving the row back to `pending_hr_approval`. Return/resubmit does not mutate employee, assignment, or turnover records; audit events record rejected and resubmitted transitions.

Personnel Master Data Bootstrap V1 is now planned, but not counted as a closed active debt until implementation and verification exist. The decision is to baseline stores first, then personnel, using staging/review/promote and not direct Excel-to-live-table mutation. Reference: `docs/plans/personnel-master-data-bootstrap-v1.md`.

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

- Choose the first mobile pilot read surface. If dashboard/home comes first, plan Mobile Home Summary V1 around a small payload. If daily operation comes first, interview and plan Mobile Checklist Today V1 before coding.
