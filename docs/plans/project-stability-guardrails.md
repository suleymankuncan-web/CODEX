# Project Stability Guardrails

## Purpose
This document defines the practical guardrails that should keep the project from drifting into confusion as it grows.

The project is expected to evolve gradually and deliberately.
The goal is not fast accumulation of features.
The goal is controlled growth without architectural decay.

## Core Principle
Do not let speed outrun structure.

Every important addition should make the system:
- clearer
- more durable
- easier to extend
- easier to reason about later

## Guardrail 1: Place Before Build
Before implementing a feature, decide:
- which module owns it
- which shell exposes it
- which schema holds it
- which auth/scope rules apply
- whether it affects reporting, audit, or async flow

If placement is unclear, implementation should wait.

## Guardrail 2: Prefer Additive Change
When possible, prefer:
- new endpoint
- new read model
- new route
- new table
- new workflow step

over changing the meaning of existing behavior.

Silent semantic mutation creates long-term confusion.

## Guardrail 3: Keep A Single Owner
Every important capability must have a primary owner.

Examples:
- auth owns auth rules
- reporting owns reporting reads
- integration owns import lifecycle
- snapshot owns snapshot generation lifecycle

Shared usage is fine.
Shared ownership is not.

## Guardrail 4: Respect Shell Boundaries
Do not mix:
- admin surface
- store-user surface

If a feature is for governance, operations, or platform control, it belongs in `admin`.
If a feature is for day-to-day store action or store visibility, it belongs in `store`.

## Guardrail 5: Protect Schema Meaning
The current schema model:
- `ops`
- `stg`
- `rpt`
- `audit`

should stay semantically clean.

Do not add schemas casually.
Do not weaken existing schema meaning by forcing mixed-purpose tables into them.

## Guardrail 6: Scope Must Be Explicit Everywhere
Every new feature should be checked for:
- who can see it
- who can trigger it
- which company scope applies
- which region scope applies
- which store scope applies

Scope should not exist only in the UI.
It must hold in backend policy and query behavior too.

## Guardrail 7: Audit Important Actions Early
If a feature can later create operational confusion, add audit thinking early.

Especially for:
- mutations
- retries
- reruns
- grants/revokes
- approvals
- incentive-impacting actions

It is easier to build traceability in than bolt it on later.

## Guardrail 8: Reporting Must Not Become A Logic Dump
`rpt` exists to support reading, summaries, and snapshot output.

Do not use reporting as a shortcut for business rule ownership.
Operational truth belongs elsewhere.
Reporting should consume truth, not redefine it.

## Guardrail 9: Write Down Important Decisions
If a decision affects future structure, document it.

Examples:
- new module placement
- shell ownership
- schema expansion
- auth contract
- integration principle

Future clarity is worth the small documentation cost.

## Guardrail 10: Correct Boundaries Early
If a feature starts growing in the wrong place:
- move it early
- rename it early
- redraw the boundary early

The longer a wrong placement survives, the more expensive it becomes to fix.

## Guardrail 11: New Requests Should Be Interpreted, Not Just Executed
A request should first be examined for:
- real intent
- hidden future impact
- best module fit
- safest implementation shape

Do not treat every request as a direct coding instruction.

## Guardrail 12: Integration Should Use Contracts
As modules begin to interact more:
- use explicit contracts
- use explicit identifiers
- use explicit endpoint/read-model boundaries

Avoid hidden coupling through assumptions and duplicated logic.

## Guardrail 13: Small Quality Gates Beat Big Late Rescue
After meaningful changes, keep lightweight discipline:
- build passes
- targeted tests pass
- auth/scope impact checked
- audit impact checked
- performance risk noted if relevant

The project should not depend on one giant cleanup phase later.

## Guardrail 14: Design For Future Integration Without Overbuilding
Assume future integration with:
- KPIs
- incentives / `prim`
- approvals
- store-user workflows
- reporting

Do not build all of that now.
But do not choose a shape that blocks those later.

## Guardrail 15: Keep The System Explainable
At any point, we should still be able to answer clearly:
- where does this live?
- who owns it?
- who can use it?
- how is it audited?
- how will it integrate later?

If those answers become fuzzy, drift has started.

## Related Documents
Use these guardrails together with:
- [request-intake-and-decision-policy.md](./request-intake-and-decision-policy.md)
- [cross-module-integration-principles.md](./cross-module-integration-principles.md)
- [schema-expansion-guidelines.md](./schema-expansion-guidelines.md)
- [new-module-template.md](./new-module-template.md)
- [phase-7-shell-boundaries.md](./phase-7-shell-boundaries.md)

## Expected Outcome
If these guardrails are followed consistently:
- the project should grow slower but better
- future changes should cause less confusion
- new modules should integrate more cleanly
- the system should stay understandable even as it becomes richer
