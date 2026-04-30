# Backend Foundation Hardening Plan V1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the existing backend/data foundation without opening new product modules or speculative external-source work.

**Architecture:** Keep the current NestJS + PostgreSQL + admin-web surfaces as the source of truth. Each hardening slice must improve an existing runtime, data, auth, import, reporting, or operator-evidence path without changing business scope.

**Tech Stack:** NestJS backend, PostgreSQL schemas, React/Vite admin-web, Playwright, Jest, Node script contract tests, root `npm.cmd run check:release`.

---

## Boundary

No new product module is opened by this plan.

No guessed external source adapter work is allowed.

No new scoring engine is allowed.

No broad UI redesign is included.

The priority is to harden existing backend, data, auth, import, and operator evidence surfaces.

This plan is a control map, not a feature backlog. It should prevent scattered work and keep the project moving in small verified slices.

## Current Foundation

Already present:

- production release gate: lint, tests, build, audit
- migration tracking and production HTTP migration guard
- CORS allowlist, rate-limit V1, standard error response
- mobile device session P0
- role/scope and no-empty-scope guards
- Excel KPI import with gross personnel / net store rules
- source-agnostic import boundary
- import data quality summary and lineage evidence
- master-data bootstrap staging, validation, readiness, promotion, admin review, dry-run evidence, and pilot smoke runbook
- monthly ranking evidence and scoring source contracts
- checklist store-score integration
- operator runbooks for Excel import, production readiness, incident response, deployment, and master-data pilot smoke

Remaining foundation risk is mostly operational:

- not all operator decisions are surfaced as Go / Conditional Go / No-Go language
- real baseline data and real JSON source evidence are still external
- staging IdP evidence is still external
- DB performance and backup drills should wait for realistic data/environment
- future UI/localization polish should not distract from backend/data trust

## P0 - Keep The Current Foundation Trustworthy

P0 work is allowed now because it strengthens existing surfaces.

### 1. Import decision evidence

Purpose:

- Make existing import detail/reconciliation screens expose a clear operator decision: Go, Conditional Go, or No-Go.
- Do not add new import behavior.
- Do not change materialization, scoring, or mapping logic.

Target files:

- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/e2e/integration-surfaces.spec.ts`
- optional doc: `docs/plans/import-decision-evidence-v1.md`

Acceptance:

- Import detail shows the decision basis using existing batch summary, data quality summary, reconciliation, and retry evidence.
- No backend endpoint is added unless the existing API cannot provide the data.
- Playwright covers the visible decision language.
- Root `npm.cmd run check:release` passes.

### 2. Scope/auth regression matrix

Purpose:

- Turn existing auth/scope hardening into a matrix of protected surfaces.
- Add missing tests only for existing endpoints that already depend on company, region, store, or assigned-store scope.

Target files:

- backend tests under `backend/nestjs/src/modules/**`
- optional doc: `docs/plans/scope-auth-regression-matrix-v1.md`

Acceptance:

- Empty scope returns no data or forbidden responses where expected.
- Foreign scope does not widen access.
- Assigned-store action rules remain separate from read scope.
- No role semantics are changed.

### 3. DB health and migration evidence

Purpose:

- Strengthen confidence that migrations and database health are observable before deployment.
- Do not replace the migration system.
- Do not add destructive migration behavior.

Target files:

- existing migration service/tests
- existing health endpoint/tests
- optional runbook section in deployment or production readiness docs

Acceptance:

- Existing migration status can be checked before deploy.
- Failed migration evidence stays visible.
- Health check remains simple and does not leak secrets.
- Root release gate stays the final local gate.

### 4. Operator evidence consistency pass

Purpose:

- Make existing operator screens and runbooks use the same evidence terms: row evidence, dry-run evidence, sanitized evidence, Go / Conditional Go / No-Go.
- Do not redesign pages.

Target files:

- `docs/plans/*.md`
- existing admin-web page copy only where evidence is already present

Acceptance:

- No new workflow is introduced.
- No endpoint is added.
- Existing decision language is easier to follow.

## P1 - Prepare For Real Data And Pilot Operations

P1 work starts when there is either a true baseline file, staging IdP inputs, or a realistic environment.

### 1. Backup/restore drill

Purpose:

- Prove that the project can recover from database mistakes before pilot expansion.

Allowed work:

- write a backup/restore runbook,
- run it only in local/staging,
- record sanitized evidence.

Not allowed:

- production backup automation without environment details,
- destructive restore against an unconfirmed database.

Acceptance:

- backup command is documented,
- restore test target is explicit,
- evidence excludes secrets and personal data.

### 2. Performance/index review after real data volume exists

Purpose:

- Review query and index risk only after realistic data volume exists.

Allowed work:

- read-only query inventory,
- EXPLAIN/EXPLAIN ANALYZE in staging/local with realistic data,
- add indexes only when a measured query needs them.

Not allowed:

- speculative indexes without measured slow queries,
- broad schema rewrite.

Acceptance:

- query, endpoint, data volume, plan output, and index decision are recorded.

### 3. Real baseline pilot smoke

Purpose:

- Use `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md` when true baseline files exist.

Allowed work:

- stage scoped baseline,
- validate,
- review row evidence,
- review promotion dry-run evidence,
- promote only approved pilot scope,
- capture sanitized evidence.

Not allowed:

- full company first promotion,
- KPI snapshot as baseline,
- fake master data.

### 4. Real staging IdP evidence

Purpose:

- Prove real login/action behavior with staging IdP and seeded DB.

Allowed work:

- run existing smoke commands,
- capture sanitized evidence.

Not allowed:

- raw token evidence,
- committed secrets,
- widening auth logic to pass smoke.

## P2 - Later Scale And Product Depth

P2 stays intentionally later.

- Mobile BFF expansion only after real mobile screen contracts.
- Push notifications after session/auth and user journeys are stable.
- Full UI/design-system pass after backend/data foundation is calmer.
- Complete EN/TR localization expansion after UI text surfaces stabilize.
- VM checklist depth after BM checklist and score behavior are proven.
- Challenge/social depth after feed moderation and operator needs are proven.

## Global Go / No-Go Rules

Do not start a new module unless the intake interview proves the existing surface cannot carry it.

Do not promote master data without dry-run evidence and sanitized evidence.

Do not build JSON-specific code without a real sample payload or official field list.

Do not change score math while working on evidence, runbooks, or operator visibility.

Every hardening slice must pass root `npm.cmd run check:release` before commit.

## Recommended Order

1. Import decision evidence.
2. Scope/auth regression matrix.
3. DB health and migration evidence.
4. Operator evidence consistency pass.
5. Backup/restore drill when environment is ready.
6. Performance/index review after real data volume exists.

## CODEX DURUST YORUM

The project does not need a new module right now. It needs fewer surprising corners.

The strongest next moves are not flashy: decision evidence, scope regression, DB/migration observability, backup rehearsal, and measured performance review. These protect the project from future chaos without inventing product behavior before real data arrives.

This is how we keep the work from scattering: every new slice must either harden an existing surface or wait.

## Next Logical Step

Start with P0 item 1: Import decision evidence.

It is small, visible, and low risk. It improves operator confidence without touching scoring, import materialization, JSON, master-data promotion, or a new module.
