# Project Gap Analysis And Roadmap

## Purpose
Summarize what is already strong, what is still weak or missing, and what should happen next so the platform grows without hidden debt.

## What Is Already Solid
- role and scope model is real, not mocked in the UI only
- admin and store shells are separated correctly
- two workflow languages are proven:
  - `approval`
  - `acknowledgement`
- shared inbox language is proven with three sources:
  - approvals
  - acknowledgements
  - KPI tasks
- KPI config is no longer hard-coded:
  - DB-backed
  - draft/publish
  - audit trail
  - diff visibility
- `STORE_MANAGER` and `STORE_PERSONNEL` are now explicitly different personas

This means the project has a usable product backbone.

## Critical Gaps

### 1. Real ingest is only partially opened
What exists:
- integration source model
- import batch model
- KPI ingest envelope
- first live KPI upsert behavior
- source-specific KPI normalization for canonical rows and Nebim/Power BI shaped metric columns
- config-driven poll schedule backbone per integration source

What is missing:
- real Nebim connector or real Power BI connector
- scheduled 30-minute execution path
- source payload validation against a real sample contract

Why it matters:
- most KPI, ranking, and score work still depends on demo-shaped data

### 2. Daily closure V1 exists; explainability is the next gap
What exists:
- design decision for `live state + daily closed snapshot`
- daily closure status + queue surface for the previous local day
- admin snapshot dashboard visibility for closure readiness
- config-driven automation backbone for daily closure polling
- daily employee performance snapshot tables
- `/store/me` can read `live` or `closed` mode
- `/store/rankings` can read daily and monthly closed leaderboards
- store rank and Turkey rank are supported
- KPI mini-ranks are supported
- month-to-date ranking uses completed daily snapshots
- monthly coverage exposes `daysWithPerformance / closedDaysInPeriod`
- official monthly rank requires at least 3 closed performance days

What is missing:
- stronger official vs preview-only vs no-data explanation in the API/UI
- clearer Turkish-first copy for coverage and missing-day states
- wider admin/region historical views
- historical recompute explanation surfaced to operators

Why it matters:
- the ranking data exists, but user trust depends on explaining when a rank is official, preview-only, not closed, or absent because of missing performance data

### 3. KPI grading model is defined in product language, not in code yet
What exists:
- score profiles
- weighted scoring
- ownership model

What is missing:
- Turkey-average normalization index
- grade bands like `A/B/C/D`
- emoji/status layer
- configurable band thresholds

Why it matters:
- the user-facing meaning of score is still weak
- score exists, but interpretation is not yet productized

### 4. Ranking behavior is still incomplete
What exists:
- self-performance route
- basic ranking placeholders/data path

What is missing:
- real Turkey-wide ranking computed from live normalized data
- historical ranking by day/week/month
- config-driven eligibility rules
- segment-based ranking behavior

Why it matters:
- ranking is one of the most visible user promises, especially for store personnel

### 5. KPI source semantics are not fully modeled yet
What exists:
- personnel vs store KPI split
- `CR` store-only decision
- target achievement derived internally

What is missing:
- explicit distinction between:
  - imported metric
  - derived metric
  - checklist-fed metric
  - grade-only presentation layer

Why it matters:
- if this stays fuzzy, future KPIs like `GSM approvals` will create confusion and duplicated logic

## Medium Gaps

### 6. KPI config has edit/publish, but not full governance
What exists:
- draft/publish
- audit
- diff
- validation

What is missing:
- version history with rollback
- effective-date publishing
- staged comparison of current vs next score impact

Why it matters:
- KPI weights are business-sensitive and will likely change rarely, but when they do, the impact must be explainable

### 7. Shared inbox is structurally correct but still early
What exists:
- common contract
- common route
- store/admin foundations

What is missing:
- richer detail views
- due dates / escalation semantics
- stronger source-specific primary actions
- reduced dependence on demo seeds

Why it matters:
- inbox is becoming the main operational surface

### 8. Store KPI and self-performance surfaces are functionally ahead of UX
What exists:
- real read surfaces
- live config effect visibility

What is missing:
- mobile-first visual polish
- final information hierarchy
- TR-first content layer
- final grade/ranking storytelling

Why it matters:
- the data model is ahead of the product feel
- that is acceptable now, but should not stay that way too long

## Structural Risks

### 9. Auth hardening is mostly complete
Local Keycloak demo role/scope inference has been removed from the backend. Production DB auth lookup failures now fail closed, production JWT validation rejects tokens without direct `sub` or `aud` claims, and the frontend login path now uses authorization code + PKCE. The remaining hardening work is now narrower:

- finalize provider-specific mapper names and logout/refresh behavior with the chosen identity provider
- non-production keeps sparse-token and local fallback tolerance for development/test only

### 10. Repo hygiene is not healthy enough yet
Visible signs:
- `.gitignore` is deleted in working tree
- `node_modules`, `dist`, runtime logs, and local env files are present in the working tree
- `current-state.md` has encoding damage in places

Why it matters:
- not a product blocker
- but it increases accidental commit risk and onboarding friction

## Things That Look Wrong But Are Acceptable For Now
- English-heavy UI text
- placeholder visual design
- demo seed dependence in some flows
- config-driven rules left intentionally incomplete

These are acceptable now because the product language and backend contracts were the more important priority.

## Roadmap

### Roadmap 1. Complete The KPI Data Backbone
Goal:
- stop relying on demo-shaped KPI truth

Do:
- real KPI import mapping contract
- 30-minute ingest scheduling
- live KPI overwrite behavior
- source metadata everywhere needed for debugging

Exit criteria:
- one real source can feed live KPI state end to end

### Roadmap 2. Daily Closure Ranking V2 Explainability
Goal:
- make closed ranking trustworthy and understandable to store users

Strategy:
- [daily-closure-ranking-strategy.md](./daily-closure-ranking-strategy.md)
- [daily-closure-ranking-v2-intake.md](./daily-closure-ranking-v2-intake.md)

Do:
- keep current closed ranking read path as the source of truth
- explain official vs preview-only monthly ranking
- explain not-closed and no-data states in Turkish-first copy
- show how many more closed performance days are needed
- keep missing data out of score averages

Exit criteria:
- store personnel and store managers can tell whether a closed rank is official, preview-only, not closed, or missing performance data without reading technical terms

### Roadmap 3. Productize Score Meaning
Goal:
- make score interpretable by real users

Do:
- Turkey-average normalization
- grade bands
- emoji/status labels
- configurable threshold model

Exit criteria:
- score cards explain what `1.00`, `1.32`, `0.76` mean in product language

### Roadmap 4. Finish Ranking
Goal:
- make personnel and store ranking credible

Do:
- real Turkey ranking
- store ranking
- segment-ready ranking model
- eligibility rules kept config-driven
- region league/tournament concepts are kept separate from plain ranking

Exit criteria:
- store personnel can trust `/store/me` as a real performance and ranking surface

### Roadmap 5. Harden Config Governance
Goal:
- reduce business-risky config mistakes

Do:
- publish rollback
- effective-date support
- impact preview

Exit criteria:
- KPI config becomes safe enough for real admin use

### Roadmap 6. UX And Localization Pass
Goal:
- turn working surfaces into product-ready surfaces

Do:
- mobile-first refinement
- TR-first content
- better visual grouping for:
  - inbox
  - KPI screens
  - self-performance

Exit criteria:
- role-specific screens feel intentional, not just technically functional

## Recommended Order
1. real KPI ingest path
2. daily closure
3. score grading model
4. ranking completion
5. config governance hardening
6. UX + localization pass

## Non-Rewrite Recommendation
Do not rewrite the platform.

Do:
- keep the current architecture
- keep the workflow language
- keep the persona split
- keep KPI config as DB-backed

Change:
- data backbone
- historical closure
- score interpretation
- governance and UX

## Current Verdict
The project is in a good direction.

The biggest missing part is no longer auth or shell structure.

The biggest missing part is:
- turning KPI data from demo-compatible truth into production-grade live + historical truth.
