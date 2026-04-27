# Project Debt Ledger

## Purpose

This document counts the current project debt without mixing completed work, blocked external dependencies, and future product investments.

Rule:

- Completed means implemented, verified, documented, and committed.
- Blocked external means the local project is ready, but a real outside environment or credential is required.
- Watchlist means do not build yet; first confirm a real operator workflow.
- Strategic investment means important future product work, not a silent debt to rush today.

## Snapshot

Date: 27 April 2026

Current count:

- Closed active debts: 29
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

### Real Nebim / Source Ingest Evidence

Status: `blocked_external`

Why it is not counted as completed:

- Real source access method is unknown.
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

- delivery type: API, database view, file, SFTP, manual upload, Power BI export, or intermediary service
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

Still monitor:

- avoid committing local `.env` files
- avoid committing generated `dist` output
- keep `current-state.md` as handoff state, not a permanent product spec

## CODEX Honest View

The project is not debt-free in the sense that there is nothing left to build. It is debt-controlled.

The dangerous kind of debt would be:

- hidden auth assumptions
- unguarded release process
- second scoring engine
- unclear feed vs competition ownership
- raw auth evidence handling
- store-facing mixed-language trust gaps
- source row lineage hidden only inside JSON payloads
- persisted source row lineage hidden from admin import detail
- uncataloged audit event strings blocking a future coherent audit stream
- generic import errors without stable data quality codes
- row-level quality codes without a batch-level operator summary
- production auth fallback accepting default secrets
- empty actor scope widening into full-data list access

Those have been actively reduced. The remaining work is mostly planned product depth, real external staging proof, real source ingest evidence/adapter work, and a future coordinated visual/localization investment. That is a healthy place to be.

## Next Logical Step

If staging provider and seeded DB values are available, run the guarded staging action smoke.

If they are not available, check whether real source ingest details are available. If source delivery details or a sample payload are unavailable, do not write a source-specific connector yet.

The next local backend candidate should be chosen through the intake gate. Source-agnostic KPI ingest contract hardening, KPI raw row lineage persistence, admin lineage evidence visibility, audit event taxonomy guard, data quality guard, import batch quality summary, and the first project-wide scope/auth guard scan are now done, so do not repeat them as busywork; pick a nearby backend/data surface only if it strengthens existing behavior without guessing external source details.

Recommended local candidate if external evidence is still unavailable:

- Broaden the no-empty-scope repository contract pass to remaining list/query surfaces, carefully and with tests, so empty actor scope can never silently become full data access.
