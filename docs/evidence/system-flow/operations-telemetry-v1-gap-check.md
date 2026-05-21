# Operations Telemetry V1 Gap Check

## Scope

This evidence closes Milestone 5 of the system-flow readiness line for now.
It checks whether `/admin/operations` needs another telemetry implementation
slice after the fanout audit.

It does not add live telemetry, change polling, add endpoints, change API
response shape, change auth behavior, change DB schema, or create alert
thresholds.

## Sokrates Decision

Decision:

- Do not add another local telemetry fetch in this milestone.
- Treat the current Operations Control Tower as the V1 live operator telemetry
  surface.
- Park auth/session runtime evidence and external/provider evidence until real
  Clerk/session/provider inputs are available.

Why:

- `/admin/operations` already composes the high-value live read-only signals
  named by the fanout audit.
- Adding more reads now would increase the main aggregator's polling pressure
  without a proven missing signal.
- The remaining gaps are either threshold/owner decisions or real external
  evidence inputs, not safe local code gaps.

Evidence:

- `docs/evidence/system-flow/fanout-bottleneck-audit-v1.md` identifies
  `/admin/operations` as the strongest telemetry host and warns against adding
  calls by default.
- `admin-web/src/pages/OperationsControlTowerPage.tsx` reads health, import
  overview, import needs-action, snapshot overview, snapshot needs-action,
  seller-code queue, offboarding queue, workflow inbox, KPI config, and
  rankings.
- All ten live operations queries use the shared `SIGNAL_STALE_TIME_MS`.
- `admin-web/e2e/operations-control-tower.spec.ts` covers read-only
  composition, `SUPER_ADMIN` scope, queue preview failure posture, health error
  posture, workforce error posture, workflow error posture, KPI/ranking error
  posture, metadata gaps, and mobile bounded width.
- `docs/plans/operations-metrics-bottleneck-readiness-v1.md` already records
  the safe internal read-only metric line as complete through PR #393.

Counterargument:

- Operators may eventually need latency percentiles, queue age, payload sizes,
  trend lines, or auth failure telemetry. Those can be valuable, but they need
  a source owner, threshold policy, and verification path before code.

Risk:

- LOW for this docs-only gap check.
- MEDIUM if a future slice adds one more read-only signal to
  `/admin/operations`.
- HIGH if future work adds backend aggregation, queue behavior, alert routing,
  auth semantics, provider configuration, DB schema, or hard SLA/SLO thresholds.

Door:

- This decision is a two-way door.
- Runtime threshold and provider evidence decisions are not.

Stop rule:

- Stop before adding a telemetry fetch unless the missing signal has an
  existing source, a named owner, a test path, and a rollback story.

## Coverage Matrix

| Signal family | Current operations source | Live in `/admin/operations` | Evidence posture | Next safe move |
| --- | --- | --- | --- | --- |
| Backend / DB / queue health | `getOperationsHealth` over public health payload | Yes | Covered by operations E2E health-error test. | No new local work unless operators need stale-age copy. |
| Integrations import pressure | `getImportOverview`, `getNeedsAction` | Yes | Covered by queue preview and unavailable-state E2E. | Measure payload/latency only with runtime evidence. |
| Snapshot readiness | `getSnapshotOverview`, `getSnapshotNeedsAction` | Yes | Covered by operations composition and snapshot panel assertions. | Add latest snapshot age only if existing data owner approves the threshold. |
| Workforce queues | `getSellerCodeRequests`, `getOffboardingRequests` with pending HR approval status | Yes | Covered by workforce unavailable-state E2E and pressure count assertions. | Queue age/overdue remains owner/threshold work. |
| Workflow inbox | `getWorkflowInbox` | Yes | Covered by workflow unavailable-state E2E and pressure count assertions. | Unseen/overdue semantics need product ownership first. |
| KPI / rankings readiness | `getKpiConfig`, `getRankings` | Yes | Covered by KPI unavailable and metadata-gap E2E. | Source certification thresholds need reporting ownership. |
| External evidence blockers | Static provider blocker list in operations page | Partly live as input-needed status | Correctly labeled as blocked/input-needed, not failed telemetry. | Convert only after real provider inputs exist. |
| Auth / role / session runtime | Auth overlay docs, auth tests, Clerk evidence runbook | No live operations metric | Correctly parked; real Clerk/persona evidence belongs to Milestone 7. | Run Clerk evidence only with real staging inputs. |

## Bottleneck Interpretation

Current conclusion:

- No additional local Operations Telemetry V1 code is justified by the static
  fanout audit.
- The most useful next telemetry work is not more UI composition. It is either
  real runtime evidence for existing surfaces or a small missing-signal slice
  with a clearly owned source.

What would justify future code:

- Operators cannot see a live signal that already exists in a safe read model.
- The signal belongs to one of the coverage matrix rows and does not require a
  new backend aggregate.
- A targeted Playwright or backend test can prove unavailable/empty/error
  behavior.
- The slice can be reverted independently.

What remains parked:

- Auth/session failure telemetry until real Clerk persona/session inputs exist.
- Provider delivery, Redis/BullMQ posture beyond current health evidence,
  upload proof, and restore proof until external inputs exist.
- Hard thresholds for queue age, staleness, latency, or ranking freshness until
  an owner decision exists.

## Milestone 6 Input

The next milestone should move to store placeholder route decisions instead of
expanding `/admin/operations` by inertia.

Focus routes:

- `/store/incentives`
- `/store/reports`
- `/store/settings`
- `/store/targets`

Preferred first move:

- Classify each route as real read-only V1, honest placeholder, or parked.
- If code is needed, keep it frontend-only and product-copy/layout scoped unless
  a real existing read model already exists.

## Verification

Docs-only gate:

- `git diff --check`
- `npm.cmd run test:scripts`

