# Operations KPI Ranking Readiness V1

## Decision

Promote the existing reporting read models into `/admin/operations` as a
read-only KPI/ranking readiness signal.

## Why

The executive flow and operations metric map identified KPI source trust and
leaderboard freshness as a remaining blind spot. The repo already exposes
published KPI config metadata and monthly ranking source metadata, so the
control tower can show that posture without adding a backend aggregate or
changing scoring.

## Scope

- Add a KPI / Rankings metric card to `/admin/operations`.
- Add a read-only KPI/ranking readiness panel showing published config version,
  published timestamp, leaderboard period, leaderboard population, and available
  periods.
- Mark KPI / Rankings as live in the metric coverage map.

## Guardrails

- No backend endpoint was added.
- No API response shape changed.
- No auth, permission, DB, provider, ranking score, KPI weight, leaderboard sort,
  or workflow behavior changed.
- Reporting failures render as unavailable and do not contribute partial values
  to the KPI/ranking panel.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts`
- `npm.cmd --prefix admin-web audit --omit=dev`

## Remaining Risk

The panel uses current read model metadata. SLA/overdue semantics, ranking
freshness thresholds, source certification, and alerting remain parked until the
reporting/KPI owner defines those rules.
