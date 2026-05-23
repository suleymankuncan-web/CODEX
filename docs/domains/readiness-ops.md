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
- App-level error tracking decision.
- Broad-production protected persona/performance rerun after config changes.

Open those only when the owner explicitly chooses broad-production readiness
work.
