# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 26 April 2026, the competition package planning flow, Operational Feed V1, DM/CONFIG boundary decision, competition read polish, Turkish UI Localization Foundation V1, Local Keycloak real-provider/action smoke, Daily Closure Ranking V2 Explainability, Score Meaning V1, KPI Source Semantics V1, Store Score Threshold Language V1, KPI Interpretation Governance V1, KPI Config Editor Governance Preview V1, Ranking Completeness Segment Readiness V1, Shared Inbox Maturity V1, Store UX TR-First Copy V1, KPI Config Versioning V1, Source-Agnostic Ingest Contract Hardening V1, and KPI Raw Row Lineage Persistence V1 have:

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
- payload-template canonical KPI contract metadata
- project debt ledger
- backend and frontend release checks

## Debt Count

Reference: `docs/plans/project-debt-ledger.md`

- Closed active debts: 24
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 1
- Strategic investment backlog: 2
- Silent untracked quality debt in the active gate: 0

Interpretation:

- The local project is not carrying a known silent release-quality debt right now.
- Real IdP staging evidence is not counted as done because it requires outside staging IdP and seeded DB values.
- Real Nebim/source ingest evidence is not counted as done because source access method, payload fields, cadence, auth, and identity semantics are not available yet.
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
  - do not build a Nebim-specific connector without real source evidence
  - treat existing Nebim cadence/payload notes as working assumptions, not vendor-confirmed facts
  - keep the ingest boundary source-agnostic through `stg.integration_source`, `stg.import_batch`, canonical raw KPI rows, normalization, and materialization
  - require a sanitized sample payload or official field list before source-specific adapter code
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
  - no Nebim-specific connector, fake API client, cadence assumption, score change, DB schema change, snapshot change, or ranking change was introduced
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
  - no Nebim-specific connector, fake adapter, cadence assumption, score change, materialization change, snapshot change, or ranking change was introduced
- Reference:
  - `docs/plans/kpi-raw-row-lineage-persistence-v1.md`

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

### 2. Global Audit Feed Consideration
- Priority: `P2`
- Why: audit trails exist per feature, but operators may later need one cross-module feed.
- Scope:
  - decide if global audit feed is needed
  - avoid building until a real operator workflow requires it

## Recommended Next Move

If staging IdP and seeded staging DB values are available, start real staging evidence.

If Nebim/source delivery details, sample payload, or official field list become available, start source mapping specification.

If neither staging values nor source ingest details are available, choose the next controlled local backend/data step through the intake gate. Source-agnostic KPI ingest contract hardening and KPI raw row lineage persistence are now done; the next local step should strengthen an existing backend/data surface without guessing external source behavior.
