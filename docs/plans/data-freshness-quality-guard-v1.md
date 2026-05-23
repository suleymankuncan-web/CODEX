# Data Freshness Quality Guard V1

Date: 2026-05-23

## Purpose

Define the first reliability guard for data freshness and quality across import,
snapshot, materialization, queue/Redis, KPI source trust, workflow, workforce,
and Store Action signals.

This is a plan and inventory only. It does not add a data-quality engine,
runtime alert rules, DB schema, API response changes, or UI behavior.

## Sokrates Decision

Claim: the next data risk is not "missing metrics"; it is unclear trust in when
each operational signal was last produced and from which source.

Assumption: existing read endpoints already expose enough information to start
an operator-facing quality posture without inventing new write flows.

Evidence:

- `/admin/operations` already surfaces backend health, import, data-quality,
  snapshot/reporting, workforce, workflow, KPI/rankings, and release evidence
  categories.
- Import, snapshot, workflow inbox, reports, workforce, and Store Action read
  models already exist.
- 2026-05-23 public deployed readiness smoke shows Redis/BullMQ health as
  durable on staging.

Counterargument: a docs-only guard will not catch stale data automatically. It
only sets the source map and thresholds for the first real guard.

Risk: LOW as docs-only. MEDIUM/HIGH when thresholds begin blocking deploys or
operator actions.

Door: two-way-door for the plan. One-way-ish for alerting/page behavior that
could block operations.

Stop rule: do not create hard runtime blocks until the source owner, threshold,
expected freshness window, and false-positive handling are known.

Verification ladder:

1. Inventory the source endpoint and owner.
2. Identify current freshness/trust field if present.
3. Define warning threshold only.
4. Add read-only evidence first.
5. Promote to blocking gate only after real pilot observations support it.

## Source Inventory

| Domain | Current Signal | Candidate Freshness/Quality Fields | First Guard |
| --- | --- | --- | --- |
| Import | Import overview, needs-action, detail, reconciliation, errors, audit. | Batch status, started/finished timestamps, row counts, error counts, external IDs, mapping decisions. | Warn if latest successful import is stale for the pilot cadence or if needs-action count is non-zero before pilot run. |
| Snapshot/reporting | Snapshot overview, summary, run detail, dependencies, lineage. | Run status, materialization time, source batch/run ID, dependency state, lineage. | Warn if latest reporting snapshot is older than the intended pilot reporting window. |
| Queue/Redis | `/api/health` dependency health and queue backend. | Queue backend, durability, Redis status, latency, readiness profile. | Public health must show durable queue and Redis ok for controlled pilot smoke. |
| KPI source trust | Reports KPI metadata, leaderboard source metadata, KPI config publication metadata. | Source run, source period, config version, publication status, ranking timestamp. | Warn when KPI/ranking views cannot name the source run/config. |
| Workflow inbox | `/api/workflow/inbox` read model and Operations pressure signal. | Item type, urgency, source type, source entity, created/updated timestamps. | Warn when inbox pressure grows but source domain cannot be linked. |
| Store Action | `/api/store-actions/plans` and Store Tasks controls. | Source type, source entity, due date, status, assigned store, created/updated timestamps. | Warn when action plans have no source context or stale open/blocked items. |
| Workforce | Seller-code/offboarding queues and workforce read models. | Queue status, pending count, request timestamps, HR decision state. | Warn when pending queue age is unknown or exceeds pilot SLA. |
| Auth/session | Session readiness, auth audit, role/scope matrices. | Role, scope, action-store assignment, session result, audit event timestamp. | Warn when live persona proof is stale or missing for a widened pilot role. |

## Proposed Warning Thresholds

These are initial pilot warning thresholds, not blocking release gates:

| Signal | Warning Threshold | Blocking Threshold |
| --- | --- | --- |
| Public backend health | Any 5xx or health status not `ok`. | Immediate stop for pilot evidence run. |
| Redis/BullMQ | Queue not durable or Redis not ok. | Stop for broad production; controlled pilot needs explicit decision if degraded. |
| Import freshness | No successful import in the agreed pilot cadence. | Not blocking until cadence is formally set. |
| Snapshot freshness | Latest snapshot older than the agreed reporting window. | Not blocking until cadence is formally set. |
| Workflow inbox pressure | Needs-action count grows without source owner. | Not blocking; requires operator triage. |
| Store Action stale plans | Open/blocked plans past due without owner/action. | Not blocking; future product follow-up. |
| Protected persona evidence | Missing fresh role token proof after deploy/auth change. | Blocks widening pilot scope. |

## Evidence Output Format

Use this compact format when recording future data-quality evidence:

```markdown
## Data Freshness Quality Evidence - YYYY-MM-DD

- Environment:
- Deploy/version:
- Import latest success:
- Import needs-action:
- Snapshot latest run:
- Snapshot dependency status:
- Redis/queue status:
- KPI source/config:
- Workflow pressure:
- Store Action stale/open:
- Workforce queue pressure:
- Auth/persona evidence age:
- Blockers:
```

## Out Of Scope

- New data-quality DB tables.
- New rules engine.
- New alert provider configuration.
- Changing import lifecycle, snapshot materialization, KPI scoring, ranking
  sort, workflow states, or Store Action lifecycle.
- Treating placeholder or mock data as pilot evidence.
