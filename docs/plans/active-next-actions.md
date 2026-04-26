# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 26 April 2026, the competition package planning flow, Operational Feed V1, DM/CONFIG boundary decision, competition read polish, Turkish UI Localization Foundation V1, Local Keycloak real-provider/action smoke, Daily Closure Ranking V2 Explainability, and Score Meaning V1 have:

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
- project debt ledger
- backend and frontend release checks

## Debt Count

Reference: `docs/plans/project-debt-ledger.md`

- Closed active debts: 14
- Superseded before overbuilding: 1
- Blocked external dependency: 1
- Watchlist decision item: 1
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

Interpretation:

- The local project is not carrying a known silent release-quality debt right now.
- Real IdP staging evidence is not counted as done because it requires outside staging IdP and seeded DB values.
- Daily Closure / Historical Ranking V2 explainability now exists over the existing read model.
- Score Meaning V1 now explains the personnel weighted score on `/store/me`; broader KPI source semantics and store-score threshold language remain planned investment.
- The debt ledger itself is an accounting artifact and is not included in the 12 closed active debt items.

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

If staging values are not available, start KPI Source Semantics V1. The next local product step is to explain whether each KPI value is imported, derived, checklist-fed, pending normalization, or missing.
