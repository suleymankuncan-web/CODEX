# Domain Blueprint

## Purpose
Define the durable product/domain shape for the platform before additional domain-heavy features are implemented.

This blueprint is intended to keep the system expandable as it grows across:
- executives
- region managers
- store managers
- store personnel
- field teams such as visual merchandisers

It assumes the system is not just a dashboard, but an operational platform with:
- observation surfaces
- action surfaces
- workflow
- acknowledgements
- configurable rules
- future gamification and rewards

## Core Product Definition
The platform is a role-aware company operations system for:
- store performance visibility
- personnel performance visibility
- task/action handling
- acknowledgements
- approvals
- target distribution
- people lifecycle events
- future incentive and challenge logic

## Actor Model

### Read-Heavy Actors
- executive leadership
- deputy general managers
- senior leadership who mainly observe company/region/store health

Primary behavior:
- monitor
- compare
- review summaries
- track trends
- inspect decisions after the fact

### Action-Capable Actors
- region managers
- store managers
- store personnel
- field teams
  - example: visual merchandisers

Primary behavior:
- submit operational work
- acknowledge received work
- distribute targets
- revise targets
- record people events
- complete workflow steps

## Hierarchy
The core organizational scope is:
- company
- region
- store
- person

Canonical hierarchy:
- Company -> Region -> Store -> Person

This scope hierarchy should be considered foundational and reused across:
- auth/scope
- task assignment
- approvals
- targets
- performance
- challenges

## Domain Map

### 1. Identity And Organization
Owns:
- users
- roles
- permissions
- scope bindings
- company/region/store/person hierarchy references

Examples:
- which region manager sees which stores
- which store manager can distribute targets for which team
- which field role can submit which checklist

Does not own:
- performance metrics
- approvals themselves
- tasks themselves

### 2. People Lifecycle
Owns:
- onboarding
- offboarding
- transfer
- promotion
- position change
- store reassignment
- leave/report
- status change

Important modeling rule:
- even if only onboarding/offboarding is implemented first, the event model should be able to grow into the other lifecycle events without redesign

### 3. Checklists
Owns:
- checklist templates
- checklist runs/submissions
- checklist findings
- checklist follow-up requirements
- field execution records

Examples:
- region manager store visit checklist
- visual checklist

Important rule:
- checklist receipt by store manager is not necessarily an approval
- it may be an acknowledgement

### 4. Targets
Owns:
- target definitions
- target allocation chain
- target revision requests
- target distribution history

Canonical flow:
1. top-level target arrives
2. region manager distributes to stores
3. store manager distributes to personnel
4. region manager approves

This is a true workflow/approval domain.

### 5. Approvals
Owns:
- decision-required workflow state
- approver assignment
- approve/revise/reject semantics where rejection truly exists
- approval history
- approval audit trace

Should be used for:
- target distribution approval
- target revision approval
- future decision-heavy operational flows

Should not automatically be used for:
- read/seen/accepted receipt flows

### 6. Acknowledgements
Owns:
- seen/read/accepted receipt state
- acknowledgement timestamp
- acknowledgement actor
- acknowledgement note if needed

Canonical examples:
- store manager receives and acknowledges a region checklist
- store manager receives and acknowledges a visual checklist

Important product rule:
- acknowledgement is not approval
- acknowledgement does not imply authority to reject

### 7. Tasks And Inbox
Owns:
- unified action queue
- action origin
- action type
- action status
- due dates / urgency
- assignee

Task sources may include:
- approvals
- acknowledgements
- checklist follow-up
- KPI exceptions
- people lifecycle actions
- challenge/reward actions later

This should become a shared engine, not a feature-specific list in each module.

### 8. Performance
Owns:
- normalized performance model
- person-level performance views
- store-level performance views
- derived operational scores

Supports two data paths:
1. imported raw metrics from external systems
2. internally derived calculations/rules

Important architectural rule:
- performance views are not the same thing as workflow
- but workflow can consume performance signals

### 9. Incentives And Rewards
Owns:
- incentive visibility
- reward catalog
- reward rule interpretation
- campaign reward definitions
- reward history

Should be designed to support:
- changing reward types over time
- non-fixed reward definitions
- operational linking from challenge points to rewards

Examples:
- gift card
- product
- temporary campaign reward

### 10. Challenges And Social
Owns:
- challenge definitions
- point accrual
- league/competition state
- social interaction surfaces
- future feed-style interactions

Potential examples:
- region leagues
- store competitions
- personnel challenges
- social feed / reactions / recognition

Important rule:
- challenge points may later affect rewards
- so this domain should connect to incentives, but should remain conceptually separate

### 11. Config And Rules
Owns:
- dynamic rule definitions
- thresholds
- campaign settings
- configurable mappings
- mutable reward policy

This domain exists because future business logic is expected to change often without reshaping the whole application.

## Workflow Language
This language should be reused consistently across product and engineering decisions.

### Approval
Use when:
- someone with authority must make a real decision

Examples:
- target distribution approval
- target revision approval

### Acknowledgement
Use when:
- the receiver is only confirming they saw/accepted the item

Examples:
- store manager sees field checklist
- store manager sees visual checklist

### Task
Use when:
- work must appear in a queue and be acted on

Examples:
- pending approval
- required acknowledgement
- target revision action
- checklist follow-up

### Notification
Use when:
- the user should be informed, but action is not mandatory

Examples:
- system alert
- awareness-only broadcast

## Read Versus Action Surfaces

### Observe Surfaces
These are primarily visibility-driven:
- executive summaries
- store performance pages
- personnel performance pages
- reporting dashboards
- comparison views

### Action Surfaces
These are operational:
- checklist submission
- acknowledgement handling
- target distribution
- target revision
- lifecycle event submission
- approval handling
- reward/challenge administration later

Important rule:
- do not mix heavy write logic into pure visibility surfaces

## Shell Placement Guidance

### Admin Shell
Best for:
- platform controls
- cross-store visibility
- governance
- audit
- configuration
- approvals that require broader oversight
- reporting-heavy views

### Store Shell
Best for:
- focused operational work
- received acknowledgements
- daily team action
- store-level tasks
- lightweight write flows

Important rule:
- store shell should feel task-first and operational
- admin shell should feel control-plane and oversight-first

## Data Flow Model

### External Data In
Expected:
- raw metrics may arrive from external systems such as Nebim
- imported data lands in staging
- normalized into operational/reporting models

### Internal Interpretation
Expected:
- performance scoring
- target logic
- rewards
- challenge points
- operational flags

This means the platform should support both:
- importing already-calculated data
- calculating internal derived meaning on top of raw inputs

## Mobile Requirement
Mobile is not optional.

Implication:
- future action flows should be designed mobile-first where relevant
- especially:
  - checklist execution
  - acknowledgements
  - target distribution review
  - task handling

Desktop can remain important for:
- admin oversight
- audit
- reporting
- config/rules

## Recommended First Domain-Heavy Implementations
After alignment, the first real write flow should come from one of these:

1. Target distribution + approval
Reason:
- true approval flow
- central to store operations
- directly tied to performance and incentive future

2. Checklist acknowledgement flow
Reason:
- fits store shell naturally
- introduces acknowledgement as a first-class workflow type

Priority recommendation:
- start with target distribution + approval if approval engine shape is the immediate goal
- start with checklist acknowledgement if store shell daily behavior is the immediate goal

## What This Blueprint Protects Against
- turning every workflow into a generic approval
- mixing reporting and operational actions into the same contract
- building feature-by-feature route logic without shared engines
- forcing future reward/challenge logic into KPI pages
- under-modeling people lifecycle too early
- locking the product into desktop-only assumptions

## Immediate Follow-Up
This blueprint should be used to produce:
1. a domain alignment checklist
2. a first shared workflow engine outline
3. a decision on the first real write/action flow
