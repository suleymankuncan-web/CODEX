# Operations Workflow Inbox Pressure V1

## Decision

Promote the existing `/api/workflow/inbox` read model into `/admin/operations`
as a live, read-only workflow pressure signal.

## Why

The executive flow and operations metric map identify workflow inbox pressure as
one of the remaining places where operator work can pile up without being
visible in the control tower. The project already has a generated frontend
client and an admin/store inbox surface, so this can be exposed without adding a
backend aggregate endpoint.

## Scope

- Add a Workflow metric card to `/admin/operations`.
- Add a Workflow operator action when the inbox has `needs_attention` items.
- Add a read-only Workflow inbox pressure panel with needs-attention, high
  urgency, total count, and a small preview.
- Mark Workflow Inbox as live in the metric coverage map.

## Guardrails

- No backend endpoint was added.
- No API response shape changed.
- No auth, permission, DB, provider, workflow command, target approval,
  checklist acknowledgement, or KPI exception behavior changed.
- Workflow failures render as unavailable and do not contribute partial counts
  to operator pressure or action recommendations.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts`
- `npm.cmd --prefix admin-web audit --omit=dev`

## Remaining Risk

This uses the current inbox response as a read signal. SLA/overdue semantics,
unseen counts, aging thresholds, and alerting rules remain parked until product
ownership defines those thresholds.
