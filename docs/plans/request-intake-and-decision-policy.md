# Request Intake And Decision Policy

## Purpose

This document records a standing working agreement for future feature requests in this project.

The goal is to avoid:

- rushed implementation
- repeated rework
- feature drift
- avoidable confusion after a first implementation lands

## Core Rule

When a new request arrives, do **not** jump straight into implementation by default.

Instead, the request should first be:

1. interpreted
2. challenged
3. scoped
4. placed into the right module and shell
5. checked for data, auth, reporting, and future integration impact
6. then implemented in the most durable form

## Feature Intake Interview Gate

For every meaningful new feature, workflow, data model, route, permission, or integration, run a short interview before implementation.

The interview is not bureaucracy. It is the project safety gate that prevents a local-looking change from breaking auth, reporting, audit, import, KPI, or store-user behavior later.

The default interview has six required questions:

### 1. Who is this for?

- which user role owns the workflow?
- is the actor an admin, region manager, store manager, store personnel, auditor, integration operator, or system job?
- is this a read-only need, an operational action, an approval, or an acknowledgement?

### 2. What exact problem are we solving?

- what real-world task becomes easier or safer?
- what is the current workaround or pain?
- what should the user be able to do after this exists?
- what should stay explicitly out of scope?

### 3. What permission and scope boundary applies?

- which roles can see it?
- which roles can act on it?
- does it use read scope, action scope, or both?
- does it depend on `assignedStoreIds`, company, region, store, employee, or role catalog state?
- what should happen for an unauthorized but authenticated user?

### 4. What data does it touch?

- which schema owns the data: `ops`, `stg`, `rpt`, or `audit`?
- is the data operational, imported, derived, or immutable snapshot data?
- does it need history/versioning?
- does it need source system, external id, batch id, job id, or correlation id?
- will it mutate existing records or create additive records?

### 5. What existing flows does it connect to?

- import/materialization
- KPI calculation or grading
- checklist workflow
- target distribution
- shared inbox/tasks
- reporting snapshots
- audit trail
- async workers/queues
- frontend admin shell or store shell

### 6. How do we know it is correct?

- what is the expected success path?
- what are the failure, empty, unauthorized, and conflict states?
- what tests are required?
- does it need a smoke check, release check, or browser verification?
- which documentation or handoff file must be updated?

## Required Interview Output

Before implementation starts, the working note should be clear enough to answer:

- chosen module or bounded context
- affected frontend shell or route
- data owner and persistence shape
- role/scope/action rules
- audit and correlation requirement
- integration/reporting impact
- tests and verification commands
- next logical step after completion

If these answers are not known, stop and ask the user more questions before coding.

## Intake Decision Gates

Use these gates before implementation starts. They do not replace the interview;
they decide whether the work is ready to proceed.

### Hard Stop

Stop before coding if any of these are true:

- API, auth, scope, DB, scoring, or workflow contract is unclear.
- Fake or representative data would be presented as real product data.
- Rollback cannot be done by reverting the PR and no rollback plan exists.
- Affected route, service, or test scope is not written.
- A domain decision is not linked to current-state, a decision registry, or the
  relevant domain document.

### Soft Warning

Continue only with an explicit note if any of these are true:

- A small UI change lands in a large file, but it does not introduce a new
  domain decision model.
- Full e2e runtime is approaching 8 minutes, but there is no flake evidence.
- A refactor candidate exists, but the new behavior is already characterized.

## Decision Owners

Decision owners are review lenses, not a new approval system. Use the matching
owner when a request touches that domain:

- Store/Admin UI: frontend owner + role/route parity reviewer.
- Store KPI: KPI/scoring domain owner + backend contract reviewer.
- Store Tasks / Store Action: workflow/action lifecycle owner.
- Workforce: auth/scope/audit owner.
- Reporting: reporting read-model owner.
- Integration / Import: source adapter/import lifecycle owner.
- E2E / Release Gate: release verification owner.
- Decision Registry / Current State: domain decision owner.

## Affected Verification And Release Gate

Every meaningful feature PR should state the affected verification matrix before
coding starts:

- frontend lint/build
- targeted Playwright, component, or e2e checks
- backend targeted test/build
- API/OpenAPI check when API shape can be affected
- root release gate when the change has broad surface impact

Smoke, affected, and full checks may be separated for PR preflight, but they do
not replace the release gate. Affected verification proves the changed surface;
the release gate protects the product. If full e2e runtime rises above 8
minutes, record a warning. If it rises above 10 minutes, open a test
decomposition plan instead of weakening the gate.

## PR Description Checklist

Use this checklist in PR descriptions for meaningful feature work:

```markdown
## Feature Intake

- [ ] Feature domain:
- [ ] Triggered guardrail:
- [ ] Affected route/page/service/API:
- [ ] API/auth/DB/scoring/workflow contract impact: unchanged / changed
- [ ] Decision registry/current-state/domain doc updated?
- [ ] Did this add a new decision model to a large file?
- [ ] If extraction is needed, was it separated from the feature PR?

## Affected Verification

- [ ] Frontend lint/build:
- [ ] Targeted Playwright/component/e2e:
- [ ] Backend targeted test/build:
- [ ] API/OpenAPI check:
- [ ] Root release gate:

## Rollback

- [ ] Is PR revert sufficient?
- [ ] Is data repair, migration rollback, or queue drain required?
```

## Refactor Boundary

Open a refactor when:

- new behavior creates a third or fourth decision model in the same file
- current behavior cannot be understood without characterization
- the same domain logic repeats across two routes or services
- review can no longer evaluate the change safely
- the PR no longer has one review story

Do not open a refactor when:

- the file is long only
- the change is aesthetic only
- behavior is not characterized yet
- the feature and a large extraction would land in the same PR
- the goal is to weaken a guard before the guard failure is understood

## CODEX DÜRÜST YORUM

For every meaningful new module, feature, workflow, data model, route, permission, or integration, include a short section titled `CODEX DÜRÜST YORUM` before implementation starts.

This section is not a motivational summary. It is the explicit product and engineering risk opinion.

It should answer:

- does this feature belong in the product now?
- is the proposed module boundary the right one?
- are we accidentally building a second source of truth?
- are we solving the real user need or only the first suggested implementation?
- will this create avoidable technical debt?
- what should stay out of V1 so the module does not sprawl?
- would Codex recommend continuing, reshaping, postponing, or rejecting the idea?

The comment should be candid. If the current direction feels technically possible but product-wrong, say so before code is written.

## Standing Instruction

For this project, the preferred behavior is:

- do not optimize for fastest implementation
- optimize for the most stable and expandable implementation
- assume that a request may later need:
  - refinement
  - extension
  - integration with another module
  - UX separation between admin and store-user surfaces

## Required Thought Process For New Requests

Before implementing any meaningful feature, answer these questions internally:

### 1. What is the real request?

- what is the user actually trying to achieve?
- is the first suggested implementation really the right one?
- is this a feature, a rule change, a UI convenience, or a domain expansion?

### 2. Where does it belong?

- which bounded context owns it?
- does it belong to:
  - admin shell
  - store-user shell
  - shared backend domain
  - reporting only
  - operational workflow only

### 3. What does it affect?

- `ops`
- `stg`
- `rpt`
- `audit`
- auth/scope
- async workers
- existing frontend routes

### 4. What future changes are likely?

- will this probably get more fields later?
- will this later need approvals?
- will it later affect KPIs, reporting, or incentives?
- will this later need store-level visibility?

### 5. What is the safest implementation shape?

- should it be a new module?
- should it be a new endpoint instead of changing an old one?
- should it be versioned or history-aware?
- should it be additive rather than mutating existing semantics?

## Implementation Policy

After analysis:

- choose the cleanest durable shape, not the quickest patch
- prefer additive designs over fragile rewrites
- keep module boundaries readable
- avoid mixing unrelated concerns into existing files just because they are nearby
- if a request has hidden tradeoffs, surface them before coding

## Communication Policy

When a new feature request comes in:

- first explain the interpreted request and likely impact area
- ask the feature intake interview questions that are still unknown
- include a `CODEX DÜRÜST YORUM` section for meaningful module or feature decisions
- then outline the most appropriate implementation direction
- then implement

Only skip this deeper intake for very small, low-risk changes, such as typo fixes, comment-only edits, or purely local copy changes. If a change touches auth, role/scope, data persistence, reporting, import, KPI, audit, or workflow behavior, do not skip the interview.

## Integration Policy

Every new feature should be evaluated as if it may later need to integrate with:

- auth
- reporting
- audit
- approvals
- KPI logic
- incentive logic
- store-user surfaces

That does **not** mean overbuilding immediately.
It means avoiding shapes that block future integration.

## Practical Rule For This Project

From this point forward:

- new requests should be deeply evaluated before implementation
- feature placement matters as much as feature delivery
- avoid “just add it somewhere” decisions
- prefer deliberate structure over speed when the decision has long-term impact

## Relationship To Other Planning Docs

This file is the source of truth for feature and request intake. Other
checklists may support this policy, but they must point back here and cannot
override it.

This policy should be used together with:

- [feature-integration-spine-v1.md](./feature-integration-spine-v1.md)
- [new-module-template.md](./new-module-template.md)
- [feature-backlog.md](./feature-backlog.md)
- [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md)
- [phase-7-shell-boundaries.md](./phase-7-shell-boundaries.md)
- [project-stability-guardrails.md](./project-stability-guardrails.md)
- [product-experience-principles.md](../process/product-experience-principles.md)
- [refactor-completion-inventory-v1.md](./refactor-completion-inventory-v1.md)

## Expected Outcome

If this policy is followed consistently:

- future requests should create less rework
- module growth should stay cleaner
- later changes should be easier to absorb
- cross-module integration should remain manageable
