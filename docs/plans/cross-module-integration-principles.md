# Cross-Module Integration Principles

## Purpose
This document defines how separate modules should integrate over time without collapsing into a tangled system.

It exists because the project is expected to grow with modules such as:
- incentives / `prim`
- richer KPI families
- approvals
- store-user workflows
- expanded reporting

## Goal
Allow modules to work together while preserving:
- ownership clarity
- change safety
- auditability
- scope correctness
- future refactorability

## Principle 1: Every Capability Has A Primary Owner
Even when multiple modules use the same concept, one module must own the source-of-truth behavior.

Examples:
- auth owns identity, role, permission, and scope rules
- integration owns import batch lifecycle
- snapshot owns generated reporting runs
- reporting owns read models, not business write rules

Integration should consume ownership, not blur it.

## Principle 2: Shared Concepts Must Not Mean Shared Chaos
Some concepts will appear in multiple places:
- company
- region
- store
- employee
- KPI
- checklist
- snapshot run

That does not mean every module should freely edit their meaning.

Rules:
- define meaning once
- reuse identifiers consistently
- do not duplicate semantics casually across modules

## Principle 3: Reporting Reads Operational Truth, But Does Not Replace It
`rpt` is for read-optimized and snapshot-oriented output.

Rules:
- reporting can aggregate and reshape
- reporting should not become the place where operational business rules are authored
- do not move write-time business logic into reporting queries just because it is convenient

## Principle 4: Integration Should Be Additive First
When connecting modules, prefer:
- new endpoint
- new read model
- new workflow step
- new event/audit trail

over risky mutation of existing meaning.

This keeps old behavior stable while new cross-module behavior is introduced.

## Principle 5: Auth And Scope Apply Everywhere
Any module that exposes data or actions must be checked for:
- role access
- company scope
- region scope
- store scope

Cross-module integration is incomplete if scope enforcement only exists in one layer.

It must hold in:
- backend policy
- query filtering
- route exposure
- shell visibility

## Principle 6: Audit Is A First-Class Integration Surface
When modules begin to work together, audit matters more, not less.

Every meaningful cross-module action should remain traceable:
- who triggered it
- what changed
- which module initiated it
- which downstream entity was affected
- which correlation id ties the flow together

## Principle 7: UI Integration Must Respect Shell Boundaries
Not every integrated backend flow belongs in the same frontend shell.

Rules:
- admin workflows stay in `/admin`
- store-user workflows stay in `/store`
- do not use integration as a reason to collapse the two shells into one navigation model

## Principle 8: Future Growth Should Be Assumed, Not Ignored
Before connecting modules, ask:
- will this later require approval?
- will this later affect KPI scoring?
- will this later affect incentives?
- will this later appear in reporting?
- will this later be visible to store users?

The right answer is not to build everything now.
The right answer is to avoid an implementation shape that makes those additions painful.

## Principle 9: Prefer Contracts Over Implicit Coupling
When one module depends on another, integration should happen through explicit contracts:
- endpoint contracts
- repository boundaries
- DTOs
- snapshot/read-model contracts
- documented field meaning

Avoid coupling through:
- hidden shared assumptions
- copy-pasted business rules
- reaching into another module’s internals without a clear boundary

## Principle 10: History Matters
Integrated systems often need backtracking.

So for important cross-module flows:
- keep identifiers stable
- preserve audit history
- prefer history-aware or replayable designs where it matters
- make reprocessing possible when imports, snapshots, or derived metrics change

## Practical Integration Checklist
Before integrating two modules, verify:
- which module owns the rule
- which data layer is affected:
  - `ops`
  - `stg`
  - `rpt`
  - `audit`
- which shell should expose it:
  - `admin`
  - `store`
- what auth/scope rules apply
- what audit trail is required
- whether the integration is additive or mutating
- whether future KPI / incentive / approval links are likely

## Warning Signs
Integration is going in the wrong direction if:
- the same rule is duplicated in multiple modules
- reporting starts owning business write logic
- shell boundaries get blurred
- one new feature requires editing unrelated modules everywhere
- auth and scope checks exist only in the UI
- audit becomes incomplete once workflows span modules

## Expected Outcome
If these principles are followed:
- new modules can connect without becoming tangled
- future change requests should be easier to absorb
- reporting, auth, audit, and workflow features can evolve together
- the project can scale into richer product behavior without architectural drift
