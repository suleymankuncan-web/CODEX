# Codex Review Readiness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all actionable Codex bot findings from the last merged readiness PRs in one PR.

**Architecture:** Keep fixes in the existing modules that own each readiness surface. Add narrow regression tests for worker lifecycle, health dependency probing, alert smoke behavior, startup logging, staging env defaults, and backup drill decision wording.

**Tech Stack:** NestJS, Jest, Node test runner, Docker Compose, Markdown runbooks.

---

### Task 1: Hold Upload Parse Slots Until Worker Shutdown

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`

- [ ] Add a regression test proving a timed-out parse keeps the single parse slot occupied until the aborted parse operation finishes cleanup.
- [ ] Change `withParseTimeout` so timeout rejection waits for the operation promise to settle after abort before releasing the parse slot.
- [ ] Change worker abort handling so `worker.terminate()` completion is part of the rejected parse promise.
- [ ] Run `npm.cmd test -- --runInBand src/modules/integration/application/power-bi-export-upload.service.spec.ts`.

### Task 2: Probe Redis When Any Runtime Dependency Requires It

**Files:**
- Modify: `backend/nestjs/src/shared/health.service.ts`
- Modify: `backend/nestjs/src/shared/health.service.spec.ts`

- [ ] Add `rateLimitBackend` to the health service test config helper.
- [ ] Add a regression test for `queueBackend=in-memory` plus `rateLimitBackend=redis` proving Redis is probed.
- [ ] Update Redis skip logic so it skips only when both queue and rate limiting do not require Redis.
- [ ] Keep queue health semantics unchanged for in-memory queues.
- [ ] Run `npm.cmd test -- --runInBand src/shared/health.service.spec.ts`.

### Task 3: Fail Alert Smoke On Degraded Observability

**Files:**
- Modify: `scripts/alert-routing-smoke.mjs`
- Modify: `scripts/alert-routing-smoke.test.mjs`

- [ ] Add a regression test where backend health returns `observability.status=degraded` and smoke status becomes `failed`.
- [ ] Update backend health signal evaluation to return a failed check for degraded observability.
- [ ] Run `node --test scripts/alert-routing-smoke.test.mjs`.

### Task 4: Preserve Startup Observability Warnings And Dotenv Log Level

**Files:**
- Modify: `backend/nestjs/src/main.ts`
- Modify: `backend/nestjs/src/workers.ts`
- Modify: `backend/nestjs/src/shared/observability/observability.service.ts`
- Modify: `backend/nestjs/src/shared/observability/observability.service.spec.ts`

- [ ] Create app contexts with the default Nest logger first, then apply `app.useLogger(resolveNestLogLevels(config.logLevel))` after `AppConfigService` is available.
- [ ] Log degraded startup state through `logger.error` so it remains visible under `LOG_LEVEL=error`.
- [ ] Adjust observability tests to assert degraded startup uses error logging.
- [ ] Run `npm.cmd test -- --runInBand src/shared/observability/observability.service.spec.ts`.

### Task 5: Add Staging Trust Proxy Default

**Files:**
- Modify: `infra/staging/docker-compose.yml`

- [ ] Add `TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}` to the backend environment block.
- [ ] Confirm the compose file still keeps existing production-like defaults intact.

### Task 6: Scope Supabase Backup No-Go

**Files:**
- Modify: `docs/plans/backup-restore-drill-runbook-v1.md`

- [ ] Replace the unconditional Supabase plan backup No-Go with a scoped managed Supabase restore No-Go.
- [ ] Preserve the local/disposable logical restore path for manual `pg_dump` or Supabase CLI dump drills.

### Task 7: Verify And Package

**Files:**
- Read: `package.json`
- Read: `backend/nestjs/package.json`

- [ ] Run focused tests for changed backend and script files.
- [ ] Run `npm.cmd test -- --runInBand`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `node --test scripts/*.test.mjs`.
- [ ] Review `git diff`.
- [ ] Commit, push, and open a single PR.
