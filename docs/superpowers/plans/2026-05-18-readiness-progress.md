# Readiness Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the production readiness audit into a merge-by-merge risk reduction roadmap for the Vite frontend, NestJS backend, Supabase PostgreSQL, Clerk auth, Vercel frontend, and Render backend stack.

**Architecture:** Keep the current backend-owned data boundary and existing release gates. Each slice must reduce a real production failure mode, produce machine-checkable evidence where possible, and avoid UI work unless a later slice explicitly requires operator-facing evidence. Broad rollout stays Conditional Go until observability, deployed-environment verification, backup/restore proof, and resource controls are closed or explicitly accepted.

**Tech Stack:** Vite, React, TypeScript, NestJS, PostgreSQL via `pg.Pool`, Supabase managed PostgreSQL, Clerk JWT/JWKS, Vercel, Render, GitHub Actions, Docker Compose, Node.js scripts.

---

## GSD Notes

GSD was attempted before writing this plan.

- Direct `gsd --help` from PowerShell failed because `gsd.ps1` is blocked by the local execution policy.
- The `.cmd` wrapper worked: `C:\Users\suley\AppData\Roaming\npm\gsd.cmd --help` returned `GSD v2.82.0`.
- `gsd headless query` opened the project but reported a blocker: `DB unavailable - runtime markdown state derivation is disabled`.
- `gsd headless doctor` found one error and two warnings:
  - root `node_modules` missing
  - Git remote `origin` unreachable
  - uncommitted changes older than the doctor threshold
- A read-only `gsd --print --model openai-codex/gpt-5.4 --no-session` review succeeded. Useful recommendations from that run:
  - add CSP/HSTS at the public edges
  - make Render/Vercel post-deploy verification machine-checkable
  - move rate limiting toward Redis/shared storage before scaled production
  - verify deployed security headers from the public frontend URL
  - turn Supabase backup/restore and DB ops assumptions into evidence

GSD is therefore usable as a planning second opinion, but its headless project state should be repaired later before relying on it as the canonical execution tracker.

Slice 3 note: `gsd headless query` was retried before implementation and still returned `DB unavailable - runtime markdown state derivation is disabled`; execution continued from this checked-in plan and repo tests.

Slice 4 note: `gsd headless query` was retried again before implementation and returned the same canonical DB blocker; execution continued from this checked-in plan, deployed smoke evidence, and repo tests.

Slice 5 note: `gsd headless query` was retried before implementation and again returned `DB unavailable - runtime markdown state derivation is disabled`; execution continued from this checked-in plan, prior readiness evidence, and repo tests.

Slice 6 note: `gsd headless query` was retried before implementation and returned the same canonical DB blocker; execution continued from this checked-in plan, post-merge smoke evidence, and repo tests.

Slice 7 note: `gsd headless query` was retried before implementation and returned the same canonical DB blocker; execution continued from this checked-in plan, Supabase documentation review, and repo tests. No destructive restore command was run because no approved disposable Supabase restore target or staging restore credentials were available in source-controlled context.

Slice 8 note: `gsd headless query` was retried before implementation and returned the same canonical DB blocker; execution continued from this checked-in plan, upload service tests, config contracts, and repo release gates.

Slice 9 note: `gsd headless query` was retried after PR #238 merged and returned the same canonical DB blocker; execution continued from this checked-in plan, the existing performance baseline harness, and repo tests.

Slice 10 note: `gsd headless query` was retried after PR #237 merged and returned the same canonical DB blocker; execution continued from this checked-in plan, current Supabase API key/security docs, and repo tests. Current Supabase docs still state that secret/service_role keys are backend-only and bypass Row Level Security, so this slice keeps the active frontend boundary closed.

## Current Readiness Baseline

Strong areas that should be preserved:

- Clerk/JWT validation exists backend-side with JWKS support and production issuer/audience/expiry gates.
- Auth, role, and scope guards are global.
- CORS is explicit allowlist based and rejects wildcard production origins.
- Validation pipe, global standard error filter, security headers, and health endpoints exist.
- Database access is backend-owned through `pg.Pool`; no frontend `service_role` leak was found.
- Docker, Docker Compose, and CI release checks exist.
- Environment inventory and production guardrails exist.

Open risk areas this plan must progress:

- Error tracking, monitoring, alert routing, and log retention are incomplete.
- Deploy verification still depends too much on manual discipline.
- Browser/edge security headers are partial; CSP/HSTS ownership is not fully closed.
- Rate limiting is in-memory and not shared across instances.
- Queue durability depends on `QUEUE_BACKEND`; local default is still in-memory.
- Backup/restore has runbook and local drill evidence, but no live staging/production proof.
- Upload parsing is bounded but in-process; concurrency and CPU/memory behavior are not measured.
- Supabase RLS is not the active boundary because direct client access is blocked, but that block must remain guarded.
- Load/performance evidence exists as scripts, but no production readiness budget is enforced across critical routes.

## Execution Rules

- One slice per PR unless two changes are inseparable.
- After every merge, update this document with status, PR number, deploy evidence, and next slice.
- If a slice changes backend runtime, Render deploy verification is required.
- If a slice changes frontend hosting/security headers, Vercel deploy verification is required.
- Do not commit secrets, raw tokens, live DB dumps, or provider screenshots containing secret values.
- Do not add dashboard/UI work in this roadmap unless it is needed to expose an existing backend status for operations.
- Prefer tests and scripts that fail loudly over checklist-only documentation.

## Progress Board

| Order | Slice | Status | Main Risk Reduced | Deploy Needed |
| --- | --- | --- | --- | --- |
| 1 | Deployed Readiness Smoke | Merged (#228) | Render/Vercel env drift after merge | Yes, when used against live env |
| 2 | Edge Security Headers | Merged (#229) | Browser token theft blast radius | Vercel, maybe Render |
| 3 | Observability V1 | Merged (#230) | Silent backend/frontend failures | Backend + frontend |
| 4 | Alerting and Incident Evidence | Merged (#231) | Nobody notices production degradation | Depends on provider |
| 5 | Redis-Backed Rate Limit | Merged (#232) | Abuse bypass on multi-instance runtime | Render |
| 6 | Queue Durability Gate | Merged (#233) | Lost in-process background jobs | Render |
| 7 | Backup/Restore Live Drill | Merged evidence gate (#234); external drill pending | Data-loss recovery uncertainty | No code deploy unless scripts change |
| 8 | Upload Resource Guardrails | Merged (#235, review fixes #236) | CPU/memory spikes from imports | Render |
| 9 | Performance Budget Pass | In progress | Slow critical routes under realistic load | No runtime deploy if scripts/docs only |
| 10 | Supabase Boundary Guard | Merged (#238) | Accidental direct client/RLS exposure | No runtime deploy; main release check passed |
| 11 | Env/Secret Drift Guard | Merged (#237) | Secret/public-env mistakes | No runtime deploy; main release check passed |
| 12 | Final Go/No-Go Readiness Packet | Pending | Unclear launch decision | No |

## Slice 1: Deployed Readiness Smoke

**Why first:** It catches the exact class of problem already seen in Render deploys: env drift, proxy config, health failures, migration mismatch, and stale frontend rewrites.

**Files:**

- Create: `scripts/deployed-readiness-smoke.mjs`
- Create: `scripts/deployed-readiness-smoke.test.mjs`
- Modify: `package.json`
- Modify: `docs/plans/production-environment-readiness-checklist.md`
- Create when executed: `docs/evidence/readiness/YYYY-MM-DD-<env>-deploy-smoke.md`

**Implementation outline:**

- [ ] Add a Node script that accepts:
  - `READINESS_FRONTEND_URL`
  - `READINESS_BACKEND_URL`
  - optional `READINESS_BEARER_TOKEN`
  - optional `READINESS_EXPECTED_COMMIT`
- [ ] Check backend:
  - `GET /api/health/live` returns 200.
  - `GET /api/health` returns 200 or prints dependency details on failure.
  - rate limit headers exist on at least one API response.
  - `x-correlation-id` exists on backend responses.
- [ ] Check frontend:
  - root URL returns 200.
  - SPA fallback for a known route returns 200.
  - static asset response is not HTML when an asset URL is discovered from the document.
- [ ] If `READINESS_BEARER_TOKEN` is present:
  - call `/api/auth/session`.
  - fail if role/scope data is missing.
- [ ] If token is absent:
  - mark auth smoke as `skipped` with an explicit reason.
  - do not pretend auth was verified.
- [ ] Add tests with mocked `fetch` so the script fails on missing health, missing headers, and non-JSON backend responses.
- [ ] Add root script:
  - `npm run smoke:deployed-readiness`
- [ ] Document required evidence fields:
  - env name
  - frontend URL
  - backend URL
  - commit SHA
  - Render deploy id if known
  - Vercel deployment URL if known
  - smoke output summary

**Verification:**

- Run: `npm.cmd run test:scripts`
- Run with local mocked URLs in tests.
- Run manually after a staging deploy:
  - `READINESS_FRONTEND_URL=https://<vercel-url> READINESS_BACKEND_URL=https://<render-url> npm.cmd run smoke:deployed-readiness`

**Done when:**

- A backend-affecting merge has a repeatable deployed smoke command.
- Failed deploys produce a clear reason instead of "looks broken".

**Current branch evidence:**

- Implemented script: `scripts/deployed-readiness-smoke.mjs`
- Implemented test: `scripts/deployed-readiness-smoke.test.mjs`
- Root command: `npm.cmd run smoke:deployed-readiness`
- Local verification: `npm.cmd run test:scripts` passed.
- Public staging smoke without bearer token passed for health, rate-limit headers, correlation IDs, frontend root, SPA fallback, and static assets.
- Auth/session remained skipped because no real `READINESS_BEARER_TOKEN` was provided.
- Evidence file: `docs/evidence/readiness/2026-05-18-staging-deploy-smoke.md`
- PR: #228 merged into `main`.

## Slice 2: Edge Security Headers

**Why:** The SPA carries browser auth state. CSP/HSTS reduce the blast radius of XSS, mixed transport mistakes, and public edge drift.

**Files:**

- Modify: `admin-web/vercel.json`
- Modify: `backend/nestjs/src/shared/http/security-headers.middleware.ts`
- Create: `scripts/security-headers-contract.test.mjs`
- Modify: `package.json`
- Modify: `docs/plans/environment-variable-inventory.md`

**Implementation outline:**

- [ ] Add Vercel headers for:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options` or equivalent `frame-ancestors 'none'`
  - `Referrer-Policy`
  - `Permissions-Policy`
- [ ] Keep CSP conservative:
  - `default-src 'self'`
  - `connect-src` includes the approved backend origin and Clerk origins only.
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'` only if current Vite/CSS behavior requires it.
  - `img-src 'self' data: blob:`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
- [ ] Add backend HSTS only if Render terminates TLS in a way that still allows the response header to be useful at the public API origin.
- [ ] Add a script test that reads `admin-web/vercel.json` and fails if CSP/HSTS disappear.
- [ ] Add a deployed smoke mode later in Slice 1 or Slice 2 that checks public headers on the live Vercel URL.

**Verification:**

- Run: `npm.cmd run test:scripts`
- Run: `npm.cmd --prefix admin-web run build`
- After Vercel deploy, fetch the public frontend URL and confirm headers.

**Done when:**

- Security headers are present in code config and verified against the deployed frontend.

**Current branch evidence:**

- Frontend edge headers added to `admin-web/vercel.json` for Vercel and `admin-web/nginx.conf` for the container fallback.
- Backend shared security headers now include HSTS.
- Contract coverage expanded in `scripts/security-headers-contract.test.mjs`.
- Deployed readiness smoke now fails when the public frontend root is missing required security headers.
- Local verification:
  - `node --test scripts/security-headers-contract.test.mjs scripts/deployed-readiness-smoke.test.mjs` passed.
  - `npm.cmd --prefix backend/nestjs test -- security-headers.middleware.spec.ts --runInBand` passed.
  - `npm.cmd --prefix admin-web run build` passed.
  - `npm.cmd run test:scripts` passed.
- Post-merge deploy note: Vercel deploy verification is required because frontend hosting/security headers changed. Render deploy verification is only needed if the backend service is redeployed for the HSTS middleware change.
- PR: #229 merged into `main`.

## Slice 3: Observability V1

**Why:** Current structured logs are useful, but production failures can still be silent without error tracking, correlation, retention, and alert routing.

**Files:**

- Create: `backend/nestjs/src/shared/observability/observability.module.ts`
- Create: `backend/nestjs/src/shared/observability/observability.service.ts`
- Modify: `backend/nestjs/src/shared/http/standard-error.filter.ts`
- Modify: `backend/nestjs/src/shared/structured-log.ts`
- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/.env.example`
- Modify: `docs/plans/environment-variable-inventory.md`
- Create: `scripts/observability-contract.test.mjs`

**Implementation outline:**

- [ ] Keep current JSON structured logs.
- [ ] Add optional envs:
  - `ERROR_TRACKING_DSN`
  - `ERROR_TRACKING_ENVIRONMENT`
  - `ERROR_TRACKING_RELEASE`
  - `LOG_LEVEL`
- [ ] If no DSN exists, keep no-op behavior and log a startup warning in production only when broad rollout mode is requested.
- [ ] Capture unhandled exceptions in a single backend adapter.
- [ ] Ensure captured events include:
  - correlation ID
  - request path
  - status code
  - actor user id only when already available and non-secret
  - release/version when configured
- [ ] Do not log bearer tokens, authorization headers, DB URLs, Redis URLs, or raw upload content.
- [ ] Add tests around error filter behavior so response bodies still hide stack traces.
- [ ] Add a contract test that env inventory documents all new observability envs.

**Provider decision:**

- Preferred practical path: Sentry for backend and frontend if the project owner approves adding provider packages and DSNs.
- Low-dependency fallback: Render log drain plus structured log contract first, then provider package later.

**Verification:**

- Run backend unit/e2e tests.
- Trigger a controlled test error in staging and verify it appears in the chosen provider or log drain.
- Confirm user-facing 500 responses still contain only standard error shape.

**Done when:**

- A real staging failure can be traced from user report to log/error event by correlation ID.

**Current branch evidence:**

- Added provider-neutral observability module/service with log-only external delivery, process-level unhandled rejection/exception capture, startup status, and broad-production missing-DSN warning.
- `StandardErrorFilter` now captures 5xx exceptions with correlation ID, request path, status code, and error code while keeping user-facing 500 responses generic.
- Structured log helpers now redact bearer tokens, secret-like fields, Postgres URLs, and Redis URLs before logging.
- `/api/health` now exposes non-secret observability status: log-only mode, DSN configured boolean, environment, release, log level, and readiness profile.
- Added runtime env contract for `ERROR_TRACKING_DSN`, `ERROR_TRACKING_ENVIRONMENT`, `ERROR_TRACKING_RELEASE`, `LOG_LEVEL`, and `READINESS_PROFILE`.
- Added `scripts/observability-contract.test.mjs` plus backend unit/e2e tests for config, redaction, filter capture, health status, and startup warning behavior.
- Provider package note: Sentry or another provider is intentionally not added in V1 because the plan requires owner approval before adding provider packages/DSNs. Render logs plus structured correlation events are the active signal for this slice.
- Local verification:
  - `npm.cmd --prefix backend/nestjs test -- --runInBand src/shared/app-config.service.spec.ts src/shared/observability/observability.service.spec.ts src/shared/http/standard-error.filter.spec.ts src/shared/structured-log.spec.ts test/integration/health.e2e-spec.ts` passed.
  - `node --test scripts/observability-contract.test.mjs scripts/deployment-runbook-contract.test.mjs` passed.
  - `npm.cmd --prefix backend/nestjs run build` passed.
- Post-merge deploy note: Render deploy verification is required because backend runtime behavior changed. Frontend deploy is not required by this slice unless the platform deploys both services together.
- PR: #230 merged into `main`.
- Post-merge staging deploy smoke passed:
  - `READINESS_FRONTEND_URL=https://staging.hr-axis.com READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api READINESS_TIMEOUT_MS=45000 npm.cmd run smoke:deployed-readiness`
  - 13 passed, 0 failed, 1 skipped.
  - Auth/session remained skipped because no real `READINESS_BEARER_TOKEN` was provided.
  - Evidence file: `docs/evidence/readiness/2026-05-18-staging-observability-deploy-smoke.md`

## Slice 4: Alerting and Incident Evidence

**Why:** Monitoring without a response path is only a diary.

**Files:**

- Modify: `docs/backend/operational-monitoring-contract.md`
- Modify: `docs/plans/production-staging-incident-response-skeleton.md`
- Create: `docs/evidence/readiness/YYYY-MM-DD-alert-routing-smoke.md`
- Optional create: `scripts/alert-routing-smoke.mjs`
- Optional create: `scripts/alert-routing-smoke.test.mjs`

**Implementation outline:**

- [ ] Define alert thresholds:
  - backend `/api/health` fails
  - 5xx rate crosses threshold
  - auth/session failures spike
  - upload/import failures spike
  - snapshot worker failures spike
  - DB latency crosses threshold
- [ ] Define destinations:
  - owner
  - channel/email
  - backup contact
- [ ] Add a non-secret evidence template for alert tests.
- [ ] If provider APIs are available, add a script that verifies alert destination metadata without exposing secrets.
- [ ] Add runbook actions for each alert class.

**Verification:**

- Run a staging alert smoke or document why it is blocked by missing provider access.
- Confirm docs name the owner and response path.

**Done when:**

- A production degradation has a named alert, owner, and first response action.

**Current branch evidence:**

- `docs/backend/operational-monitoring-contract.md` now has Alert Routing V1 with required alert ids, trigger signals, severity, owner roles, first response, and guarded evidence.
- `docs/plans/production-staging-incident-response-skeleton.md` now has Alert Trigger Playbooks for health, 5xx, auth/session, import, snapshot worker, DB latency, frontend reachability, and observability degradation.
- `docs/plans/production-environment-readiness-checklist.md` now requires alert routing smoke and incident contact path evidence.
- Added `scripts/alert-routing-smoke.mjs` and `scripts/alert-routing-smoke.test.mjs`.
- Added root command: `npm.cmd run smoke:alert-routing`.
- Added evidence file: `docs/evidence/readiness/2026-05-18-alert-routing-smoke.md`.
- Local/staging verification:
  - `node --test scripts/alert-routing-smoke.test.mjs scripts/incident-response-skeleton-contract.test.mjs` passed.
  - `ALERT_SMOKE_ENVIRONMENT=staging ALERT_SMOKE_BACKEND_URL=https://api-staging.hr-axis.com/api ALERT_SMOKE_TIMEOUT_MS=45000 npm.cmd run smoke:alert-routing` passed.
- Provider note: external alert delivery remains skipped/not configured until an approved provider destination is configured outside source control. This slice closes routing metadata and first-response evidence, not provider delivery.
- PR: #231 merged into `main`.
- Post-merge deploy note: provider-alert delivery was not added, so no Render/Vercel runtime deploy verification was required by this documentation-only slice.

## Slice 5: Redis-Backed Rate Limit

**Why:** The current in-memory limiter is acceptable for a small single instance, but weak for scaled production or process restarts.

**Files:**

- Modify: `backend/nestjs/src/shared/http/rate-limit.middleware.ts`
- Create: `backend/nestjs/src/shared/http/rate-limit-store.ts`
- Create: `backend/nestjs/src/shared/http/redis-rate-limit-store.ts`
- Modify: `backend/nestjs/src/shared/http/configure-http-security.ts`
- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/.env.example`
- Modify: `docs/plans/environment-variable-inventory.md`
- Add tests near existing rate limit/security e2e specs.

**Implementation outline:**

- [ ] Introduce a store interface:
  - `increment(key, now, windowMs): Promise<{ count: number; resetAt: number }>`
- [ ] Keep in-memory store for local/test.
- [ ] Add Redis store using existing `ioredis`.
- [ ] Add env:
  - `RATE_LIMIT_BACKEND=memory|redis`
  - `RATE_LIMIT_REDIS_PREFIX=hr-axis:rate-limit`
- [ ] In production, allow `memory` only for controlled pilot profile; require explicit documented acceptance before broad rollout.
- [ ] Preserve current headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
- [ ] Keep proxy trust behavior from `TRUST_PROXY_HOPS`.

**Verification:**

- Unit test memory store.
- Unit test Redis store with mocked Redis commands.
- E2E test still proves 429 and trusted proxy handling.
- Staging smoke confirms headers exist after Render deploy.

**Done when:**

- Production can share rate limits across instances when Redis is configured.

**Current branch evidence:**

- Added a `RateLimitStore` boundary with async in-memory and Redis-backed implementations.
- Redis store uses an atomic Lua-backed `INCR`/expiry flow through existing `ioredis` support.
- `RATE_LIMIT_BACKEND=memory|redis` and `RATE_LIMIT_REDIS_PREFIX` are documented in `.env.example`, environment inventory, and production readiness checklist.
- Broad production now fails closed at configuration time unless `RATE_LIMIT_BACKEND=redis`; production Redis mode also requires explicit `REDIS_URL`. Memory remains available for local/test and controlled pilot profiles.
- Rate-limit middleware now fails closed with a sanitized `RATE_LIMIT_STORE_UNAVAILABLE` 503 when the shared store is unavailable.
- Added contract/unit coverage for config, memory store behavior, Redis store parsing/arguments, async middleware headers, store-unavailable behavior, and readiness documentation.
- Local verification:
  - `npm.cmd --prefix backend/nestjs run lint` passed.
  - `npm.cmd --prefix backend/nestjs test -- --runInBand` passed: 107 suites, 642 tests.
  - `npm.cmd --prefix backend/nestjs run build` passed.
  - `npm.cmd run test:scripts` passed: 202 tests.
  - `npm.cmd run check:release` passed, including backend release checks, frontend checks, Playwright e2e, and audit.
  - `git diff --check` passed with line-ending warnings only.
- Post-merge deploy note: Render deploy verification is required because backend runtime behavior changed. Staging smoke should confirm rate-limit headers after deploy; if Redis is enabled, `REDIS_URL` and `RATE_LIMIT_REDIS_PREFIX` must be configured outside source control.
- PR: #232 merged into `main`.
- Post-merge staging deploy smoke passed:
  - `READINESS_FRONTEND_URL=https://staging.hr-axis.com READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api READINESS_TIMEOUT_MS=45000 npm.cmd run smoke:deployed-readiness`
  - 13 passed, 0 failed, 1 skipped.
  - Auth/session remained skipped because no real `READINESS_BEARER_TOKEN` was provided.

## Slice 6: Queue Durability Gate

**Why:** Background work exists and BullMQ support exists, but production readiness must make queue durability intentional.

**Files:**

- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/src/shared/health.service.ts`
- Modify: `backend/nestjs/.env.example`
- Modify: `docs/plans/environment-variable-inventory.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`
- Add tests around queue backend production behavior.

**Implementation outline:**

- [ ] Keep `QUEUE_BACKEND=in-memory` valid for local development.
- [ ] For staging/broad production, document when `QUEUE_BACKEND=bullmq` is required.
- [ ] Make `/api/health` clearly report:
  - queue backend
  - Redis checked/skipped
  - Redis failure reason sanitized
- [ ] Add an explicit readiness checklist gate:
  - if import/snapshot background durability is required, Redis must be configured and health must show Redis ok.
- [ ] Do not force BullMQ for controlled pilot unless actual background job loss would create operational risk.

**Verification:**

- Unit test health response for memory vs BullMQ.
- Staging health check with `QUEUE_BACKEND=bullmq` once Redis exists.

**Done when:**

- The team can say exactly when in-memory queue is acceptable and when it blocks rollout.

**Current branch evidence:**

- `QUEUE_BACKEND` is now validated as `in-memory|bullmq`; broad production fails closed unless `QUEUE_BACKEND=bullmq`.
- Production BullMQ mode fails closed unless `REDIS_URL` is explicitly configured.
- `/api/health` preserves `queueBackend` and now adds a `queue` object describing whether dispatch is process-local or durable, whether Redis is required, and whether Redis health blocks queue readiness.
- Redis health failure details remain sanitized before returning dependency health details.
- Environment inventory and production readiness checklist now require BullMQ/Redis evidence before broad production or durable import/snapshot work is approved.
- Added contract/unit coverage for queue config, health queue modes, Redis health dependency state, sanitized Redis errors, and readiness documentation.
- Local verification:
  - `npm.cmd --prefix backend/nestjs run lint` passed.
  - `npm.cmd --prefix backend/nestjs test -- --runInBand` passed: 108 suites, 650 tests.
  - `npm.cmd --prefix backend/nestjs run build` passed.
  - `npm.cmd run test:scripts` passed: 206 tests.
  - `node --test scripts/queue-durability-readiness-contract.test.mjs` passed.
  - `npm.cmd --prefix admin-web run test:e2e -- e2e/admin-routing.spec.ts:372 --project=chromium` passed after one full release run hit that isolated Playwright route-load flake.
  - `npm.cmd run check:release` passed on rerun, including backend release checks, frontend checks, Playwright e2e, and audit.
- Post-merge deploy note: Render deploy verification is required because backend runtime behavior changed. Staging smoke should confirm `/api/health` includes `queue.status=process-local` for controlled pilot, or `queue.status=durable` with Redis `status=ok` when BullMQ is enabled.
- PR: #233 merged into `main`.
- Post-merge staging deploy smoke passed:
  - `READINESS_FRONTEND_URL=https://staging.hr-axis.com READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api READINESS_TIMEOUT_MS=45000 npm.cmd run smoke:deployed-readiness`
  - 13 passed, 0 failed, 1 skipped.
  - `/api/health.queue.status` reported `process-local`, matching the controlled-pilot `QUEUE_BACKEND=in-memory` posture.
  - Auth/session remained skipped because no real `READINESS_BEARER_TOKEN` was provided.

## Slice 7: Backup/Restore Live Drill

**Why:** Local drill evidence is good, but real readiness needs proof against the actual Supabase operating model.

**Files:**

- Modify: `docs/plans/backup-restore-drill-runbook-v1.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`
- Create: `docs/evidence/readiness/YYYY-MM-DD-supabase-staging-restore-drill.md`
- Create: `scripts/supabase-staging-restore-drill-evidence-contract.test.mjs`
- Modify: `admin-web/playwright.config.ts`

**Implementation outline:**

- [x] Confirm current Supabase managed-backup documentation and record unknown project capability:
  - backup cadence
  - PITR availability if paid plan
  - restore target options
- [ ] Perform a staging-only restore drill into a disposable target.
- [ ] Evidence must include:
  - source project/environment name
  - restore target name
  - sanitized command or dashboard steps
  - schema/table counts
  - migration tracking count
  - smoke query result
  - confirmation no production DB was touched
- [ ] Define RPO/RTO assumptions:
  - acceptable data loss window
  - acceptable restore time
- [ ] Add a No-Go rule:
  - broad rollout blocked if no recent backup exists or no restore path has been tested.

**Verification:**

- Run existing backup/restore contract tests.
- Review evidence for secret leakage before commit.

**Done when:**

- A restore is proven in an environment that resembles production, not only local Docker.

**Current branch evidence:**

- Reviewed current Supabase backup docs before editing this slice.
- Updated `docs/plans/backup-restore-drill-runbook-v1.md` with Supabase-specific daily backup, PITR, physical backup, logical dump, restore-to-new-project, Storage-object, RPO, and RTO caveats.
- Added `docs/evidence/readiness/2026-05-18-supabase-staging-restore-drill.md`.
- Current evidence is explicit `No-Go for broad production` because Supabase staging restore has not yet been executed against an approved disposable target.
- The evidence preserves the existing local restore drill as useful local proof but does not count it as Supabase-managed restore proof.
- Production checklist now requires Supabase plan backup capability, PITR availability, latest backup/recovery point, and staging restore evidence before broad production Go.
- Added `scripts/supabase-staging-restore-drill-evidence-contract.test.mjs` to keep the blocker, RPO/RTO fields, and no-secret evidence rules from being diluted.
- Pinned Playwright E2E to one worker after two full release attempts exposed a local parallel-preview blank-shell flake; the official release gate passed after serialization.
- No production or staging restore command was executed in this branch.

**Current branch verification:**

- `node --test scripts/backup-restore-drill-runbook-contract.test.mjs scripts/backup-restore-local-evidence-contract.test.mjs scripts/supabase-staging-restore-drill-evidence-contract.test.mjs scripts/production-readiness-checklist-contract.test.mjs` passed: 16 tests.
- `npm.cmd run test:scripts` passed: 210 tests.
- `npm.cmd run test:e2e -- --workers=1` passed: 157 Playwright tests.
- `npm.cmd run check:release` passed after Playwright worker serialization, including backend release checks, frontend checks, Playwright E2E, and audit.

## Slice 8: Upload Resource Guardrails

**Why:** Upload size and row limits exist, but parsing still happens in the API process and can spike CPU/memory under concurrency.

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/.env.example`
- Modify: `docs/plans/environment-variable-inventory.md`
- Add service/controller tests for concurrency and oversized uploads.

**Implementation outline:**

- [x] Add env:
  - `UPLOAD_PARSE_MAX_CONCURRENCY`
  - `UPLOAD_PARSE_TIMEOUT_MS`
- [x] Add an in-process semaphore around XLSX parsing for the current API-process model.
- [x] Return a standard 429 or 503 with `Retry-After` when parse capacity is full.
- [x] Preserve existing 8 MB file limit and 20k row limit.
- [x] Add timing logs:
  - file type
  - sanitized file size
  - parse duration
  - row count
  - correlation ID
- [x] Document when to move parsing to BullMQ:
  - sustained concurrent uploads
  - parse duration above budget
  - API p95 degradation during imports

**Verification:**

- Unit test capacity-full behavior.
- Unit test timeout behavior with fake parser delay.
- Run backend tests and a staging upload smoke.

**Done when:**

- Uploads degrade gracefully instead of consuming unbounded API process capacity.

**Current branch evidence:**

- Added `UPLOAD_PARSE_MAX_CONCURRENCY` and `UPLOAD_PARSE_TIMEOUT_MS` to backend config, `.env.example`, and environment inventory.
- Broad production now requires explicit upload parse guardrail envs; controlled pilot keeps safe defaults.
- Added an in-process parse slot around Power BI export parsing and moved XLSX parsing into a bounded worker thread so retryable `503` capacity/timeout responses with `Retry-After` can stop slow parse work.
- Preserved the existing 8 MB file limit and 20k row/80-column sheet bounds.
- Added structured parse completion logs with file role, extension, file size bytes, duration, row count, source code, and correlation id from request context.
- Documented the move-to-BullMQ trigger in readiness docs: sustained concurrent uploads, parse duration above budget, or API p95 degradation during imports.
- Targeted verification passed:
  - `npm.cmd test -- --runInBand src/modules/integration/application/power-bi-export-upload.service.spec.ts src/shared/app-config.service.spec.ts src/shared/http/standard-error.filter.spec.ts` passed: 57 tests.
  - `node --test scripts/deployment-runbook-contract.test.mjs` passed: 11 tests.
  - `npm.cmd run lint` passed in `backend/nestjs`.
  - `npm.cmd run check:release` passed from the workspace root, including scripts, backend release checks, frontend Playwright E2E, builds, and audit.
- Staging upload smoke remains a post-merge/operator task because it needs a real authenticated integration-admin session and sample upload file in the target environment.

## Slice 9: Performance Budget Pass

**Why:** The project has performance scripts, but production readiness needs route budgets and regression checks for critical flows.

**Files:**

- Modify: `scripts/public-performance-baseline.mjs`
- Modify: `scripts/protected-performance-baseline.mjs`
- Create: `scripts/backend-readiness-load-smoke.mjs`
- Create: `scripts/backend-readiness-load-smoke.test.mjs`
- Modify: `package.json`
- Modify: `docs/plans/production-environment-readiness-checklist.md`

**Implementation outline:**

- [x] Define route groups:
  - public frontend shell
  - authenticated session
  - store dashboard/read routes
  - competition routes
  - upload/import routes excluded from simple GET budget
- [x] Add budgets:
  - availability
  - p50/p95 latency
  - non-HTML API response correctness
  - max 5xx count
- [x] Implement a dependency-light Node script using built-in `fetch` and concurrent requests.
- [x] Make the script report JSON and human-readable summary.
- [x] Do not make this a mandatory CI gate until staging baseline is stable.

**Verification:**

- Run against local or staging.
- Store sanitized evidence under `docs/evidence/readiness/` for baseline runs.

**Done when:**

- The team has concrete p95 and failure-rate numbers before broad rollout.

**Current branch evidence:**

- Added `scripts/backend-readiness-load-smoke.mjs`.
- Added root command: `npm.cmd run smoke:backend-readiness-load`.
- Added `scripts/backend-readiness-load-smoke.test.mjs`.
- The smoke defines route groups for public API health, authenticated session, store read routes, competition read routes, and import read routes.
- The smoke enforces availability, p50/p95 latency, non-HTML JSON API correctness, and max `5xx` count for measured groups.
- Protected route groups are skipped/blocked, not marked as passed, when no real role-specific bearer tokens are provided.
- The smoke accepts group-specific tokens for store, competition, and import routes; shared token reuse requires explicit `BACKEND_LOAD_ALLOW_SHARED_TOKEN=true`.
- Upload/import mutation routes remain excluded from this simple GET budget and stay covered by upload resource guardrails, command benchmarks, and background job evidence.
- This is intentionally not a mandatory CI gate until staging baselines are stable.
- Staging public API health smoke passed with `NODE_OPTIONS=--dns-result-order=ipv4first`: availability `100%`, p50 `132.23ms`, p95 `224.59ms`, 5xx `0`.
- Protected route performance remains blocked until real staging role-specific bearer tokens are provided.
- Evidence file: `docs/evidence/readiness/2026-05-18-staging-backend-readiness-load-smoke.md`.
- Local verification:
  - `node --test scripts/backend-readiness-load-smoke.test.mjs` passed: 6 tests.
  - `npm.cmd run test:scripts` passed: 227 tests.
  - `npm.cmd run check:release` passed, including backend lint/test/build/audit and frontend build/Playwright/audit.
  - `git diff --check` passed with line-ending warnings only.

## Slice 10: Supabase Boundary Guard

**Why:** Backend-owned DB access is the current security boundary. Accidental frontend Supabase access or service-role exposure would change the threat model immediately.

**Files:**

- Create: `scripts/supabase-boundary-guard.test.mjs`
- Modify: `package.json`
- Modify: `docs/plans/environment-variable-inventory.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`

**Implementation outline:**

- [ ] Add a root script test that scans committed frontend files for:
  - `SUPABASE_SERVICE_ROLE`
  - `service_role`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - direct `@supabase/supabase-js` usage in `admin-web/src`
- [ ] Allow documented exceptions only in backend docs/tests.
- [ ] Keep `VITE_*` frontend envs public-only.
- [ ] Add a checklist rule:
  - direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed and tested.

**Verification:**

- Run: `npm.cmd run test:scripts`
- Confirm the guard fails when a fake frontend service role string is injected in a temp fixture inside the test.

**Done when:**

- The repo has a machine guard against the highest-impact Supabase boundary mistake.

**Current branch evidence:**

- Added `scripts/supabase-boundary-guard.test.mjs`.
- Added root command: `npm.cmd run check:supabase-boundary`.
- Guard scans tracked `admin-web` frontend files for Supabase service-role/secret keys, `DATABASE_URL`, `JWT_SECRET`, direct `@supabase/supabase-js` imports, and direct Supabase REST access to `ops.*` under `admin-web/src`.
- Guard includes fake frontend fixtures proving service-role, direct client, direct REST, and unsafe `VITE_*` values fail.
- Production checklist and env inventory now keep direct Supabase client access to `ops.*` blocked until RLS/policy work is designed, tested, and approved.
- PR: #238 merged into `main`.
- Main `Release Check` passed after merge commit `e0a5bbff6e45edde035d588f2e103dfba9b56778`.

## Slice 11: Env/Secret Drift Guard

**Why:** Many production failures are not code failures; they are env mismatches between repo docs, Render, Vercel, and Clerk.

**Files:**

- Create: `scripts/readiness-env-contract.test.mjs`
- Modify: `scripts/deployment-runbook-contract.test.mjs`
- Modify: `docs/plans/environment-variable-inventory.md`
- Modify: `docs/deployment/render-supabase-vercel-staging.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`

**Implementation outline:**

- [ ] Extend env inventory tests so every production P0 env has:
  - owner
  - runtime location
  - secret/public classification
  - production requirement
  - local default if any
- [ ] Add checks for:
  - `TRUST_PROXY_HOPS`
  - `RATE_LIMIT_*`
  - Clerk JWT/JWKS values
  - `CORS_ALLOWED_ORIGINS`
  - frontend `VITE_AUTH_PROVIDER`
  - frontend `VITE_BEARER_TOKEN` must be empty in production
- [ ] Document Render/Vercel manual verification steps where API access is not available.
- [ ] Do not fetch or print live secret values.

**Verification:**

- Run: `npm.cmd run test:scripts`
- Review output for no secret material.

**Done when:**

- Env changes cannot quietly drift away from docs and release checks.

**Current branch evidence:**

- Implemented in PR #237.
- Added `scripts/readiness-env-contract.test.mjs`.
- Added manual Render/Vercel env verification rules to deployment and readiness docs.
- Codex review comments for missing `DB_SSL_MODE`, `AUTH_PROVIDER_KEY`, and `NODE_ENV` coverage were fixed before the PR was marked ready.
- Main `Release Check` passed after merge commit `537b57f092f44033a5e3be43f38134e7eb00e875`.

## Slice 12: Final Go/No-Go Readiness Packet

**Why:** After the fixes, the project needs a decision artifact, not scattered confidence.

**Files:**

- Create: `docs/evidence/readiness/YYYY-MM-DD-production-readiness-decision.md`
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

**Implementation outline:**

- [ ] Summarize each readiness slice:
  - status
  - PR
  - deploy evidence
  - remaining risk
- [ ] Assign final status:
  - Go
  - Conditional Go
  - No-Go
- [ ] Keep broad production No-Go if any of these remain unresolved:
  - no error tracking or log retention path
  - no deployed smoke evidence
  - no backup/restore evidence
  - direct Supabase access introduced without RLS/policies
  - upload/import resource risk unbounded
- [ ] Update `current-state.md` with the final readiness position.

**Verification:**

- Run all relevant script tests.
- Link final evidence files.
- Confirm no raw token or secret appears in evidence.

**Done when:**

- A new engineer can read one packet and understand whether production rollout is allowed.

## Recommended Next PR

Start with **Slice 1: Deployed Readiness Smoke**.

Reason: it is low-risk, does not need new provider accounts, and directly catches the type of Render/Vercel misconfiguration that already caused deploy friction. After that, do **Slice 2: Edge Security Headers**, then **Slice 3: Observability V1** once the provider/log-drain decision is made.

## Open Decisions

- Error tracking provider: Sentry, OpenTelemetry collector, Render log drain, or another provider.
- Production profile naming: keep informal pilot/broad distinction, or introduce an explicit env such as `READINESS_PROFILE=controlled-pilot|broad-production`.
- Redis availability: use the same Redis path for BullMQ and rate limiting, or keep independent configuration.
- Supabase backup tier: confirm whether staging/prod plan supports PITR or only scheduled backups.
- HSTS preload: only enable preload after confirming all subdomains are HTTPS-safe.

## Self-Review

- Spec coverage: covers all audit gaps: observability, monitoring, health, deploy verification, rate limiting, queue durability, backup/restore, upload resources, env management, Supabase boundary, performance, and final readiness decision.
- Placeholder scan: no placeholder markers or vague deferred-action steps remain; provider-dependent work is called out as an open decision with fallback.
- Type consistency: planned env names and script names are repeated consistently across slices.
