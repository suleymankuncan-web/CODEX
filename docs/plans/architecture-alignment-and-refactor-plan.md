# Architecture Alignment And Refactor Plan

## Purpose
Capture whether the current project state is safe to continue from, what should be preserved, what should be aligned before feature growth accelerates, and which refactors are immediate versus later.

This document exists to answer one practical question:
- can we continue without throwing current work away?

Short answer:
- yes, the current foundation is reusable
- no, this is not yet the right moment to keep shipping new domain-heavy features without a short architecture alignment pass

## Current Assessment

### What Is Already Strong
- backend modular monolith direction is correct
- schema separation is correct:
  - `ops`
  - `stg`
  - `rpt`
  - `audit`
- admin shell and store shell separation is a strong long-term decision
- auth, role, scope, and session bootstrap foundations are in the right place
- reporting and store shell work have been added additively, not through destructive rewrites
- store shell routes are still light enough to be reshaped without major rework

### What Is Not Broken, But Not Final
- several store surfaces are still route-first rather than domain-first
- workflow concepts are visible, but not yet formally separated:
  - approval
  - acknowledgement
  - task
  - notification
- backend auth now requires explicit token/provider claims instead of local Keycloak demo role/scope inference
- some store surfaces currently borrow reporting-oriented contracts as a temporary bridge
- people lifecycle, target distribution, incentives, and challenge logic do not yet have first-class backend domain boundaries

## Decision
Do **not** do a large rewrite.

Do a short architecture alignment pass, then continue with feature development.

This means:
- preserve the current foundation
- formalize domain boundaries before heavy feature growth
- introduce shared workflow concepts deliberately
- avoid building multiple future modules on top of temporary route-level assumptions

## Preserve As-Is
These parts should be treated as stable foundations and should not be rethought unless there is a strong reason:

### Backend Structural Foundations
- NestJS modular monolith shape
- `ops / stg / rpt / audit` separation
- JWT + role + scope auth direction
- audit-first thinking for operational mutations
- additive backend endpoint evolution instead of mutating old semantics

### Frontend Structural Foundations
- admin shell:
  - `/admin/*`
- store shell:
  - `/store/*`
- auth shell:
  - `/auth/*`
- role-aware shell landing
- bearer token in `sessionStorage`
- `401` session-expiry handling

### Product-Level Foundations
- admin and store are separate surfaces
- the product is both:
  - observe-first
  - action-capable
- scope is hierarchical:
  - company
  - region
  - store
  - person

## Align Next
These are the most important concepts to formalize before adding larger domain workflows.

### 1. Workflow Language
The current project needs explicit separation between:

- `approval`
  - real decision required
  - example:
    - target distribution approval
    - target revision approval

- `acknowledgement`
  - read/seen/accepted receipt
  - example:
    - region manager checklist seen by store manager
    - visual checklist seen by store manager

- `task`
  - a unit of action shown in a queue or inbox
  - may be generated from approvals, acknowledgements, checklist follow-up, KPI exceptions, or future challenge events

- `notification`
  - informational only
  - not necessarily actionable

If this language is not formalized now, future checklist, target, incentive, and social modules will blur together.

### 2. Domain Boundaries
The following domains should be treated as separate bounded contexts, even if implementation lands gradually:

- `identity-org`
- `people-lifecycle`
- `checklists`
- `targets`
- `approvals`
- `tasks-inbox`
- `performance`
- `incentives-rewards`
- `challenges-social`
- `config-rules`

### 3. Read Versus Action Separation
The system should consistently distinguish:

- observe surfaces
  - KPI views
  - store performance views
  - personnel performance views
  - executive visibility

- action surfaces
  - checklist submission
  - acknowledgement
  - target distribution
  - target revision
  - onboarding/offboarding events
  - future reward/challenge administration

### 4. Configurable Rule Layer
The product already points toward needing dynamic rules for:
- challenge rewards
- target approval policy
- incentive interpretation
- future configurable thresholds

This means the system should plan for a `config-rules` layer instead of baking too much behavior into hard-coded page logic.

## Refactor Now
These are the short alignment refactors that should happen before major domain-heavy expansion.

### 1. Write The Domain Blueprint
Create one durable blueprint that defines:
- main domains
- main actors
- approval vs acknowledgement rules
- shared engines
- future module relationships

This is the top priority.

### 2. Introduce Shared Workflow Vocabulary In Planning Docs
Add the terms below into project planning language and reuse them consistently:
- approval
- acknowledgement
- task
- notification

This is a documentation and modeling refactor first, not a code refactor first.

### 3. Move The Roadmap Away From Route-Only Thinking
The roadmap should stop reading mainly like:
- add route
- add screen

and start reading more like:
- define domain
- define engine
- expose surface

### 4. Keep Local Auth Claim Contract Explicit
The local Keycloak path should keep using explicit role, read-scope, and assigned-store claims. Do not reintroduce backend demo username-to-scope inference for local validation.

## Refactor Soon, But Not Immediately
These are important, but should happen after the blueprint/alignment pass.

### 1. Shared Task / Inbox Engine
Instead of each domain inventing its own list of things to do, introduce one shared task/inbox model that can later receive work from:
- approvals
- acknowledgements
- checklists
- KPI exceptions
- incentives
- challenges

### 2. People Lifecycle Event Model
Do not keep this as only onboarding/offboarding forever.
Design it to later hold:
- onboarding
- offboarding
- transfer
- promotion
- position change
- store reassignment
- leave/report
- status change

### 3. Target Distribution Domain
Target distribution should become a first-class operational domain rather than a loose page-level form concept.

### 4. Reward Catalog / Challenge Reward Design
Gamification and challenge rewards imply:
- point system
- reward catalog
- campaign rule
- claim/award trace

This should not be mixed directly into KPI pages or incentive read models later.

## Refactor Later
These are real future concerns, but they should not block the next domain-alignment step.

### 1. Production Auth Hardening
- require stable token claim contract
- move toward authorization code + PKCE
- improve provider logout handling

### 2. Reporting Contract Expansion
As operational domains mature, some store surfaces should stop borrowing reporting-style data and gain their own operational read models.

### 3. Mobile-First Workflow Optimization
Mobile is mandatory for the product, but after domain boundaries are cleaner, we should explicitly optimize:
- checklist execution
- acknowledgement flows
- target distribution actions
- lightweight inbox/task work

## Are We Safe To Continue?

### Yes
We are safe to continue from the current foundation because:
- the existing work is not wasted
- the architecture has not yet collapsed into an unmaintainable shape
- the shell split, auth direction, and schema separation all support future growth

### But With One Condition
Do not continue by piling unrelated operational logic directly into existing preview surfaces.

The next major step should be taken only after the domain blueprint and architecture alignment pass are recorded.

## Recommended Immediate Sequence
1. write the domain blueprint
2. align roadmap terminology around workflow/domain language
3. record temporary local-auth compatibility items as cleanup work
4. then choose the first real operational write flow

## Recommended First Real Operational Write Flow After Alignment
Still likely:
- target distribution / revision approval
or
- acknowledgement-backed checklist flow

But the exact choice should be made **after** the blueprint confirms domain ownership and shared workflow rules.
