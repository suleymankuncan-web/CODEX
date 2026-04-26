# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 26 April 2026, the competition package planning flow, Operational Feed V1, DM/CONFIG boundary decision, competition read polish, Turkish UI Localization Foundation V1, and Local Keycloak real-provider/action smoke have:

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
- backend and frontend release checks

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

Start real staging IdP + seeded staging action evidence next. The local OIDC and local DB-backed action mechanics are proven; the remaining confidence gap is the same sanitized evidence against a real staging provider and seeded staging database.
