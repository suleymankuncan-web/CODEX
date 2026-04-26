# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 26 April 2026, the competition package planning flow, Operational Feed V1, and DM/CONFIG boundary decision have:

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

### 1. Store/Region Competition Experience Polish
- Priority: `P1`
- Why: admin can build competitions; store and region users need clearer read experiences.
- Scope:
  - scoped competition detail readability
  - contribution explanations
  - ranking/coverage copy
- Suggested verification:
  - store competition Playwright smoke
  - region read-only smoke

### 2. Turkish UI Localization Foundation
- Priority: `P1`
- Why: product default will be Turkish, and current competition UI copy is still English.
- Scope:
  - typed frontend label dictionary or selected i18n foundation
  - start with competition/store surfaces
  - keep API enum/audit codes untranslated
- Reference:
  - `docs/plans/ui-localization-strategy.md`

### 3. Real IdP Staging Evidence
- Priority: `P1`
- Why: auth is stable locally, but production confidence needs real provider evidence.
- Scope:
  - fill provider readiness checklist
  - run PKCE login/logout smoke
  - store sanitized evidence only
- References:
  - `docs/plans/phase-7-provider-readiness-checklist.md`
  - `docs/plans/phase-7-auth-evidence-template.md`

### 4. Global Audit Feed Consideration
- Priority: `P2`
- Why: audit trails exist per feature, but operators may later need one cross-module feed.
- Scope:
  - decide if global audit feed is needed
  - avoid building until a real operator workflow requires it

## Recommended Next Move

Polish the Store/Region competition read experience next. Admin can build controlled competition plans now; store and region users need clearer contribution, warning, ranking and coverage explanations before the module grows further.
