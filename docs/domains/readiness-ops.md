# Readiness And Operations Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer, support operator, or future agent deciding whether the project is
  controlled-pilot ready, broad-production ready, or blocked on provider
  posture.

After reading, they should know which evidence closes controlled pilot and
which decisions remain separate broad-production No-Go items.

## Source Documents

Use these first:

- `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`
- `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`
- `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`
- `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`
- `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`
- `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`
- `docs/evidence/readiness/2026-05-23-production-ops-closure-decision-packet-v1.md`
- `docs/plans/production-evidence-closure-joint-plan-v1.md`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `docs/plans/performance-budget-v1.md`

## Active Rules

- Controlled pilot is `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- Redis/BullMQ Free-tier risk is accepted only for controlled pilot.
- Logical restore is accepted only for controlled pilot.
- Render Slack and Better Stack email proof support controlled-pilot alerting,
  not final app-level production observability.

## Parked Or High-Risk

- Production-grade Redis tier change.
- Managed Supabase restore/PITR/RPO/RTO acceptance.
- P0 trust backlog: app-level error tracking, incident ownership, rollback
  authority, security/tenant preflight, evidence expiry, and owner map.
- P1 operator/support backlog: trace policy, support diagnostics,
  troubleshooting, stale-data policy, job idempotency, data correction, import
  preview, performance escalation, role lifecycle, and metric glossary.
- P2 product-intelligence backlog: store personnel checklist exposure cleanup,
  Daily Command Brief, Command Chain Intelligence, Store Performance Replay,
  and internal change visibility.
- P3 trigger-only backlog: migration policy, dependency cadence, browser/device
  support matrix, evidence automation index, freeze windows, manual overrides,
  pilot triage cadence, and mutable Norm Kadro/staffing baseline.
- Production Ops Closure Decision Packet V1 owner acceptance rows.
- Broad-production protected persona/performance rerun after config changes.

Open those only when the owner explicitly chooses broad-production readiness
work.
