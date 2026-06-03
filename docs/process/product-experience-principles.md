# Product Experience Principles

Reader:

- an engineer, designer, product owner, or future agent modernizing Store/Admin
  surfaces without the original conversation context.

After reading, they should be able to:

- judge whether a UI prototype, redesign, or page implementation is product
  quality for this project without changing business behavior or inventing data.

## When To Use This

Use this document for:

- Store or Admin page redesigns,
- prototype-to-product implementation,
- workflow-heavy operational surfaces,
- new UI primitives or surface foundations,
- mobile action flows,
- UI review before PR.

Do not make this the fifth default read-first file for every task. The default
operating set remains `CONTRIBUTING.md`, `current-state.md`, `sokrates.md`, and
`discipline.md`. This document is mandatory only when the work changes product
experience, UI structure, page composition, interaction behavior, or visual
quality.

## Standard

The target is clean but premium: visually strong, operationally honest, compact,
and useful under repeated daily work.

Premium does not mean decorative. A visible module earns its place only when it
helps the operator understand state, compare options, decide, or act.

Reject UI that:

- looks polished while hiding missing evidence,
- adds decorative cards, gradients, hero copy, or empty visual weight,
- makes the primary decision slower,
- weakens role/scope clarity,
- replaces a real workflow state with generic motivational text,
- uses fake data to make a surface feel complete.

## Stack

Store/Admin product UI uses:

- `shadcn/ui`,
- Tailwind v4,
- lucide icons,
- the relevant shared Store/Admin surface primitives,
- `design-taste-frontend` / taste-skill as an anti-slop quality pass.

Taste-skill output is not a product decision by itself. Adapt it to operational
product UI: no marketing hero defaults, decorative-only premium elements, fake
business copy, or workflow-changing ideas.

## Data Honesty

Never invent:

- KPI scores,
- rankings,
- trends,
- coaching text,
- checklist results,
- target status,
- task/action state,
- payout or incentive values,
- notification counts,
- readiness or evidence claims.

If a real API, model, config, permission, or state source is missing, use an
honest loading, empty, error, access, or parked state. The screen may be sparse;
it must not be fake.

## Prototype To Product

A liked HTML prototype is a visual direction while the team is still exploring.
Once the user approves a prototype as the source for a production page, it
becomes the implementation contract for that slice.

Before product code:

- map every visible metric, label, status, and action to a real source,
- identify the role/persona for every toolbar item, route, tab, and action,
- define loading, empty, error, access, and mobile states,
- compare desktop and mobile screenshots against the prototype,
- remove old UI remnants rather than restyling them,
- record what behavior did not change.

For approved prototype implementation:

- start from the prototype file itself, not from the existing page shape,
- carry over the approved layout, palette, spacing, density, row/card rhythm,
  modal/drawer structure, status tones, labels, and interaction model,
- remove demo-only controls such as prototype role switchers instead of
  shipping them,
- bind every visible value and action to real API/model/config/state data,
- replace only the parts that are impossible or wrong in production because of
  real data, role scope, permission, accessibility, responsiveness, or missing
  contract,
- record every intentional visual deviation in evidence with the reason.

If the final desktop and mobile screenshots do not materially match the
approved prototype, the page is not done. "Inspired by the prototype" is not
acceptable when the task is to implement that prototype.

## Decision Latency

Decision Latency asks: how directly can the operator reach the page's primary
decision?

- `low`: the primary decision is visible in the first viewport with no required
  navigation.
- `medium`: one filter, expansion, tab, drawer, or detail context is needed.
- `high`: multiple context switches, hidden dependencies, or unclear drill-downs
  are needed.

Operational pages should trend toward low or medium. High latency is allowed
only when the workflow genuinely needs staged evidence or approval context.

## Evidence Confidence

Evidence Confidence asks: can the operator understand why the current state,
risk level, recommendation, or action state exists using visible evidence on
the page?

Use:

- `clear`: the page shows enough source, timestamp, count breakdown, reason,
  validation result, linked request, linked snapshot, audit trace, or disabled
  action reason.
- `partial`: the state is understandable but one key reason or source is hidden.
- `weak`: the page asks the operator to trust a status without visible evidence.

Weak evidence is not acceptable for workflow decisions, approvals, ranking
actions, target revision, checklist remediation, import/materialization, or
Store Action closure.

## Role-Aware Visibility

A user should see only the routes, navigation items, tabs, actions, and detail
links that match their role and scope.

Frontend visibility is not authorization. Backend permission and scope checks
remain the source of truth. UI work may hide impossible actions, but it must not
widen access or imply an action is available when the backend rejects it.

## Operational Layout

Prefer:

- compact KPI/status cards with real evidence,
- dense but readable tables and lists,
- clear filters that do not dominate the page,
- one primary action per workflow area,
- badges that explain status without shouting,
- details that open only when the operator needs evidence or action controls,
- short labels over long explanatory paragraphs.

Avoid:

- hero pages for operational tools,
- nested cards,
- repeated summary cards that say the same thing,
- wide empty table gutters,
- decorative charts with unclear decision value,
- large typography inside compact operational panels,
- visible internal handoff/debug/release copy.

## Mobile Action Surfaces

Mobile is not a compressed desktop table.

For mobile Store/Admin action flows:

- keep the list readable first,
- use drawer-style detail panels when a row needs notes, evidence, or action
  controls,
- use dialogs for confirmation or short blocking decisions,
- avoid horizontal table overflow unless the data is truly tabular and the user
  benefits from comparison,
- keep primary action, status, and evidence visible without text overlap.

Drawers, modals, and tabs are interaction tools, not decoration. Choose the one
that reduces decision latency and preserves evidence confidence.

## Done Criteria

A UI/product slice is done only when:

- it uses real data or honest states,
- it preserves API, auth, permission, scoring, queue, import, approval, and
  workflow semantics,
- role navigation and actions match scope,
- old UI remnants are removed from migrated surfaces,
- desktop and mobile visual QA are recorded when the surface is user-facing,
- verification matches the risk level,
- the PR states what did not change and how to roll back.
