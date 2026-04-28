# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 28 April 2026, the competition package planning flow, Operational Feed V1, DM/CONFIG boundary decision, competition read polish, Turkish UI Localization Foundation V1, Local Keycloak real-provider/action smoke, Daily Closure Ranking V2 Explainability, Score Meaning V1, KPI Source Semantics V1, Store Score Threshold Language V1, KPI Interpretation Governance V1, KPI Config Editor Governance Preview V1, Ranking Completeness Segment Readiness V1, Shared Inbox Maturity V1, Store UX TR-First Copy V1, KPI Config Versioning V1, Source-Agnostic Ingest Contract Hardening V1, KPI Raw Row Lineage Persistence V1, Import Lineage Evidence Surface V1, Audit Event Taxonomy Guard V1, Data Quality Guard V1, Import Batch Quality Summary V1, Project-Wide Scope/Auth Guard Scan V1, No-Empty-Scope Repository Contract Pass V1, Production Environment Readiness Checklist V1, Environment Variable Inventory + Deployment Runbook Skeleton V1, Environment Drift Guard V1, Production/Staging Incident Response Skeleton V1, Personnel Management V1, Personnel Request Return/Resubmit V1, Personnel Master Data Bootstrap V1 planning, Project MVP Focus Map, Excel KPI Import V1, Excel KPI Import Operator Runbook V1, and Production-Ready Migration System V1 planning have:

- saved drafts
- edit/cancel/history
- decision-ready approval gate
- approve/return decision lock
- approved-only execute
- returned-plan clone as new draft
- cloned-plan source visibility from audit metadata
- submitted-plan pre-approval decision preview
- controlled company/region/store feed posts
- store-visible pinned feed preview
- documented `DM`, `CONFIG`, `JOB`, and `API/BFF` ownership boundaries
- store/region competition read summaries, contribution health, and warning explanations
- Turkish-default `tr/en` UI localization foundation with browser-persisted language toggle
- local OIDC authorization code + PKCE login/logout smoke evidence
- local seeded assigned-store `201` and unassigned-store `403` action smoke evidence
- backend filtering of provider default roles from app-facing JWT session roleCodes
- canonical schema coverage for target distribution action tables
- backend web DTO PostgreSQL UUID validation contract
- explicit staging auth smoke guard and runbook
- official root release check gate
- staging auth evidence operator checklist
- staging auth evidence JSON guard
- daily/monthly closed ranking trust explanations
- personnel score meaning and confidence copy
- KPI source semantics for imported, derived, checklist-fed, pending normalization, and missing values
- store weighted-score threshold and action interpretation copy
- KPI interpretation versioning, effective-date, audit, and snapshot-anchoring governance plan
- admin KPI config publish-governance preview and draft/live diff counts
- ranking scope readiness for Turkey-wide, store-level, metric mini-rank, and future segment use
- shared inbox row detail, due, escalation, and source action interpretation
- Turkish-first store shell, store home, store task queue, workflow row details, and store feed labels
- immutable published KPI config version history
- snapshot-run anchoring to the active KPI config version
- pre-governance visibility for legacy snapshots
- admin KPI config and snapshot report version metadata
- deterministic KPI import row hashes and readable raw row references
- first-class `stg.kpi_raw` row hash and raw row reference persistence
- admin import detail visibility for KPI row lineage evidence
- backend-owned audit event catalog and drift guard
- payload-template canonical KPI contract metadata
- import data quality issue catalog and additive `qualityIssueCode`
- batch-level import data quality summary on import detail
- project-wide scope/auth scan evidence
- production JWT default-secret fallback guard
- no-empty-scope guards for store listing and target-distribution request listing
- no-empty-scope guards for reporting, checklist acknowledgement, competition read, and visible feed repository surfaces
- production environment readiness checklist guarded by root script tests
- environment variable inventory and deployment runbook skeleton guarded by root script tests
- dynamic environment drift guard for backend, frontend, and auth smoke env surfaces
- production/staging incident response skeleton for auth, import/data quality, and deploy/release failures
- store-originated personnel activation and offboarding requests with HR/Admin approval
- seller-code approval creating employee and active assignment records
- offboarding approval terminating employee, closing active assignment, and creating turnover event evidence
- HR/Admin return notes and same-request resubmission for seller-code/offboarding corrections
- controlled store/personnel baseline plan before any direct master-data import
- consolidation decision: do not restart, narrow to MVP and real-data proof
- Excel KPI Import V1 gross-personnel/net-store split
- first-class `FF` base metric and recomputed period `ATV`, `UPT`, and `CR`
- deterministic Excel upload source batch ids for duplicate-safe re-upload
- admin monthly/daily/custom Excel upload period controls and reconciliation summary
- repeatable Excel import operator runbook for upload, summary, mapping, reconciliation, retry, materialization, and evidence
- production-ready migration system implementation plan for tracking, checksum drift protection, failed-run evidence, CLI execution, and production HTTP endpoint guard
- project debt ledger
- backend and frontend release checks

## Debt Count

Reference: `docs/plans/project-debt-ledger.md`

- Closed active debts: 38
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Interpretation:

- The local project is not carrying a known silent release-quality debt right now.
- Real IdP staging evidence is not counted as done because it requires outside staging IdP and seeded DB values.
- Real JSON source ingest evidence is not counted as done because delivery method, payload fields, cadence, auth, and identity semantics are not available yet.
- Daily Closure / Historical Ranking V2 explainability now exists over the existing read model.
- Score Meaning V1 now explains the personnel weighted score on `/store/me`.
- KPI Source Semantics V1 now explains imported, derived, checklist-fed, pending normalization, and missing KPI values on store-facing KPI rows.
- Store Score Threshold Language V1 now explains store weighted score bands, score confidence, and action language on `/store/kpis`.
- KPI Interpretation Governance V1 now defines when interpretation/version/effective-date work must become a technical implementation.
- KPI Config Editor Governance Preview V1 now makes `/admin/kpi-config` show publish-impact diffs before live interpretation changes.
- Ranking Completeness Segment Readiness V1 now makes `/store/rankings` explain Turkey-wide, store-level, metric mini-rank, and segment readiness without opening a new ranking engine.
- Shared Inbox Maturity V1 now makes store/admin inbox rows explain detail, due signal, escalation, and source action without opening a new workflow state machine.
- Store UX TR-First Copy V1 now closes the first coherent store-facing copy pass for shell, tasks, workflow details, feed, and pinned feed preview.
- Real ingest local foundation exists, but the actual source-specific connector is blocked until external source evidence exists.
- KPI Config Versioning V1 is implemented; rollback UI, future effective scheduling, approval workflow, and DB-managed interpretation copy remain future depth, not silent debt.
- Source-Agnostic Ingest Contract Hardening V1 is implemented; real source adapter work remains blocked until external source evidence exists.
- KPI Raw Row Lineage Persistence V1 is implemented; reconciliation can query staging lineage columns without parsing raw JSON.
- Import Lineage Evidence Surface V1 is implemented; admin import detail now exposes KPI lineage counts and row-level evidence where available.
- Audit Event Taxonomy Guard V1 is implemented; global audit feed remains intentionally unbuilt, but emitted audit events now have a backend-owned catalog and drift guard.
- Data Quality Guard V1 is implemented; import error rows now expose stable `qualityIssueCode` while keeping the old `errorCategory` contract.
- Import Batch Quality Summary V1 is implemented; batch detail now summarizes failed rows by stable quality issue code.
- Project-Wide Scope/Auth Guard Scan V1 is implemented; production JWT fallback and two scope-widening repository paths are now guarded by tests.
- No-Empty-Scope Repository Contract Pass V1 is implemented; remaining actor-scoped store/region/company read surfaces found in store-ops repositories now fail closed on empty scope.
- Production Environment Readiness Checklist V1 is implemented; environment, secrets, IdP, DB migration, audit/backup, smoke evidence, and JSON source readiness are now one guarded operator checklist.
- Environment Variable Inventory + Deployment Runbook Skeleton V1 is implemented; backend/frontend/smoke env names, secret rules, release/migration/deploy/smoke/rollback order, and env examples are now guarded by root script tests.
- Environment Drift Guard V1 is implemented; root script tests now extract env usage from `AppConfigService`, `import.meta.env`, and `AUTH_SMOKE_*` code paths and fail when inventory/examples drift.
- Production/Staging Incident Response Skeleton V1 is implemented; auth, import/data quality, deploy/release, sanitized evidence, rollback/forward-fix/No-Go, and JSON-source holding rules are now guarded by root script tests.
- Personnel Management V1 is implemented; store managers can request seller-code activation and offboarding from assigned stores, while HR/Admin remains the official approval point for employee/assignment mutation.
- Personnel Request Return/Resubmit V1 is implemented; HR/Admin can return seller-code and offboarding requests with a required note, and store managers can edit and resubmit the same request id.
- Personnel Master Data Bootstrap V1 is planned; stores should be baselined before personnel, and rows should pass through staging/review/promote instead of direct Excel-to-live-table mutation.
- Project MVP Focus Map is recorded; the project should consolidate around Excel KPI Import V1, store/personnel performance, personnel lifecycle, import quality visibility, and release evidence instead of restarting from zero.
- Excel KPI Import V1 formula decision is locked; period ATV, UPT, and CR must be recomputed from summed base metrics, not averaged from daily ratios.
- Excel KPI Import V1 is implemented; backend targeted tests, frontend build/e2e, and root `check:release` pass.
- Excel KPI Import Operator Runbook V1 is implemented and guarded by root script tests.
- Full production UI/design-system and complete EN/TR localization expansion remain planned investments, not silent release debt.
- Production UI/design-system is intentionally deferred into reversible pilots while backend/data foundations remain the priority.
- The debt ledger itself is an accounting artifact and is not counted as a separate closed active debt item.

## Rules For Picking The Next Item

- Use the feature intake interview before new workflow/data/permission work.
- Prefer the smallest next feature that strengthens the current module.
- Do not open a large new module if the current module has an unfinished control surface.
- Keep API status/audit codes stable; improve UI language through labels.
- Keep the boundary between `Operational Feed` and `Competitions` explicit:
  - feed challenge posts announce and link; they do not calculate score or create stages
  - competitions manage staged/approved/executable competitions; they do not own company announcement streams

## Ordered List

### Completed: Package Plan Source Visibility
- Completed: 25 April 2026
- Result:
  - cloned drafts show `Cloned from ...` in the package plan card
  - clone history displays the source plan name
  - backend derives source plan info from audit metadata without a schema change

### Completed: Package Plan Pre-Approval Preview
- Completed: 26 April 2026
- Result:
  - decision-ready plans show a compact `Decision preview`
  - preview includes plan window, stage count, team template count, stage dates, and store assignment count
  - verification is covered by the existing save/submit/approve/execute Playwright flow

### Superseded: Competition Format Registry V1
- Superseded: 26 April 2026
- Reason:
  - UPT-style challenges do not need a second scoring/ranking engine in V1.
  - The better immediate product shape is an operational feed post that announces a challenge and links to existing ranking/profile surfaces.
- References:
  - superseded design: `docs/superpowers/specs/2026-04-26-competition-format-registry-v1-design.md`
  - superseded plan: `docs/superpowers/plans/2026-04-26-competition-format-registry-v1.md`

### Completed: Operational Feed V1
- Completed: 26 April 2026
- Result:
  - `/admin/feed` management surface exists for `SUPER_ADMIN`, `HR_ADMIN`, and scoped `REGION_MANAGER`
  - `/store/feed` read surface exists for store users
  - store home shows pinned feed preview
  - post types are `announcement` and `challenge`
  - visibility supports company, region, and store scope
  - challenge posts link to existing profile/ranking surfaces instead of owning score
  - backend/frontend release checks pass
- References:
  - design spec: `docs/superpowers/specs/2026-04-26-operational-feed-v1-design.md`
  - implementation plan: `docs/superpowers/plans/2026-04-26-operational-feed-v1.md`

### Completed: DM/CONFIG Boundary Note
- Completed: 26 April 2026
- Result:
  - current `ops`, `stg`, `rpt`, and `audit` schema ownership is documented
  - `DM` is defined as a conceptual rule boundary for now, not a new schema
  - `CONFIG` is split into runtime config, module-owned data config, and future UI/localization config
  - `JOB` remains a backend orchestration layer until durable cross-module job state is needed
  - `API/BFF` remains controllers plus frontend feature API helpers until repeated aggregation justifies a BFF
  - `ops.kpi_score_profile_config` was restored to canonical `db/schema.sql`
- Reference:
  - `docs/plans/dm-config-boundary-strategy.md`

### Completed: Store/Region Competition Experience Polish
- Completed: 26 April 2026
- Result:
  - store and admin/region competition detail surfaces show `Read summary`
  - contribution rows explain `Contribution health`, coverage, missing KPI labels, and why partial rows matter
  - scoped warnings show human-readable titles and explanations while preserving audit/status codes
  - region manager read-only behavior remains locked
  - frontend release check passes

### Completed: Turkish UI Localization Foundation V1
- Completed: 26 April 2026
- Result:
  - default UI locale is Turkish (`tr`)
  - English (`en`) can be selected from the shell language toggle
  - preference persists in browser localStorage
  - competition read summary, contribution health, and warning labels use typed frontend translations
  - API enum/audit/status codes remain untranslated and stable
- References:
  - `docs/plans/ui-localization-strategy.md`
  - `docs/superpowers/specs/2026-04-26-ui-localization-foundation-design.md`
  - `docs/superpowers/plans/2026-04-26-ui-localization-foundation.md`

### Completed: Local Keycloak Real-Provider And Action Evidence
- Completed: 26 April 2026
- Result:
  - `npm.cmd run smoke:auth:live` exists for browser-driven local provider smoke
  - `npm.cmd run smoke:auth:action` exists for browser-driven local provider + DB-backed action smoke
  - local Keycloak PKCE login, callback exchange, `/api/auth/session`, logout, and expired-token clearing passed
  - assigned-store target distribution create returned `201` and `submitted`
  - unassigned-store target distribution create returned `403`
  - evidence is stored without raw tokens/codes/verifiers
  - backend JWT provider filters non-app provider default roles out of session `roleCodes`
  - seeded PostgreSQL UUID store ids pass target distribution validation
  - `ops.target_distribution_request` is present in canonical `db/schema.sql`
- Reference:
  - `docs/plans/phase-7-auth-evidence-local-keycloak-2026-04-26.md`

### Completed: PostgreSQL UUID DTO Validation Contract
- Completed: 26 April 2026
- Result:
  - auth and store-ops web DTOs now use shared `IsPostgresUuid` validation for DB UUID fields
  - deterministic seeded IDs such as `00000000-0000-0000-0000-000000000100` are accepted consistently
  - a backend contract test fails if `IsUUID` is reintroduced in module web DTOs
  - target distribution seeded UUID integration coverage remains in place

### Completed: Staging Auth Smoke Guard And Runbook
- Completed: 26 April 2026
- Result:
  - `npm.cmd run smoke:auth:staging` exists for real staging IdP login/logout evidence
  - `npm.cmd run smoke:auth:staging:action` exists for real staging IdP plus seeded positive/negative action evidence
  - staging mode fails fast before network calls when local URLs, local demo credentials, missing issuer, missing JWKS URL, or missing action store IDs are used
  - frontend release now runs script contract tests through `npm.cmd run test:scripts`
- Reference:
  - `docs/plans/phase-7-staging-auth-smoke-runbook.md`

### Completed: Official Release Check Gate
- Completed: 26 April 2026
- Result:
  - workspace root now exposes `npm.cmd run check:release`
  - root gate runs backend release check first, then frontend release check
  - backend and frontend retain module-owned lint/test/build/audit behavior
  - `.github/workflows/release-check.yml` delegates to the same root gate on Node.js 24
  - root script contract tests guard the release command, workflow, order, and production audit requirement
- Reference:
  - `docs/plans/release-check-gate.md`

### Completed: Staging Auth Evidence Operator Checklist
- Completed: 26 April 2026
- Result:
  - staging auth smoke runbook now defines prepared/executed/reviewed/approved responsibilities
  - operator checklist covers environment preparation, preflight review, smoke execution, evidence review, and approval decision
  - sign-off states are explicit: Go, Conditional Go, No-Go
  - root script contract tests guard that the runbook remains an operational checklist and preserves security evidence rules
- Reference:
  - `docs/plans/phase-7-staging-auth-smoke-runbook.md`

### Completed: Staging Auth Evidence JSON Guard
- Completed: 26 April 2026
- Result:
  - `admin-web` exposes `npm.cmd run guard:auth:evidence`
  - evidence guard validates smoke JSON shape before approval
  - evidence guard rejects raw compact JWTs, unredacted sensitive URL parameters, and secret-like fields
  - action evidence must prove assigned-store `201` and unassigned-store `403`
  - frontend script tests cover accepted sanitized evidence and rejected unsafe evidence
- Reference:
  - `admin-web/scripts/auth-evidence-guard.mjs`
  - `docs/plans/phase-7-staging-auth-smoke-runbook.md`

### Completed: Daily Closure Ranking V2 Explainability
- Completed: 26 April 2026
- Result:
  - existing closed ranking endpoint remains the source of truth
  - backend adds employee-level `rankingStatus`, `eligibilityReason`, and `neededPerformanceDays`
  - daily rows are official when a closed row exists
  - monthly rows with at least 3 performance days are official
  - monthly rows below 3 performance days are preview-only and explain how many closed performance days are still needed
  - `/store/rankings` now uses Turkish-first trust copy for rank, coverage, period state, and preview-only explanations
  - no DB schema, score formula, region league, challenge leaderboard, or new ranking engine was introduced
  - official root release gate passes after the change
- References:
  - `docs/plans/daily-closure-ranking-v2-intake.md`
  - `docs/plans/project-forward-preview-2026-04-26.md`
  - `docs/superpowers/plans/2026-04-26-daily-closure-ranking-v2-explainability.md`

### Completed: Score Meaning V1
- Completed: 26 April 2026
- Result:
  - `/store/me` now shows a `Skor yorumu` panel for the weighted personnel score
  - grade codes map to simple product language: strong, healthy, follow-up, critical
  - score confidence copy shows how many metrics were scored
  - partial scores are treated as lower-trust interpretations
  - no backend contract, score math, grading threshold, DB schema, or config schema changed
  - Playwright self-performance smoke protects the visible interpretation
  - official root release gate passes after the change
- Reference:
  - `docs/plans/score-meaning-v1.md`

### Completed: KPI Source Semantics V1
- Completed: 26 April 2026
- Result:
  - `/store/me` metric rows show `Kaynak tipi` and `Veri kaynagi`
  - `/store/kpis` weighted-score and priority follow-up rows show the same source semantics
  - source labels cover imported, derived, checklist-fed, pending normalization, and missing states
  - no backend contract, score math, DB schema, migration, or config schema changed
  - Playwright store-surface smoke protects the visible explanation
- Reference:
  - `docs/plans/kpi-source-semantics-v1.md`

### Completed: Store Score Threshold Language V1
- Completed: 26 April 2026
- Result:
  - `/store/kpis` now shows a `Store skor yorumu` panel
  - store grade codes map to business language: strong, healthy, follow-up, critical
  - score confidence copy explains covered weight and partial interpretation risk
  - action language is shown without creating tasks or changing score math
  - no backend contract, DB schema, migration, or threshold config changed
  - Playwright store KPI smoke protects the visible explanation
- Reference:
  - `docs/plans/store-score-threshold-language-v1.md`

### Completed: KPI Interpretation Governance V1
- Completed: 26 April 2026
- Result:
  - current KPI config ownership is documented around `ops.kpi_score_profile_config`
  - version/effective-date/snapshot-anchoring requirements are defined before interpretation becomes admin-editable
  - target governance model covers versioned published config, interpretation packs, rollback, audit, and API metadata
  - explicit do-not-build-yet guard prevents premature `dm`/`config` schema split
  - no DB schema, migration, backend contract, score math, or frontend behavior changed
- Reference:
  - `docs/plans/kpi-interpretation-governance-v1.md`

### Completed: KPI Config Editor Governance Preview V1
- Completed: 26 April 2026
- Result:
  - `/admin/kpi-config` now shows `Governance preview` and `Publish decision preview`
  - draft/live diff counts are visible for store profile, personnel profile, ownership matrix, and grading bands
  - unpublished changes are explicitly marked as review-before-publish
  - versioned schema is shown as not active yet
  - snapshot anchoring is called out before interpretation changes become admin-editable
  - no backend contract, DB schema, migration, score math, or publish behavior changed
  - official root release gate passes after the change
- Reference:
  - `docs/plans/kpi-config-editor-governance-preview-v1.md`

### Completed: Ranking Completeness Segment Readiness V1
- Completed: 26 April 2026
- Result:
  - `/store/rankings` now shows `Siralama kapsam olgunlugu`
  - Turkey-wide readiness, store-level readiness, metric mini-rank readiness, and segment readiness are visible
  - future UPT/ATV/target challenges are framed as scope rules over the existing closed ranking model
  - no backend contract, DB schema, migration, score math, region league, tournament, or new ranking engine changed
  - official root release gate passes after the change
- Reference:
  - `docs/plans/ranking-completeness-segment-readiness-v1.md`

### Completed: Shared Inbox Maturity V1
- Completed: 26 April 2026
- Result:
  - store and admin inbox rows now show detail summary, due/time signal, escalation/yükseltme signal, and source action meaning
  - source action language is derived from existing source type
  - escalation language is derived from existing inbox status and urgency
  - no backend contract, DB schema, migration, workflow state machine, notification, or escalation execution changed
  - official root release gate passes after the change
- Reference:
  - `docs/plans/shared-inbox-maturity-v1.md`

### Completed: Store UX TR-First Copy V1
- Completed: 26 April 2026
- Result:
  - store shell chrome now uses Turkish-first labels for the mağaza alanı, preview status, real login, admin reports, announcements, and competitions
  - `/store` home preview explains pinned announcements, daily tasks, KPI summaries, incentive preview, route ownership, and admin boundaries in Turkish-first language
  - `/store/tasks` now uses Turkish-first queue labels, metric cards, guardrails, row labels, and action labels
  - workflow row details now show `Detay özeti`, `Zaman sinyali`, `Yükseltme`, and Turkish source action copy
  - `/store/feed` and pinned feed preview now use Turkish-first labels for visible announcements, pinned posts, challenge windows, metrics, and empty state
  - no backend contract, DB schema, audit/status code, score math, ranking behavior, or workflow state machine changed
  - targeted frontend checks passed for store shell/tasks and store feed/home
  - official root release gate passes after the change
- Reference:
  - `docs/plans/store-ux-tr-first-copy-v1.md`

### Decision Note: Production UI / Design-System Strategy
- Recorded: 26 April 2026
- Decision:
  - current UI may remain a working draft while backend foundations mature
  - broad visual redesign is not the immediate priority
  - future UI work should happen through small reversible pilots
  - admin shell should stay dense/desktop-first
  - store shell should stay mobile-first/task-first
  - full EN/TR localization remains a planned product layer, not a rushed patch
- Reference:
  - `docs/plans/production-ui-design-system-strategy.md`

### Intake: Real Ingest Connector And Payload Contract
- Recorded: 26 April 2026
- Status: `external_source_unknown`
- Decision:
  - do not build a source-specific JSON connector without real source evidence
  - treat existing Nebim cadence/payload notes as superseded working assumptions, not the active integration target
  - keep the ingest boundary source-agnostic through `stg.integration_source`, `stg.import_batch`, canonical raw KPI rows, normalization, and materialization
  - require a sanitized JSON sample payload or official field list before source-specific adapter code
- Reference:
  - `docs/plans/real-ingest-connector-contract-intake.md`
  - `docs/plans/nebim-ingestion-and-normalization-plan.md`

### Completed: Source-Agnostic Ingest Contract Hardening V1
- Completed: 26 April 2026
- Result:
  - KPI normalization emits deterministic `rowHash` for canonical rows
  - KPI normalization emits readable `rawRowReference` for reconciliation and future source evidence
  - metric-column normalization recognizes `TICKET_COUNT` and `ITEM_COUNT` in addition to existing KPI metrics
  - `/api/integrations/import-payload-templates` exposes `canonicalContract` metadata
  - adapter/scoring boundary rules are visible from the contract response
  - no source-specific JSON connector, fake API client, cadence assumption, score change, DB schema change, snapshot change, or ranking change was introduced
- Reference:
  - `docs/plans/source-agnostic-ingest-contract-hardening-v1.md`

### Completed: KPI Raw Row Lineage Persistence V1
- Completed: 26 April 2026
- Result:
  - `stg.kpi_raw.row_hash` stores canonical KPI row hashes as first-class staging lineage
  - `stg.kpi_raw.raw_row_reference` stores readable source row references
  - `kpi_raw_row_hash_idx` and `kpi_raw_reference_idx` support future reconciliation lookups
  - KPI import batch staging writes lineage columns directly from normalized `rowHash` and `rawRowReference`
  - schema contract and import-batch integration coverage guard the behavior
  - official root release gate passes after the change
  - no source-specific JSON connector, fake adapter, cadence assumption, score change, materialization change, snapshot change, or ranking change was introduced
- Reference:
  - `docs/plans/kpi-raw-row-lineage-persistence-v1.md`

### Completed: Import Lineage Evidence Surface V1
- Completed: 26 April 2026
- Result:
  - import batch detail API exposes `lineageSummary`
  - KPI detail responses report row hash coverage, raw row reference coverage, and sample evidence
  - KPI import error rows expose `rowHash` and `rawRowReference` when available
  - `/admin/integrations/:batchId` shows a `Source row lineage` panel
  - KPI error rows show row-level lineage evidence in the admin UI
  - official root release gate passes after the change
  - no source-specific connector, fake adapter, cadence assumption, score change, materialization change, snapshot change, or ranking change was introduced
- Reference:
  - `docs/plans/import-lineage-evidence-surface-v1.md`

### Completed: Audit Event Taxonomy Guard V1
- Completed: 26 April 2026
- Result:
  - backend shared audit code now owns `AUDIT_EVENT_CATALOG`
  - every backend module audit event literal must be represented in the catalog
  - catalog entries carry event type, audited entity, owner module, audit stream readiness, and description
  - a backend contract test fails on uncataloged audit event drift, duplicate events, invalid event naming, invalid entity naming, missing owner metadata, or missing readiness metadata
  - global audit feed endpoint/UI remains intentionally unbuilt until a real operator workflow requires it
  - official root release gate passes after the change
  - no DB schema, migration, audit event rename, existing audit endpoint change, or global feed surface was introduced
- Reference:
  - `docs/plans/audit-event-taxonomy-guard-v1.md`

### Completed: Data Quality Guard V1
- Completed: 26 April 2026
- Result:
  - backend integration code now owns an import data quality issue catalog
  - catalog entries carry issue code, owner, severity, label, and explanation
  - import batch error rows expose additive `qualityIssueCode`
  - existing `errorCategory` remains intact
  - payload template canonical KPI contract exposes `dataQualityIssueCodes`
  - frontend integration API types understand the additive fields
  - official root release gate passes after the change
  - no DB schema, source connector, source payload assumption, score math, ranking, snapshot, or new UI surface was introduced
- Reference:
  - `docs/plans/data-quality-guard-v1.md`

### Completed: Import Batch Quality Summary V1
- Completed: 26 April 2026
- Result:
  - import batch detail API exposes additive `qualityIssueSummary`
  - failed rows are grouped by stable quality issue code
  - summary items show code, label, owner, severity, description, and count
  - `/admin/integrations/:batchId` shows a `Data quality summary` panel
  - error row CSV export includes `qualityIssueCode`
  - no DB schema, migration, source connector, source payload assumption, score math, ranking, snapshot, retry policy, or global dashboard was introduced
- Reference:
  - `docs/plans/import-batch-quality-summary-v1.md`

### Completed: Project-Wide Scope/Auth Guard Scan V1
- Completed: 27 April 2026
- Result:
  - project-wide scan covered root scripts, backend, frontend, docs, package scripts, `.gitignore`, auth/scope, release gates, unsafe frontend patterns, and secret hygiene
  - no tracked `.env`, no critical committed secret, and no unsafe frontend DOM sink pattern was found
  - production JWT fallback now rejects missing/default `JWT_SECRET` unless JWKS verification is configured
  - store listing now applies actor scope first and requested filters only as additional constraints
  - target-distribution request listing now uses narrowest actor scope and `WHERE FALSE` for empty access scope
  - new backend tests lock the fixed behavior
  - backend and official root release gates pass after the change
- Reference:
  - `docs/plans/project-wide-scan-2026-04-27.md`

### Completed: No-Empty-Scope Repository Contract Pass V1
- Completed: 27 April 2026
- Result:
  - reporting report lists return `{ rows: [], total: 0 }` without querying when actor scope is empty
  - employee KPI period lookups return `null` or `[]` without querying when actor scope is empty
  - external employee reference resolution now requires company scope
  - checklist acknowledgement list returns `[]` without querying when actor scope is empty
  - competition list/detail/contribution/warning read surfaces return no data without querying when actor scope is empty
  - visible feed returns `[]` without querying when actor scope is empty
  - company-scope competition reads now filter through store company ownership instead of treating any company scope as a global bypass
  - targeted repository tests and backend release gate pass
- Reference:
  - `docs/plans/no-empty-scope-repository-contract-pass-2026-04-27.md`

### Completed: Production Environment Readiness Checklist V1
- Completed: 27 April 2026
- Result:
  - production/staging readiness now has a single operator checklist
  - checklist covers environment values, secrets, IdP registration, DB migration order, audit retention, backup assumptions, smoke evidence, and Go / No-Go criteria
  - JSON source work is explicitly held until a real sample payload or official field list arrives
  - no source-specific adapter, runtime behavior, DB schema, auth flow, or scoring behavior changed
  - root script tests guard that the checklist keeps required sections, no-secret evidence rules, release/smoke commands, and JSON-source blocking language
  - official root release gate passes after the change
- Reference:
  - `docs/plans/production-environment-readiness-checklist.md`

### Completed: Environment Variable Inventory + Deployment Runbook Skeleton V1
- Completed: 27 April 2026
- Result:
  - `docs/plans/environment-variable-inventory.md` lists backend runtime, frontend build-time, and auth smoke variables
  - `docs/plans/deployment-runbook-skeleton.md` defines preflight, release gate, migration, backend deploy, frontend deploy, smoke evidence, rollback, and sign-off order
  - backend `.env.example` now exposes code-supported production-relevant variables such as `ALLOW_MOCK_AUTH`, `JWT_JWKS_URL`, and daily closure settings
  - frontend `.env.example` now uses `VITE_OIDC_RESPONSE_TYPE=code` and exposes `VITE_OIDC_TOKEN_URL`
  - root script tests guard required sections, critical env names, smoke commands, no-secret evidence rules, and env example alignment
  - no runtime behavior, DB schema, source adapter, score math, or auth flow changed
  - official root release gate passes after the change
- Reference:
  - `docs/plans/environment-variable-inventory.md`
  - `docs/plans/deployment-runbook-skeleton.md`

### Completed: Environment Drift Guard V1
- Completed: 27 April 2026
- Result:
  - root script tests dynamically extract backend env names from `AppConfigService`
  - root script tests dynamically extract frontend env names from `import.meta.env` usage under `admin-web/src`
  - root script tests dynamically extract smoke env names from `AUTH_SMOKE_*` usage in `auth-live-smoke.mjs`
  - extracted backend/frontend vars must be present in both `.env.example` and `docs/plans/environment-variable-inventory.md`
  - extracted smoke vars must be present in the inventory
  - `docs/plans/environment-variable-inventory.md` now documents the drift guard maintenance contract
  - no runtime behavior, DB schema, source adapter, score math, or auth flow changed
- Reference:
  - `scripts/deployment-runbook-contract.test.mjs`
  - `docs/plans/environment-variable-inventory.md`

### Completed: Production/Staging Incident Response Skeleton V1
- Completed: 27 April 2026
- Result:
  - `docs/plans/production-staging-incident-response-skeleton.md` defines severity, ownership, triage, auth incident, import/data quality incident, deploy/release incident, sanitized evidence, incident note, and post-incident review sections
  - auth incidents are tied to `smoke:auth:staging:action`, `guard:auth:evidence`, assigned-store action success, and unassigned-store `403`
  - import incidents explicitly pause import/materialization jobs and keep JSON source-specific adapter work blocked until real sample evidence and a source mapping spec exist
  - deploy incidents are tied to `npm.cmd run check:release`, health/smoke evidence, rollback options, and no skipped tests
  - deployment runbook and production readiness checklist now link to the incident skeleton
  - no runtime behavior, DB schema, source adapter, score math, auth flow, or UI behavior changed
- Reference:
  - `docs/plans/production-staging-incident-response-skeleton.md`
  - `scripts/incident-response-skeleton-contract.test.mjs`

### Completed: Personnel Management V1
- Completed: 27 April 2026
- Result:
  - store managers can create seller-code/new-personnel requests from `/store/approvals`
  - HR/Admin approves seller-code requests from `/admin/inbox`
  - approval creates `ops.employee` and an active `ops.employee_assignment_history` row
  - store managers can create employee offboarding requests from `/store/approvals`
  - HR/Admin approves offboarding requests from `/admin/inbox`
  - approval terminates `ops.employee`, closes the active assignment, and creates `ops.turnover_event`
  - request rows remain workflow/evidence records, not a second live personnel source
  - official root release gate passes after the change
- Reference:
  - `docs/plans/personnel-management-v1.md`

### Completed: Personnel Request Return/Resubmit V1
- Completed: 27 April 2026
- Result:
  - HR/Admin can return seller-code requests from `/admin/inbox` with a required note
  - HR/Admin can return offboarding requests from `/admin/inbox` with a required note
  - return does not mutate `ops.employee`, assignments, or turnover events
  - store managers see returned workforce requests on `/store/approvals`
  - returned seller-code requests load into the original seller-code form and require full TC re-entry
  - returned offboarding requests load into the original offboarding form
  - resubmission keeps the same request id and moves the row back to `pending_hr_approval`
  - audit catalog includes rejected and resubmitted workforce events
- Reference:
  - `docs/plans/personnel-management-v1.md`

### Completed: KPI Config Versioning V1
- Completed: 26 April 2026
- Result:
  - `ops.kpi_config_version` stores immutable published KPI config versions
  - publishing a KPI config draft creates a new immutable version row
  - new `rpt.snapshot_run` rows store `kpi_config_version_id`
  - daily snapshot execution reads the anchored config version when present
  - failed snapshot reruns reuse the parent config version when present
  - legacy/null-version snapshots remain readable as pre-governance snapshots
  - `/admin/kpi-config` shows latest published version metadata
  - `/admin/reports/snapshot-runs` and snapshot detail surfaces show version/pre-governance context
  - rollback UI, future effective scheduling, approval workflow, and DB-managed interpretation copy remain outside V1
- Reference:
  - `docs/superpowers/specs/2026-04-26-kpi-config-versioning-v1-design.md`
  - `docs/superpowers/plans/2026-04-26-kpi-config-versioning-v1.md`

### Planned: Personnel Master Data Bootstrap V1
- Status: `decision_ready`
- Why: the system now has personnel request/offboarding flows, but existing store/personnel/seller-code baseline data must enter the platform before KPI imports and future norm kadro work can fully rely on official identity.
- Scope:
  - baseline stores before personnel
  - map store types as `Sirket -> company`, `Franchise -> franchise`, `Isletme -> operator`
  - use `ops.store.kpi_import_enabled` as the store KPI import scope gate
  - use `ops.employee.external_employee_ref` as the official seller code identity
  - stage, validate, review, and promote baseline rows instead of direct Excel-to-live-table mutation
  - keep unknown store/personnel rows as review evidence, not scored data
- Reference:
  - `docs/plans/personnel-master-data-bootstrap-v1.md`

### Decision Note: Project MVP Focus Map
- Recorded: 28 April 2026
- Decision:
  - do not restart the project from zero
  - treat the current discomfort as focus overload, not architectural collapse
  - consolidate around MVP readiness and real-data proof
  - keep UI as a draft until backend/data workflows are proven
  - avoid broad new modules unless they directly serve MVP
- MVP focus:
  - Excel KPI Import V1 from the inspected March files
  - store/personnel performance surfaces
  - personnel lifecycle V1
  - import quality and lineage visibility
  - root release gate evidence
- Reference:
  - `docs/plans/project-mvp-focus-map-2026-04-28.md`

### Decision Note: Excel KPI Import V1 Formula Rules
- Recorded: 28 April 2026
- Decision:
  - period ATV is recalculated as total sales amount / total invoice count
  - period UPT is recalculated as total sales quantity / total invoice count
  - period CR% is recalculated as total invoice count / total FF x 100
  - daily ratio values are not averaged for official period KPI
  - same source/period/scope/metric re-upload must replace/update, not add a duplicate
  - custom range uploads are not split into daily facts unless the file contains daily row dates
- Reference:
  - `docs/plans/excel-kpi-import-v1.md`

### Completed: Excel KPI Import V1
- Completed: 28 April 2026
- Result:
  - add `FF` as first-class KPI base metric
  - recompute store `ATV`, `UPT`, and `CR` from summed base values
  - import personnel KPI from positive gross sales only
  - keep personnel negative rows as reconciliation evidence
  - use enabled local stores as the Excel import scope gate
  - keep unresolved store/personnel identities in mapping review
  - make same-payload re-upload deterministic and duplicate-safe
  - add monthly/daily/custom upload period controls
- Verification:
  - backend targeted tests passed
  - frontend build and targeted Playwright tests passed
  - root `npm.cmd run check:release` passed
- Reference:
  - `docs/plans/excel-kpi-import-v1.md`
  - `docs/superpowers/plans/2026-04-28-excel-kpi-import-v1.md`

### Completed: Excel KPI Import Operator Runbook V1
- Completed: 28 April 2026
- Result:
  - operator flow is documented from environment preflight through upload, summary review, identity mapping, reconciliation, retry/re-upload, materialization, and evidence capture
  - runbook preserves the gross-personnel/net-store business rule
  - runbook preserves no-temporary-identity and store import scope guardrails
  - runbook defines Go / Conditional Go / No-Go decisions for pilot imports
  - root script tests guard that the runbook keeps its core sections and project handoff links
- Reference:
  - `docs/plans/excel-kpi-import-operator-runbook.md`
  - `scripts/excel-import-runbook-contract.test.mjs`

### Planned: Production-Ready Migration System V1
- Status: `ready_to_execute`
- Why: the project now has enough backend/data surface that SQL migration execution must become auditable before mobile auth/session, CORS/rate-limit, or social/community expansion.
- Scope:
  - create `audit.schema_migration` tracking metadata
  - add checksum drift protection for already-applied SQL files
  - record failed migration status and error evidence
  - resolve root `db/migrations` correctly from `backend/nestjs`
  - disable the HTTP migration endpoint in production
  - add CLI/CI migration command `npm.cmd run db:migrate`
- Reference:
  - `docs/superpowers/plans/2026-04-28-production-ready-migration-system-v1.md`

### 1. Real IdP Staging Evidence
- Priority: `P1`
- Why: local provider and action mechanics are proven, but production confidence still needs real staging IdP and seeded staging action evidence.
- Scope:
  - fill real staging provider registration values
  - run PKCE login/logout smoke against staging
  - run positive action smoke on assigned store
  - run negative action smoke proving unassigned store returns `403`
  - store sanitized evidence only
- References:
  - `docs/plans/phase-7-provider-readiness-checklist.md`
  - `docs/plans/phase-7-auth-evidence-template.md`

## Recommended Next Move

If staging IdP and seeded staging DB values are available, start real staging evidence.

If JSON source delivery details, sample payload, or official field list become available, start source mapping specification.

If neither staging values nor source ingest details are available, do not open source-specific adapter work yet. Excel KPI Import V1 is now local implementation-complete, and the inspected March files remain KPI snapshot files, not master-data baseline files, so do not start personnel/store bootstrap until a true baseline list with store codes and seller codes exists.

Recommended local candidate:

- Execute Production-Ready Migration System V1 Task 1 first: write the red migration service tests for path resolution, tracking, skip, checksum drift, and failure evidence before touching runtime migration code.
