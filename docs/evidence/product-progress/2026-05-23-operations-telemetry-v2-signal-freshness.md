# Operations Telemetry V2 - Signal Freshness Slice

Date: 2026-05-23
Status: locally verified
Track: Project Growth Execution Roadmap V1 / Track 3

## Sokrates Decision

Claim:

- The safest next Operations Telemetry V2 slice is not a new observability
  platform. It is a read-only signal freshness and queue pressure panel inside
  the existing Operations Control Tower.

Assumption:

- The current page already loads the right source payloads for a useful
  operator view: health, import overview, import needs-action, snapshot
  overview, snapshot needs-action, workforce requests, workflow inbox, KPI
  config, and rankings.

Evidence:

- `/admin/operations` already composes these existing reads.
- The new slice derives family-level status, open pressure, source link, and
  last observed timestamp from those payloads only.
- No backend endpoint, API response shape, auth policy, DB schema, provider
  config, alert delivery, or queue posture is changed.

Counterargument:

- This is not true live telemetry. It cannot prove production latency,
  external delivery, or provider-side incident behavior.

Decision:

- Proceed as a Control Tower visibility slice. Keep provider/live telemetry
  claims parked until real runtime/provider evidence exists.

## Covered Signal Families

| Family | Source | Output |
| --- | --- | --- |
| Import | import overview + needs-action | open pressure + latest batch timestamp |
| Snapshot | snapshot overview + needs-action | open pressure + latest run/date timestamp |
| Workforce | seller-code + offboarding reads | HR queue pressure + latest request timestamp |
| Workflow | workflow inbox | needs-attention pressure + latest inbox timestamp |
| KPI / rankings | KPI readiness + rankings source | readiness pressure + source period end |

## Verification Plan

- `npm.cmd --prefix admin-web run lint` - pass
- `npm.cmd --prefix admin-web run build` - pass
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts` -
  pass, 9 tests
- `node --test scripts/file-size-guard.test.mjs` - pass
- `npm.cmd run test:scripts` - pass, 322 tests
- `git diff --check` - pass

## File Size Outcome

- `OperationsControlTowerPage.tsx` dropped from the frozen 1025-line baseline
  to 945 lines after extracting the data-quality signal panel and hero panel.
- The file-size guard baseline was lowered accordingly so future work cannot
  silently grow back to the older cap.

## Guardrails

- Do not call this live telemetry.
- Do not add provider config.
- Do not change alert semantics.
- Do not change backend contracts, auth semantics, queue posture, DB schema, or
  user workflow behavior.
