# Continuation Decision Framework

## Purpose
Turn the current project evaluation into a practical decision filter for future work.

This document is not a generic architecture guideline.
It exists to answer three concrete questions:
- when should we keep investing in this platform?
- what must stay true for the platform to scale?
- what warning signs mean we are drifting into an expensive, fragile tool?

## Current Verdict
The project is worth continuing.

Reason:
- the platform is no longer a loose dashboard idea
- role, scope, shell, approval, and acknowledgement language are now visible in code
- two real workflows have already been proven end-to-end:
  - `targets + approval`
  - `checklists + acknowledgement`

The project should continue as a product platform, not as a page factory.

## Five Non-Negotiable Rules

### 1. New work must attach to an existing domain language
Every new feature must first be classified as one of these:
- `observe`
- `approval`
- `acknowledgement`
- `task`
- `notification`
- `config/rule`

If a new request cannot be described in that language, it needs design work before coding.

Why this matters:
- it prevents each feature from inventing its own workflow model
- it keeps inbox behavior, audit, and status language reusable

Trade-off:
- slower initial design
- much lower long-term entropy

### 2. Shared workflow behavior must beat feature-local convenience
If two flows need:
- status
- actor
- timestamps
- notes
- audit
- inbox presence

they should converge on a shared pattern before a third flow is added.

Why this matters:
- targets, checklist acknowledgement, people lifecycle, and future incentives will all want similar behavior

Trade-off:
- some feature teams will want local shortcuts
- shared shape reduces future rework

### 3. People, org, and scope are foundational data, not UI details
`company > region > store > person` must remain a first-class backend model.

Anything involving:
- assignment
- transfer
- promotion
- target distribution
- checklist visibility
- challenge participation

must rely on the same organizational truth.

Why this matters:
- if different modules invent different person/store truth, reporting and actions drift apart

Trade-off:
- more upfront modeling
- far fewer cross-module contradictions later

### 4. External metrics and internal scoring must stay explicitly separated
The platform should support both:
- imported raw performance data
- internally derived scoring, challenge points, and reward logic

These are related, but not the same layer.

Why this matters:
- imported KPIs will change over time
- internal incentive/challenge rules will change even faster

Trade-off:
- more transformation and normalization work
- much safer long-term flexibility

### 5. Mobile action flows must be treated as core, not as a later adaptation
Any store-side or field workflow should be designed as if mobile is the primary execution surface.

Why this matters:
- store managers and field users will perform real actions on phones
- desktop-first workflow design often breaks when compressed into mobile

Trade-off:
- tighter UI constraints now
- much less redesign pain later

## Red Flags

### Red Flag 1. Page-first development starts outrunning domain-first development
Symptoms:
- many new screens
- no new shared workflow terms
- logic repeated at page level

Meaning:
- the system is becoming a UI collection instead of a platform

### Red Flag 2. Approval, acknowledgement, and task semantics start to blur
Symptoms:
- "approve" used where user only needs to confirm receipt
- checklist-like flows forced into approval language
- task queues become feature-specific one-offs

Meaning:
- the product language is collapsing

### Red Flag 3. Auth fallbacks stay alive too long
Symptoms:
- local demo tolerances remain in production paths
- provider claim inconsistencies are handled ad hoc in business logic
- role/scope source of truth becomes unclear

Meaning:
- security and maintainability will both degrade

### Red Flag 4. Store, person, and target truth diverge between modules
Symptoms:
- performance uses one identity model
- people lifecycle uses another
- incentives and challenges infer membership differently

Meaning:
- data correctness becomes expensive to recover

### Red Flag 5. Mobile is postponed while write flows multiply
Symptoms:
- desktop grids and dense forms drive all decisions
- store workflows become visually heavy
- field users must zoom, scroll, and guess

Meaning:
- high-friction adoption risk

## Decision Framework For The Next Three Phases

### Phase A. Stabilize Shared Workflow Language
Continue if:
- target approval remains stable
- checklist acknowledgement remains stable
- both can be described with one shared action vocabulary

Do not jump ahead if:
- target and checklist flows still require flow-specific fixes for basic behavior

Success looks like:
- shared inbox concepts become clearer
- audit and status semantics stop spreading randomly

### Phase B. Open The Next Core Domain Carefully
Recommended candidate:
- `people lifecycle`

Continue if:
- org and scope modeling are trusted
- write flows from earlier phases are stable

Pivot if:
- people lifecycle expectations are still unclear enough that every event type means something different to each stakeholder

Success looks like:
- onboarding, transfer, promotion, reassignment, and offboarding can be expressed as structured events

### Phase C. Connect Visibility To Motivation
Recommended candidate:
- performance + incentives + challenge scaffolding

Continue if:
- imported metrics and internal scoring are explicitly separated
- reward configuration is treated as dynamic business configuration

Pivot if:
- stakeholders only want reporting, not behavior-driving workflows

Success looks like:
- performance is observable
- scoring is configurable
- rewards and challenges attach to stable inputs

## When To Continue
Continue investing if these stay true:
- new features still fit the domain blueprint
- shared workflow language gets stronger over time
- mobile action surfaces remain a design constraint
- data truth for org, people, and scope stays centralized

## When To Slow Down
Slow down and re-align if:
- three or more new features require exceptions to the same workflow rule
- a new module cannot be placed cleanly into the current domain map
- stakeholders begin describing the same object with conflicting meanings

## When To Pivot
Pivot if the product collapses into one of these:
- only read-only reporting
- mostly ad hoc form entry without reusable workflow semantics
- disconnected social/gamification ideas without operational linkage

In those cases, the current platform ambition may be too broad and should narrow.

## When To Stop
Stop only if all three become true:
- no stable product owner or process owner exists
- operational data sources cannot be kept trustworthy
- real workflow ownership inside the business never materializes

Without those, this becomes an expensive internal tool with no durable operating model.

## Practical Recommendation
The correct move is:
- continue
- but continue under architecture discipline

That means:
- no large rewrite
- no uncontrolled feature sprawl
- keep proving one workflow pattern at a time
- upgrade shared language before opening too many domains at once
