# Refactor Completion Inventory V1

Status: Active decision as of 2026-05-22

This inventory closes the recurring "large file means keep refactoring" loop.
The project still has large files, but they are no longer all active refactor
debt. From here on, refactor work must be chosen from this finite active list
or be explicitly reopened by new product, risk, test, or reviewability evidence.

## Sokrates Decision

Claim:

- Generic refactor debt should be converted into a bounded active backlog plus
  clear parked triggers.

Repository evidence:

- The original high-risk CSS, page, repository, API contract, TypeScript,
  read-boundary, and first refactor-inventory lines have already landed across
  the PR #300 through PR #422 sequence.
- `index.css` is no longer the active structural blocker.
- Store approvals and store checklists have completed their first structural
  passes and are below the earlier danger zone.
- Reporting, integration, auth-admin, competition, and workforce repositories
  already have boundary inventories or completed safe read-boundary passes.
- The user has said major page/content/design changes are coming, so broad UI
  polish or page-component splits are likely to be throwaway work right now.

Counterargument:

- Several files are still above the soft line-count guardrails. Ignoring them
  completely would let real service/test complexity accumulate under a "parked"
  label.

Decision:

- Close broad refactor as an open-ended theme.
- Keep only a few behavior-preserving, UI-independent, test-covered candidates
  active.
- Park write-heavy, auth-sensitive, DB/state-machine, generated-script, and
  redesign-sensitive UI refactors until a concrete trigger appears.

Risk:

- MEDIUM overall. The inventory is docs-only, but it controls future code
  movement in sensitive backend domains.

Door:

- Two-way door. Future evidence can reopen any parked item, but only with a
  narrower decision and verification ladder.

## Current Hotspot Snapshot

This snapshot is a triage input, not a mandate to split every file.

| File | Lines | Current classification | Decision |
| --- | ---: | --- | --- |
| `backend/nestjs/src/openapi/generate-openapi.ts` | 4967 | generator infrastructure | Park unless schema generation bug or reviewability blocker appears. |
| `admin-web/e2e/store-surfaces.spec.ts` | 4034 | broad E2E safety net | Park unless gate time/flakiness or reviewability becomes a real blocker. |
| `backend/nestjs/src/modules/store-ops/application/reporting.service.ts` | 1608 | backend application orchestration | PR3 architecture hardening removed broad read-repository constructor casts; park further reporting movement unless a concrete scoring/reporting trigger appears. |
| `admin-web/src/pages/MasterDataBootstrapPage.tsx` | 1690 | redesign-sensitive UI page | Park until the upcoming page/content redesign touches it or a blocking UX bug appears. |
| `admin-web/e2e/competition-surfaces.spec.ts` | 1557 | broad competition E2E | Park unless gate time/flakiness or helper extraction evidence appears. |
| `backend/nestjs/src/modules/integration/application/integration.service.ts` | 1439 | mixed read/write orchestration | S04 read-model helper extraction is done; park command/import lifecycle behavior unless concrete trigger appears. |
| `admin-web/src/pages/IntegrationDashboardPage.tsx` | 1354 | redesign-sensitive UI page | Park until redesign or concrete data-risk UX evidence. |
| `admin-web/src/pages/StoreKpiHighlightsPage.tsx` | 1351 | redesign-sensitive UI page | Park until redesign or concrete KPI trust/overflow bug. |
| `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts` | 1194 | validation/promotion orchestration | S02 normalization helper extraction is done; park remaining promotion/write boundary unless concrete trigger appears. |
| `backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts` | 1340 | evidence-heavy E2E | Park unless gate time/flakiness proves test helper extraction value. |
| `admin-web/src/pages/ImportBatchDetailPage.tsx` | 1339 | redesign-sensitive UI page | Park until redesign or concrete import operator bug. |
| `admin-web/src/pages/AdminKpiConfigPage.tsx` | 1339 | redesign-sensitive UI page | Park until redesign or concrete governance/action UX bug. |
| `admin-web/src/pages/StoreRankingsPage.tsx` | 1330 | redesign-sensitive UI page | Park until redesign or concrete ranking trust bug. |
| `backend/nestjs/src/modules/integration/application/materialization.service.ts` | 1328 | data materialization/write path | Park; high data behavior risk without an invariant/test decision. |
| `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` | 1325 | stage/package/scoring repository facade | Park remaining writes/finalization until a separate invariant/test decision. |
| `backend/nestjs/src/modules/auth/auth-admin.repository.ts` | 1278 | auth/security write repository facade | Park write boundaries unless a concrete auth/security/product trigger appears. |
| `backend/nestjs/src/shared/openapi-baseline.contract.spec.ts` | 1246 | contract baseline | Park unless contract guard maintainability becomes a real blocker. |
| `scripts/generate-system-flow.mjs` | 1238 | generator infrastructure | Park unless flow precision or generator bug evidence appears. |
| `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts` | 1226 | workforce command/write lifecycle facade | Park remaining command/status/audit/access lifecycle work. |
| `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts` | 732 | snapshot orchestration service | PR4 extracted direct DB writes/materialization into `SnapshotRunCommandRepository`; keep service orchestration-only. |
| `backend/nestjs/src/modules/store-ops/application/ranking.service.ts` | 970 | ranking read/scoring application service | Active first code candidate: pure helper extraction with existing tests. |

## Completed Or No Longer Active

These areas should not keep resurfacing as generic refactor prompts:

- CSS entry split / `index.css` line.
- API contract drift / generated client batch line.
- Frontend TypeScript strictness baseline.
- Reporting repository safe read-boundary line.
- Integration repository safe read-boundary line.
- Auth admin lookup, audit, and user-account read-boundary lines.
- Competition stage-plan, read, team-template read, and team-template command
  boundary lines.
- Workforce seller-code, offboarding, and lookup read-boundary lines.
- Store approvals first structural pass.
- Store checklists first structural pass.

If one of these areas is reopened, the trigger must be a concrete bug, product
change, failing gate, reviewability blocker, or explicit user decision.

## Active Refactor Backlog

### S01: RankingService Pure Helper Extraction

Risk: LOW to MEDIUM

Status: Done by the `RankingService` list-helper extraction slice.

Why first:

- It is UI-independent and survives the upcoming page redesign.
- It has a focused `ranking.service.spec.ts` test suite.
- The likely extraction target is pure ranking/filter/scoring helper logic, not
  API shape, auth, DB schema, or user workflow.

Guardrails:

- Do not change ranking score math, sort semantics, masking rules, included
  snapshot interpretation, API response shape, auth, DB, or frontend copy.
- Stop if extraction requires changing repository calls, DTOs, query shape, or
  rank interpretation.

Verification ladder:

```powershell
npm.cmd --prefix backend/nestjs test -- ranking.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

Climb to reporting E2E only if the diff touches shared reporting or leaderboard
contracts.

Result:

- Pure ranking list helpers now live in `ranking-list.helpers.ts`.
- `ranking.service.ts` stays focused on repository reads, KPI profile/scoring
  orchestration, and response assembly.
- Ranking score math, sort semantics, masking rules, API response shape, auth,
  DB, and frontend behavior are unchanged.
- Current line-count shape after the slice: `ranking.service.ts` roughly 627
  lines and `ranking-list.helpers.ts` roughly 375 lines.

### S02: MasterDataBootstrapService Validation Boundary

Risk: MEDIUM

Status: Done by the normalization/hash/read-helper extraction slice.

Why after S01:

- It has focused validation, read-model, promotion, and staging service specs.
- The safest opportunity is validation/classification helper extraction.
- It reduces a real application-service hotspot without touching UI redesign.

Guardrails:

- Do not change row readiness classification, conflict handling, promotion
  eligibility, live `ops.*` writes, API response shape, DB schema, or import
  lifecycle.
- Stop if the extraction crosses into promotion commands or repository writes.

Verification ladder:

```powershell
npm.cmd --prefix backend/nestjs test -- master-data-bootstrap-validation.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- master-data-bootstrap-read-models.service.spec.ts master-data-bootstrap-promotion.service.spec.ts master-data-bootstrap-staging.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

Result:

- Pure bootstrap normalization, row hashing, validation-result assembly, and
  normalized field readers now live in
  `master-data-bootstrap-normalization.helpers.ts`.
- `master-data-bootstrap.service.ts` stays focused on staging, validation,
  readiness, promotion orchestration, and repository coordination.
- Row readiness classification, conflict handling, promotion eligibility,
  live `ops.*` writes, API response shape, DB schema, and import lifecycle are
  unchanged.
- Current line-count shape after the slice: `master-data-bootstrap.service.ts`
  roughly 1194 lines and `master-data-bootstrap-normalization.helpers.ts`
  roughly 340 lines.

### S03: ReportingService Test-Map And Pure Helper Candidate

Risk: MEDIUM to HIGH

Status: Done by the KPI config helper extraction slice.

Why not first:

- It is broad and sits near KPI config, live/closed performance, reports,
  ranking, and personnel profile behavior.
- Existing specs are good, but the service has a wider blast radius than
  `RankingService`.

Allowed first move:

- Docs/test-map or one pure helper extraction with exact existing tests.

Guardrails:

- Do not change KPI scoring, benchmark math, live/closed fallback, personnel
  profile access, response shape, API path, auth, or DB behavior.

Result:

- KPI config row resolution, default config assembly, published-version metadata
  mapping, and KPI config input validation now live in
  `reporting-kpi-config.helpers.ts`.
- `ReportingService` still owns repository orchestration, KPI highlights,
  performance profiles, live/closed leaderboard fallback, and response assembly.
- KPI scoring, benchmark math, live/closed fallback, personnel profile access,
  API response shape, auth, DB, and frontend behavior are unchanged.
- Current line-count shape after the slice: `reporting.service.ts` roughly 1608
  lines and `reporting-kpi-config.helpers.ts` roughly 241 lines.

### S04: IntegrationService Pure Mapping Helper Extraction

Risk: MEDIUM

Status: Done by the read-model helper extraction slice.

Allowed only when:

- The target helper is pure mapping/formatting, not import lifecycle, retry,
  source governance, approval, queue, or raw staging writes.

Result:

- Integration source, store master, personnel master, and supported lookup-list
  read-model helpers now live in `integration-read-model.helpers.ts`.
- `IntegrationService` still owns import creation, source governance,
  materialization dispatch, retry, approval, reconciliation, and repository
  orchestration.
- Import lifecycle, retry, source governance, approval, queue, raw staging
  writes, API response shape, auth, DB, and frontend behavior are unchanged.
- Current line-count shape after the slice: `integration.service.ts` roughly
  1439 lines and `integration-read-model.helpers.ts` roughly 109 lines.

### S05: Test Suite Helper Extraction

Risk: LOW to MEDIUM

Status: Conditional only; not an active refactor candidate without real gate
pain, flakiness, or review friction.

Allowed only when:

- A broad spec creates real gate pain, flakiness, or review friction.
- The split preserves test names/coverage and does not weaken release evidence.

## Parked Until Triggered

Do not refactor these only because of line count:

- Redesign-sensitive frontend pages and competition/store surfaces.
- Auth admin write/security boundaries.
- Workforce request command/write/status/audit/access lifecycle boundaries.
- Competition stage creation, package execution, score recalculation, and
  finalization boundaries.
- Integration materialization and raw import write paths.
- Snapshot rerun/materialization paths.
- OpenAPI and system-flow generator scripts.

Unpark conditions:

- A concrete bug or failing gate.
- A product change already touching the same domain.
- A security/auth/data-risk decision with explicit invariants.
- A repeated reviewability blocker.
- A user-approved technical slice with a named verification ladder.

## Definition Of Refactor Done

Broad refactor is considered closed as a standing project theme when:

- This inventory is linked from `current-state.md` and the technical roadmap.
- Future "what next?" decisions use the active backlog above instead of generic
  large-file prompts.
- Parked areas have explicit unpark triggers.
- The finite active code candidates have either landed or have explicit
  conditional triggers.

Net decision:

- The project is not debt-free.
- The generic "refactor debt" loop is closed.
- Continue only with a new concrete trigger; test-suite helper extraction is
  conditional on real gate pain, flakiness, or review friction.
- File Size Guard V1 keeps the loop closed by enforcing source-file size
  budgets in `scripts/file-size-guard.test.mjs`: new active source files must
  stay within standard limits, and existing oversized source files are frozen at
  their current baseline unless Sokrates explicitly reopens the exception.
