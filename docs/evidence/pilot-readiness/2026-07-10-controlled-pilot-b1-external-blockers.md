# Controlled Pilot B1 External-Blocker Record - 2026-07-10

Status: blocked_external
Shelf: evidence
Evidence class: docs_decision
Assessment at: 2026-07-10T04:05:14+03:00
Assessment updated at: 2026-07-12T23:29:03+03:00

## Reader And Action

Reader:

- the owner, pilot operator, or future engineer preparing the next controlled
  pilot or patron-demo session.

After reading, they should know which B1 flows have partial owner-attested
evidence, which external input is still missing, and why this record does not
authorize a runtime change.

## Decision

The initial assessment had no fresh executable input and recorded every B1 flow
as `blocked_external`. The product owner later attested that checklist approval,
Store Action task closure, target submission, and target editing were used
successfully on 5 July 2026. Those facts are now preserved as partial positive
evidence; no issue or P0/P1 finding was reported.

The decision remains `no_runtime_change`. The attestation does not include the
persona, exact route/session, store/template/period context, negative scope
checks, screenshot, or browser trace needed to claim that every B1 acceptance
point is complete.

On 12 July, the configured `REGION_MANAGER` persona passed the canonical live
staging cookie-session smoke. This is current sanitized executable evidence for
that persona only; it does not close the other three personas or account
recovery. Source:
`docs/evidence/pilot-readiness/2026-07-12-b1-region-manager-cookie-session-evidence.md`.

Source:
`docs/evidence/pilot-readiness/2026-07-05-owner-attested-mutation-flows.md`.

## Critical Flow Record

| Record | Persona and route/workflow | Expected evidence | Actual assessment | Status and decision | External input required |
| --- | --- | --- | --- | --- | --- |
| B1-20260710-01 | Admin, Region Manager, Store Manager, Store Personnel; login, refresh, logout, and recovery | Landing, role/scope summary, refresh/logout result | Current Region Manager staging smoke passed login, protected landing, session readback, secure cookie/storage boundaries, CSRF rejection, and logout. Account recovery was not run. | `partial_live_pass`; no finding; `no_runtime_change` | Current sanitized sessions for Admin, Store Manager, and Store Personnel, plus separate recovery evidence or an owner decision removing recovery from this boundary. |
| B1-20260710-02 | Region Manager and Store Manager; Store Home to Tasks/Store Action | Visible queue, assigned-store boundary, command result | Owner attested that a Store Action task was closed successfully on 5 July; persona, assigned-store context, queue readback, and negative scope were not captured. | `partial_owner_attested`; no finding; `no_runtime_change` | For full B1 closure: sanitized persona/route and assigned-store plus negative-scope readback. Do not rerun a mutation without explicit scope and rollback authority. |
| B1-20260710-03 | Region Manager or VM plus Store Manager; checklist visit and acknowledgement | BM/VM selection, completion, acknowledgement | Owner attested that checklist approval was used successfully on 5 July; persona, visit/template, completion detail, and acknowledgement readback were not captured. | `partial_owner_attested`; no finding; `no_runtime_change` | For full B1 closure: sanitized persona, visit/template, completion, and acknowledgement readback. Do not rerun a mutation without explicit scope and rollback authority. |
| B1-20260710-04 | Store Manager, Store Personnel, Region Manager; rankings to personnel profile | Visible rows, profile permission, direct-route denial | Not run: no current scoped sessions or approved personnel/profile test subject was supplied. | `blocked_external`; no finding or severity classification; `no_runtime_change` | Read-only current persona sessions and an approved personnel/profile subject for positive and negative checks. |
| B1-20260710-05 | Region Manager and applicable admin; reports and incentive readback | Period, roster, target, KPI, export/readback totals | Owner attested that targets were submitted and edited successfully on 5 July. Reports/incentives totals, export, period package, and persona readback were not captured. | `partial_owner_attested` supporting target-workflow evidence; no finding; `no_runtime_change` | A confirmed reporting period, approved roster/target/KPI package, and read-only role-scoped reports/incentives readback. |

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
