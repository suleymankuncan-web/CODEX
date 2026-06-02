# Free-Tier Controlled Pilot Ops Posture V1 Closeout - 2026-06-02

## Scope

This note closes
`docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`.

The line closed the remaining controlled-pilot operational posture gap without
buying paid infrastructure, changing provider tiers, running production
restore, recording secrets, or changing runtime behavior.

No product code, API response shape, auth/permission semantics, database
schema, migrations, provider tier, provider configuration, queue behavior,
worker boot behavior, import lifecycle, snapshot interpretation, scoring,
approval workflow, or UI behavior changed.

No secrets, provider URLs, raw tokens, webhooks, database URLs, Redis URLs,
Supabase tokens, project IDs, email addresses, message IDs, row payloads, or
private payloads are recorded.

## PR Train

| Slice | PR | Result | Risk reduced |
| --- | --- | --- | --- |
| PR-1 posture inventory | `#629` | merged | Free-tier/staging dependencies are classified as controlled-pilot accepted or production parked. |
| PR-2 Redis / BullMQ runbook | `#630` | merged | Pending import/snapshot/worker symptoms have a deterministic queue/worker triage order. |
| PR-3 alert policy | `#631` | merged | Better Stack external health email proof plus Render notifications are accepted for controlled pilot only. |
| PR-4 recovery posture | `#632` | merged | App-owned schema logical restore is accepted for controlled pilot only; PITR/managed restore remain parked. |
| PR-5 closeout | `#633` | merged | Operating docs are aligned so future agents do not reopen the same pilot ops question. |

## Controlled-Pilot Accepted Posture

Controlled staging/internal pilot can continue with these accepted limits:

- Vercel staging frontend and Render staging API/worker service are accepted
  for scoped pilot operations.
- Render Key Value Free / Redis-backed BullMQ is accepted only for controlled
  pilot with rerunnable-job posture and worker/queue triage.
- Better Stack external health email proof plus Render platform notifications
  are accepted for controlled pilot alerting.
- Supabase app-owned schema logical restore into a disposable local PostgreSQL
  target is accepted for controlled pilot recovery posture.
- App-level paid exception tracking and paid Supabase PITR are not controlled
  pilot blockers.

## Parked Production Requirements

Broad production remains `No-Go` until owner/provider decisions close:

- persistent production Redis-compatible tier or explicit written risk
  acceptance,
- final production alert destination and incident owner path,
- app-level exception tracking decision or explicit written risk acceptance,
- managed Supabase restore/PITR/RPO/RTO posture or explicit owner acceptance
  of logical restore limits,
- Storage/Auth/Realtime/Edge recovery expectations,
- final production profile evidence and protected-route smoke as needed.

## Verification

PR-1:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

PR-2:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health # pass
npm.cmd run smoke:deployed-readiness # pass, 13/14 passed, auth-session skipped because no bearer token was provided
```

PR-3:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
npm.cmd run smoke:alert-routing # pass, 4/5 passed, provider metadata skipped because no provider metadata was supplied
```

PR-4:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

`npm.cmd run smoke:migration:fresh-db` was not run in PR-4 because no DB schema
or migration changed and no new approved disposable local target was required
for the docs-only posture update.

PR-5:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

## Final Decision

Controlled pilot ops posture:

- Closed for the current scoped staging/internal pilot.

Broad production:

- Remains `No-Go`.
- This closeout deliberately does not claim broad-production readiness.

## Reopen Triggers

Reopen this line only if:

- broad production rollout is requested,
- a new provider/tier decision is proposed,
- queue loss becomes user-visible or non-rerunnable,
- app-level exception tracking becomes required for the pilot claim,
- managed Supabase restore/PITR/RPO/RTO is required,
- a new pilot cohort or production-like user promise changes the accepted risk.

## Rollback

Docs-only revert. No provider rollback, queue drain, restore rollback, data
repair, migration rollback, secret rotation, or runtime rollback is required.
