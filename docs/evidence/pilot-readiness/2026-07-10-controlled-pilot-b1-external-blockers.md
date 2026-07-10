# Controlled Pilot B1 External-Blocker Record - 2026-07-10

Status: blocked_external
Shelf: evidence
Evidence class: docs_decision
Assessment at: 2026-07-10T04:05:14+03:00

## Reader And Action

Reader:

- the owner, pilot operator, or future engineer preparing the next controlled
  pilot or patron-demo session.

After reading, they should know which five B1 flows still need a fresh session,
which external input unlocks each one, and why this record does not authorize a
runtime change.

## Decision

No B1 critical flow was executed in this assessment. Each flow is recorded as
`blocked_external`, not as a passed flow, a product defect, or an absence of a
defect. The decision is `no_runtime_change`: keep the runtime train parked
until a real or explicitly approved assisted session creates factual evidence.

Earlier July pilot evidence remains useful historical context, but it cannot
close this fresh pass because current personas, store assignments, templates,
period data, and mutation authority were not reverified.

## Critical Flow Record

| Record | Persona and route/workflow | Expected evidence | Actual assessment | Status and decision | External input required |
| --- | --- | --- | --- | --- | --- |
| B1-20260710-01 | Admin, Region Manager, Store Manager, Store Personnel; login, refresh, logout, and recovery | Landing, role/scope summary, refresh/logout result | Not run: no approved current browser sessions were in scope. | `blocked_external`; no finding or severity classification; `no_runtime_change` | Sanitized assisted sessions for the four personas, with consent to observe refresh and logout. |
| B1-20260710-02 | Region Manager and Store Manager; Store Home to Tasks/Store Action | Visible queue, assigned-store boundary, command result | Not run: no current assigned-store context or explicit command mutation/rollback authority was provided. | `blocked_external`; no finding or severity classification; `no_runtime_change` | One assigned store, approved command state, explicit mutation scope, and a named rollback owner. |
| B1-20260710-03 | Region Manager or VM plus Store Manager; checklist visit and acknowledgement | BM/VM selection, completion, acknowledgement | Not run: no current template, visit, or approved completion/acknowledgement action was in scope. | `blocked_external`; no finding or severity classification; `no_runtime_change` | Current pilot template/visit, allowed personas, and written completion/acknowledgement plus rollback approval. |
| B1-20260710-04 | Store Manager, Store Personnel, Region Manager; rankings to personnel profile | Visible rows, profile permission, direct-route denial | Not run: no current scoped sessions or approved personnel/profile test subject was supplied. | `blocked_external`; no finding or severity classification; `no_runtime_change` | Read-only current persona sessions and an approved personnel/profile subject for positive and negative checks. |
| B1-20260710-05 | Region Manager and applicable admin; reports and incentive readback | Period, roster, target, KPI, export/readback totals | Not run: no verified current period package or role-scoped browser session was supplied. | `blocked_external`; no finding or severity classification; `no_runtime_change` | A confirmed reporting period (prefer the current June close when applicable), approved roster/target/KPI package, and read-only persona sessions. |

## Required Evidence Record When Unblocked

For any flow that is later executed, record a stable finding ID only if an
observation creates a finding. The session record must include the Istanbul
timestamp, persona, exact route or workflow, business period when relevant,
expected result, actual result, sanitized evidence reference, severity, and
one decision: `stop`, `fix`, `park`, or `no_change`.

Classify a real issue exactly once as P0, P1, P2, P3, or `needs_evidence`.
P0 pauses the pilot. A P1 may open only a separate approved finding-specific
spec with role/scope coverage and a rollback story. P2 and P3 remain parked
unless separately approved.

## Safe Unblock Sequence

1. The owner names the session type: read-only B1-R or explicitly approved
   mutating B1-C.
2. The operator provides access only through an approved authenticated browser
   session; do not put tokens, cookies, passwords, personal data, or provider
   secrets in this record or chat.
3. For a B1-C flow, record the exact permitted mutation, store/template/period,
   rollback action, and rollback owner before the action starts.
4. Capture only sanitized screenshots, traces, or readbacks; classify any real
   observation before proposing code.
5. If inputs remain unavailable, leave this record `blocked_external` and do
   not infer a runtime defect from the missing evidence.

## Boundary

This record does not reopen broad production, mobile implementation, a new
module, a generic refactor, or a runtime fix. It also does not mutate any
pilot, checklist, Store Action, target, incentive, report, or identity data.
