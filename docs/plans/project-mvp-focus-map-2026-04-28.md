# Project MVP Focus Map - 28 April 2026

## Purpose

This note is the project consolidation map.

The goal is to reduce the feeling of scattering without throwing away the foundations already built. It separates what must be protected, what belongs in the near MVP, what should wait, and what is blocked by outside evidence.

## Decision

Do not restart the project from zero.

The project is not failed or technically lost. It is broad, but it is broad with traceable decisions, release gates, tests, and documented boundaries.

The right move is consolidation:

- pause broad new module creation
- keep the backend/data/auth foundations
- finish the smallest real-data path
- treat UI as a draft until the data workflows are proven
- make every next step serve MVP readiness

## CODEX DURUST YORUM

Restarting now would feel emotionally clean but technically wasteful.

The project has already paid for hard foundations: auth/scope separation, action scope, audit catalog, release gate, KPI config versioning, import lineage, data quality issue codes, personnel request workflows, and store/admin shell boundaries. These are exactly the parts that become expensive and messy if rebuilt casually.

The discomfort is real, but it comes from too many connected areas being visible at once. That is not the same thing as architectural collapse.

My honest recommendation: keep the project, narrow the next 2-4 weeks, and stop treating every good future idea as immediate work. The project should enter a consolidation phase before the next big product expansion.

## Product North Star

This product is a store operations and performance platform.

The first real MVP should prove this:

- HR/Admin can control who exists and who can act.
- Store managers can handle store-level operational requests.
- Store personnel can understand their own performance.
- KPI data can enter the system with lineage and quality checks.
- Store and personnel performance can be shown without guessing or double-counting.
- The system can be released through one guarded quality gate.

If a feature does not help one of these statements, it should wait.

## Protected Core

These parts should be kept and protected. They are not the source of the current discomfort.

### Auth, Role, Scope

Keep:

- app role catalog
- read scope vs action scope distinction
- `assignedStoreIds` action model
- fail-closed empty-scope behavior
- local Keycloak proof and staging smoke guard

Why:

- every real workflow depends on correct store/region/company visibility and action limits

### Release And Safety Gates

Keep:

- root `npm.cmd run check:release`
- backend/frontend module release checks
- script contract tests
- audit event taxonomy guard
- env drift guard

Why:

- this prevents silent regression while the project grows

### KPI And Import Foundation

Keep:

- `stg.import_batch`
- `stg.kpi_raw`
- `rowHash`
- `rawRowReference`
- data quality issue catalog
- import batch quality summary
- KPI config versioning and snapshot anchoring

Why:

- real business trust will come from explaining where every number came from

### Store And Personnel Performance

Keep:

- `/store/me`
- `/store/rankings`
- `/store/kpis`
- weighted score explanation
- daily/monthly closed ranking trust language

Why:

- this is one of the first surfaces store users will care about

### Personnel Management V1

Keep:

- seller-code request
- offboarding request
- HR/Admin approval
- return/resubmit
- employee + assignment mutation only after approval

Why:

- personnel identity is required for KPI, turnover, future norm kadro, and store accountability

### Operational Feed V1

Keep:

- announcements
- challenge posts
- region/store/company visibility

Why:

- this correctly replaced premature tournament overbuilding for simple UPT/ATV challenges

## MVP Scope

The near MVP should be smaller than the whole project.

### MVP Must Have

1. Real login/session shape for local and later staging verification.
2. Admin/store shell separation.
3. Store/personnel KPI import from the currently available March Excel files.
4. Correct business rule:
   - personnel KPI uses positive gross personnel sales
   - store KPI uses store-table net ciro
   - person negative rows are lineage/reconciliation evidence, not employee penalty
5. Store import scope guard:
   - only stores defined as active/import-enabled should be scored
   - unknown stores/personnel become review evidence
6. Store-facing performance screens:
   - self performance
   - rankings
   - KPI summary
7. Personnel lifecycle V1:
   - seller code request
   - offboarding request
   - return/resubmit
8. Admin import detail and quality summary.
9. Root release gate passing.

### MVP Should Have If Cheap

- basic Turkish-first copy on the main store surfaces
- simple admin summary for latest import health
- clear note when data is demo, imported, missing, or unmapped
- one canonical report note explaining March Excel semantics

### MVP Must Not Include Yet

- full tournament engine
- push notifications
- comments/likes/social feed features
- full production UI redesign
- full EN/TR translation of every screen
- global audit feed
- external JSON source adapter without sample evidence
- master-data bootstrap without store codes and seller codes
- payroll/HRIS/document management

## Hold / Later Bucket

These ideas are good, but they should not pull focus right now.

### Competition Depth

Keep the existing competition package planning work, but do not expand it unless a real operation needs staged competitions.

Simple UPT/ATV/total-score focus windows should continue as feed challenge posts plus existing rankings.

### Full UI Redesign

The current UI can remain a working draft.

Do not do a broad visual redesign until:

- Excel KPI import path is proven
- store/personnel data identity is stable
- the store MVP screens are functionally coherent

When UI work starts, use small reversible pilots.

### Full Localization

Keep Turkish as default and preserve the existing localization foundation.

Do not translate the entire app in one sweep yet. Expand labels screen by screen as MVP surfaces stabilize.

### Master Data Bootstrap

The bootstrap plan is correct, but it needs a real baseline file containing:

- store code
- region
- store type
- seller code
- position
- employment status
- assignment store

The March Excel files do not contain enough identity data for this.

## Blocked External Bucket

These are not local failures.

### Real Staging IdP Evidence

Blocked until real staging provider values and seeded staging DB values exist.

Prepared locally:

- staging smoke scripts
- action smoke guard
- evidence guard
- operator checklist

### Real JSON Source Adapter

Blocked until real JSON sample payload or official field list exists.

Prepared locally:

- source-agnostic import model
- raw row lineage
- data quality catalog
- batch quality summary

## Near-Term Roadmap

### Phase 1: Consolidate The Map

Goal:

- stop the project from feeling scattered

Actions:

- use this MVP focus map as the decision filter
- keep current-state and active-next-actions aligned
- avoid starting any new module that does not serve MVP

Exit:

- every next step can be explained as MVP, blocked external, or future investment

### Phase 2: Excel KPI Import V1

Goal:

- turn the March Excel files into a safe import path

Actions:

- map `MAĞAZA TABLO.xlsx` as the store net KPI source
- map `PERSONEL TABLO.xlsx` as the personnel gross positive-sales source
- recompute period ATV from total sales amount and total invoice count
- recompute period UPT from total sales quantity and total invoice count
- recompute period CR from total invoice count and total FF
- persist row lineage and reconciliation evidence
- reject/queue unknown stores and unknown personnel
- make re-upload idempotent

Exit:

- March data can be loaded without double counting or wrong employee penalty

### Phase 3: Store/Personnel Identity Baseline

Goal:

- prepare official identity data once real baseline files exist

Actions:

- load store baseline first
- load personnel baseline second
- use staging/review/promote
- never create temporary employees from KPI names

Exit:

- KPI import can resolve stores and seller codes from official master data

### Phase 4: Store MVP Review

Goal:

- make the store user experience understandable enough for pilot review

Actions:

- review `/store`
- review `/store/me`
- review `/store/rankings`
- review `/store/kpis`
- review `/store/tasks`

Exit:

- a store manager/personnel user can understand what is real, missing, imported, or pending

### Phase 5: Staging/Production Readiness

Goal:

- move from local confidence to staging confidence

Actions:

- run real staging IdP smoke when values exist
- run assigned/unassigned action smoke
- keep evidence sanitized
- use deployment and incident runbooks

Exit:

- staging Go / Conditional Go / No-Go can be decided with evidence

## Decision Filter For New Ideas

Before adding a new feature, ask:

1. Does this help MVP readiness in the next 2-4 weeks?
2. Does it depend on real data we do not have yet?
3. Does it create a second source of truth?
4. Does it mutate `ops`, `stg`, `rpt`, or `audit`?
5. Who can see it and who can act on it?
6. What test or release gate proves it?

If the answer is unclear, document it as a future idea instead of building it.

## Current Project Health

Verdict:

- not production-ready
- not lost
- not worth restarting
- strong enough to consolidate
- ready for the next real-data slice

The project is good because it has learned to keep evidence. The next improvement is not speed; it is sharper focus.

## Next Logical Step

Create the Excel KPI Import V1 implementation plan around the inspected March files:

- store net source from `MAĞAZA TABLO.xlsx`
- personnel positive gross source from `PERSONEL TABLO.xlsx`
- period ATV, UPT, and CR recomputed from summed base metrics
- negative rows as reconciliation evidence
- no temporary employee/store creation
- unknown identities into review queues
