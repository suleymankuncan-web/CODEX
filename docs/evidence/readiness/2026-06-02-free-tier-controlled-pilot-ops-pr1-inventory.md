# Free-Tier Controlled Pilot Ops PR-1 Inventory - 2026-06-02

## Scope

This note records the PR-1 inventory for
`docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`.

It classifies the operational dependencies that matter for the controlled
staging/internal pilot and separates them from broad-production requirements.

No product code, API response shape, auth/permission semantics, database
schema, provider tier, queue behavior, import lifecycle, scoring, snapshot
interpretation, approval workflow, or UI behavior was changed.

No secrets, provider URLs, raw tokens, webhooks, database URLs, Redis URLs, or
private payloads are recorded.

## Decision

Controlled pilot:

- Free-tier or staging-grade posture is accepted only where existing evidence
  proves the current pilot path and the operational limit is visible.
- Failures must remain operator-known and recoverable by rerun, smoke, or
  runbook action.

Broad production:

- Remains `No-Go`.
- Paid or production-grade requirements are parked; they are not bypassed by
  this inventory.

## Dependency Posture Matrix

| Dependency | Current evidence | Controlled pilot status | Broad production status | Free-tier / staging limit | Operator check |
| --- | --- | --- | --- | --- | --- |
| Vercel frontend staging | `current-state.md` lists frontend staging at `https://staging.hr-axis.com`; admin/store route evidence exists in recent UI closeouts. | `pilot accepted` | `production parked` until final broad-release route/auth/deploy evidence is rerun. | Staging deploy evidence does not prove broad-production traffic or incident policy. | Vercel check/status plus affected route smoke or Playwright evidence after UI changes. |
| Render backend API staging | `current-state.md`; `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`; public `/api/health` evidence. | `pilot accepted` | `production parked` until broad-production provider/recovery/incident posture is accepted. | Controlled-pilot readiness profile is accepted; broad-production profile is not. | `npm.cmd run smoke:deployed-readiness` and public `/api/health`. |
| Render worker process | `current-state.md` records PR #534/#536 and `job.execution.completed` after `hr-axis-worker` started. | `pilot accepted` | `production parked` until durable Redis tier and worker incident posture are accepted. | Worker health depends on Render service status and Redis-backed BullMQ; failed jobs can still be source-data failures. | Check Render worker health/logs before changing API/import code. |
| Redis / BullMQ queue | `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`; `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`. | `pilot accepted` with Free-tier operational risk. | `production parked` until persistent Redis-compatible tier or explicit written risk acceptance. | Free/non-persistent Redis can lose queued jobs on restart; pilot treats jobs as rerunnable. | `/api/health` must report Redis `ok`, `queueBackend=bullmq`, queue `durable`. |
| Redis-backed rate limit | Same Redis/BullMQ staging proof and production posture decision. | `pilot accepted` under controlled traffic. | `production parked` until target tier/profile is accepted. | Free-tier capacity is not broad-production traffic evidence. | `/api/health` Redis check plus deployed readiness smoke. |
| Supabase Postgres logical recovery | `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`; `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`. | `pilot accepted` as logical app-schema recovery evidence. | `production parked` until managed restore/PITR/RPO/RTO posture is accepted or tested. | Logical restore covers app-owned schemas; it does not prove PITR, Storage/Auth/Realtime/Edge settings, or managed restore to a new project. | Use backup/restore runbook only with an explicitly disposable target. |
| Better Stack health alert | `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`. | `pilot accepted` for external health email alert proof. | `production parked` until final incident policy/app-level tracking decision is accepted. | Health alerting does not provide app-level exception traces, SMS/phone escalation, or full incident management. | `npm.cmd run smoke:alert-routing` when provider metadata is available. |
| Render platform notifications | `current-state.md`; `docs/evidence/readiness/2026-05-22-alert-provider-delivery-proof.md`. | `pilot accepted` as deploy/platform notification support. | `production parked` unless owner accepts platform-alert policy. | Platform notifications do not replace application exception tracking. | Provider console evidence and alert-routing smoke metadata. |
| Auth/provider/persona evidence | `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md` references Clerk protected persona evidence. | `pilot accepted` for current scoped personas. | `production parked` for broad-release config changes or role/scope changes. | Evidence must be rerun after material auth/scope/role changes. | Clerk persona staging evidence runbook and protected route checks. |
| Power BI / Excel import path | Existing upload/import proof referenced in `external-evidence-closure-decision-v1.md`; source-agnostic boundary docs. | `pilot accepted` for current `SUPER_ADMIN` operator path. | `production parked` for future role delegation or new source adapters. | No Nebim/JSON/source adapter is accepted without real contract inputs. | Safe upload/readback smoke and import batch evidence surfaces. |

## PR-1 Conclusions

- The controlled pilot has enough named evidence to operate without paid
  infrastructure, as long as the limits above remain explicit.
- The operational posture is not broad-production ready.
- No paid provider decision is required to continue PR-2 through PR-4.
- PR-2 should focus on Redis/BullMQ worker troubleshooting and queue posture.
- PR-3 should focus on free/platform alerting and incident policy.
- PR-4 should focus on manual logical recovery posture.
- PR-5 should close the line by updating `current-state.md` without removing
  broad-production `No-Go`.

## Verification

Run locally for this PR:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

## Rollback

Revert the plan and this docs-only evidence note. No migration, provider
rollback, queue drain, data repair, or runtime rollback is required.

## Stop Rules Preserved

- Do not buy or require paid infrastructure.
- Do not change provider tier or production config.
- Do not run production restore.
- Do not request or record secrets.
- Do not change API, DB, auth, queue, import, scoring, snapshot, workflow, or
  UI behavior.
- Do not claim broad-production readiness.
