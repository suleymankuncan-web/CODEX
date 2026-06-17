# Refactor Completion Inventory V1

Status: Active decision refreshed after Architecture Hardening V5 closeout on
2026-05-31

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
- Architecture Hardening V2 closed the remaining planned application-layer
  direct DB allowlist entries, split materialization and Power BI import
  hotspots, made selected auth/workforce/competition transition decisions
  explicit, and added stronger guard pressure for large files and module graph
  growth.
- Architecture Hardening V3 extracted integration import command lifecycle
  orchestration and auth-admin write persistence, then removed
  `IntegrationService` and `AuthAdminRepository` from oversized-source debt.
- Architecture Hardening V4 froze the next behavior-preserving hardening
  targets in
  `docs/evidence/architecture-hardening-v4-pr1-inventory-2026-05-31.md`,
  then closed the safe V4 line through
  `docs/evidence/architecture-hardening-v4-closeout-2026-05-31.md`.
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
- Park remaining write-heavy, auth-sensitive, DB/state-machine,
  generated-script, and redesign-sensitive UI refactors until a concrete
  trigger appears.

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
| `backend/nestjs/src/modules/integration/application/integration.service.ts` | 842 | integration application facade | V3 extracted import command lifecycle and pure response/model helpers; below standard service budget. Park further source/master-data command movement unless concrete trigger appears. |
| `admin-web/src/pages/IntegrationDashboardPage.tsx` | 1354 | redesign-sensitive UI page | Park until redesign or concrete data-risk UX evidence. |
| `admin-web/src/pages/StoreKpiHighlightsPage.tsx` | 155 | Store KPI page container | PR9 architecture hardening split moved model, summary, metric list, and formatter concerns out of the page. Park further visual redesign until a concrete product/UI trigger appears. |
| `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts` | 1194 | validation/promotion orchestration | S02 normalization helper extraction is done; park remaining promotion/write boundary unless concrete trigger appears. |
| `backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts` | 1340 | evidence-heavy E2E | Park unless gate time/flakiness proves test helper extraction value. |
| `admin-web/src/pages/ImportBatchDetailPage.tsx` | 1339 | redesign-sensitive UI page | Park until redesign or concrete import operator bug. |
| `admin-web/src/pages/AdminKpiConfigPage.tsx` | 1339 | redesign-sensitive UI page | Park until redesign or concrete governance/action UX bug. |
| `admin-web/src/pages/StoreRankingsPage.tsx` | 599 | Store rankings page container | PR8 architecture hardening split moved model, table, and detail panel concerns out of the page. Park further visual redesign until a concrete product/UI trigger appears. |
| `backend/nestjs/src/modules/integration/application/materialization.service.ts` | 188 | data materialization orchestration | Architecture Hardening V2 split row status, employee, store, assignment, position, company, region, and batch persistence out of this service; do not reopen unless import routing behavior changes. |
| `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` | 1245 | stage/package/scoring repository facade | Architecture Hardening V5 PR-5 extracted selected stage package plan execution persistence while keeping the service-facing facade. Park scoring, finalization, and broader persistence splits until separate invariant/test decisions. |
| `backend/nestjs/src/modules/auth/auth-admin.repository.ts` | 512 | auth/security repository facade | Architecture Hardening V3 extracted user-account, pilot-binding, action-store, role-assignment, and role-permission write commands. Park further auth-admin movement unless concrete auth/security/product trigger appears. |
| `backend/nestjs/src/shared/openapi-baseline.contract.spec.ts` | 1246 | contract baseline | Park unless contract guard maintainability becomes a real blocker. |
| `scripts/generate-system-flow.mjs` | 1238 | generator infrastructure | Park unless flow precision or generator bug evidence appears. |
| `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts` | 797 | workforce request command persistence facade | Architecture Hardening V4 PR-3 moved audit insert persistence and repeated write-return SQL projections behind focused helpers. Architecture Hardening V5 PR-7 extracted seller-code approval command persistence behind a focused command repository while keeping `WorkforceRequestRepository` as the service-facing facade. Park offboarding/access lifecycle movement unless separate characterization covers it. |
| `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts` | 666 | snapshot orchestration service | PR4 extracted direct DB writes/materialization into `SnapshotRunCommandRepository`; keep service orchestration-only. |
| `backend/nestjs/src/modules/store-ops/application/ranking.service.ts` | 740 | ranking read/scoring application service | PR3 removed broad repository casts and previous helper extraction remains in place. Park further extraction unless a ranking trust/reviewability trigger appears. |

## Architecture Hardening V4 Closed Line

V4 is intentionally narrower than a generic large-file cleanup. It can only
move runtime code after the PR-1 behavior freeze evidence is satisfied.

Closed V4 sequence:

1. Done: `MasterDataBootstrapService` promotion boundary. PR-2 extracted
   promotion readiness, promotable-row assertion, promotion-row builders, and
   promotion readiness summary helpers into
   `master-data-bootstrap-promotion.helpers.ts` after strengthening exact
   promotion command response parity assertions. `master-data-bootstrap.service.ts`
   is now roughly 906 lines.
2. Done: `WorkforceRequestRepository` command persistence boundary. PR-3 kept
   `withTransaction` ownership in the facade, moved audit event insertion into
   `workforce-request-audit.repository.ts`, moved repeated seller-code and
   offboarding write-return projections into `workforce-request-write-sql.ts`,
   and removed the repository from the oversized file allowlist.
3. Done: `CompetitionRepository` selected stage-package-plan review command
   persistence boundary. PR-4 extracted approve/reject review command UPDATE
   and audit persistence into
   `competition-stage-package-plan-review-command.repository.ts`; scoring,
   finalization, and stage execution stayed untouched.
4. Stopped: `backend/nestjs/src/openapi/generate-openapi.ts` helper split.
   PR-5 pre-refactor parity failed because `openapi:generate` rewrites
   `docs/api/openapi.json` from clean `origin/main` before any helper changes.
   Evidence:
   `docs/evidence/architecture-hardening-v4-pr5-openapi-generator-blocker-2026-05-31.md`.
   Do not refactor the generator until the OpenAPI metadata/baseline drift is
   resolved or a separate `Contract Impact: changed` PR is approved.
5. Done: Store targets E2E split. The four Store targets scenarios moved from
   `admin-web/e2e/store-surfaces.spec.ts` into
   `admin-web/e2e/store-targets-surfaces.spec.ts` with the same user-visible
   assertions, API route mocks, fixture meaning, role coverage, and payload
   assertions. Runtime app code and Store UI behavior stayed untouched.
6. Done: Store UI refactor guard foundation. The new
   `scripts/store-ui-refactor-guard.test.mjs` keeps Store redesign stack,
   real-data-only, role-aware navigation, Sales Target Incentive V1 ownership
   for `/store/incentives`, and selected active-source
   legacy/debug/fake-data regressions under script guard.
   No Store screen redesign or runtime UI behavior changed.
7. Done: V4 closeout evidence recorded at
   `docs/evidence/architecture-hardening-v4-closeout-2026-05-31.md`.

The authoritative V4 contract-freeze evidence is:

```text
docs/evidence/architecture-hardening-v4-pr1-inventory-2026-05-31.md
```

## Architecture Hardening V5 Active Line

V5 is the follow-up line for the debts intentionally parked after V4. Its plan
is:

```text
docs/plans/architecture-hardening-v5-plan.md
```

Active V5 order:

1. First: repair or classify OpenAPI generator parity drift before any generator
   helper split. The V4 blocker evidence showed `openapi:generate` rewrites
   `docs/api/openapi.json` from clean `main`, so generator movement is unsafe
   until the contract gate is stable.
2. Second: characterize and then extract exactly one deeper
   `CompetitionRepository` boundary. Scoring, finalization, and stage execution
   still require separate invariant/test decisions and must not be mixed.
3. Third: characterize and then extract exactly one deeper workforce command
   boundary. Seller-code and offboarding command paths stay separate because
   they carry different transaction, audit, employee mutation, and access
   lifecycle risks.

V5 does not reopen broad refactor by line count. Any runtime movement must be
selected by the V5 plan, protected by parity or characterization tests, and
merged through the normal PR/check/review discipline.

V5 is closed. Closeout evidence:
`docs/evidence/architecture-hardening-v5-closeout-2026-05-31.md`.

V5 OpenAPI parity repair status:

- Done in V5 PR-2: generator baseline metadata preservation keeps the tracked
  OpenAPI contract stable when Nest Swagger generation loses DTO, parameter, or
  response metadata.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr2-openapi-parity-repair-2026-05-31.md`.
- Done in V5 PR-3: pure OpenAPI schema/path helpers moved from
  `backend/nestjs/src/openapi/generate-openapi.ts` to
  `backend/nestjs/src/openapi/openapi-schema-helpers.ts`; the generator frozen
  baseline dropped from 5256 to 5169 lines while `docs/api/openapi.json`
  remained unchanged after generation.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr3-openapi-helper-split-2026-05-31.md`.

V5 competition boundary status:

- Done in V5 PR-4: selected stage package plan execution persistence as the
  next and only competition runtime extraction target.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr4-competition-boundary-characterization-2026-05-31.md`.
- Done in V5 PR-5: stage package plan execution persistence moved to
  `backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan-execution-command.repository.ts`.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr5-competition-execution-extraction-2026-05-31.md`.
- Parked: scoring recalculation and finalization persistence/policy remain out
  of scope until separate characterization or golden parity tests exist.

V5 workforce command status:

- Done in V5 PR-6: selected seller-code approval command persistence as the
  next and only workforce runtime extraction target; duplicate handling and
  transaction/mutation expectations are locked by integration coverage.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr6-workforce-command-characterization-2026-05-31.md`.
- Done in V5 PR-7: seller-code duplicate counting and approval command
  persistence moved to
  `backend/nestjs/src/modules/store-ops/infrastructure/workforce-seller-code-command.repository.ts`.
  `WorkforceRequestRepository` remains the service-facing facade and
  offboarding/access lifecycle behavior stayed untouched.
- Evidence:
  `docs/evidence/architecture-hardening-v5-pr7-workforce-seller-code-command-extraction-2026-05-31.md`.
- Parked: offboarding approval and access lifecycle closure remain out of scope
  until separate characterization covers employee termination, assignment
  closure, turnover events, linked user lookup, and access lifecycle calls.

V5 closeout status:

- Done: OpenAPI parity repair, OpenAPI helper split, selected competition stage
  package plan execution persistence extraction, seller-code approval command
  characterization, and seller-code approval command persistence extraction.
- Estimated architecture health after V5: `95/100`.
- Remaining parked risks are finite and trigger-based: competition
  scoring/finalization, workforce offboarding/access lifecycle, further
  generator movement, broad E2E decomposition, and redesign-sensitive frontend
  page splits.

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
- Architecture Hardening V2 materialization entity and row-status extraction.
- Architecture Hardening V2 Power BI parser, normalizer, and reconciliation
  extraction.
- Architecture Hardening V2 StoreOps module graph split.
- Architecture Hardening V2 auth role-assignment command extraction.
- Architecture Hardening V2 workforce request transition policy extraction.
- Architecture Hardening V2 competition stage package plan transition policy
  extraction.
- Architecture Hardening V3 integration import command lifecycle extraction.
- Architecture Hardening V3 auth-admin write command extraction.

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
- Current line-count shape after the later architecture hardening line:
  `ranking.service.ts` roughly 740 lines and `ranking-list.helpers.ts`
  roughly 375 lines. The increase came from explicit read-repository
  injection wiring, not a scoring or ranking behavior change.

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

Status: Done by the read-model helper extraction and V3 closeout helper slices.

Allowed only when:

- The target helper is pure mapping/formatting, not import lifecycle, retry,
  source governance, approval, queue, or raw staging writes.

Result:

- Integration source, store master, personnel master, and supported lookup-list
  read-model helpers now live in `integration-read-model.helpers.ts`.
- Import payload templates now live in `integration-payload-template.helpers.ts`.
- Import batch detail, reconciliation, error-item, mapping-candidate, and
  quality-summary response helpers now live in `import-batch-detail.helpers.ts`.
- Import creation, retry, and external-id approval orchestration now live in
  `integration-import-command.service.ts`.
- `IntegrationService` still owns integration source and master-data command
  orchestration plus read coordination.
- Import lifecycle, retry, source governance, approval, queue, raw staging
  writes, API response shape, auth, DB, and frontend behavior are unchanged.
- Current line-count shape after the slice: `integration.service.ts` roughly
  842 lines, `integration-read-model.helpers.ts` roughly 177 lines,
  `integration-payload-template.helpers.ts` roughly 145 lines, and
  `import-batch-detail.helpers.ts` roughly 332 lines.

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
  Narrowed after Architecture Hardening V3 to focused command repositories;
  reopen only for concrete auth/security product changes.
- Workforce request command/write/status/audit/access lifecycle boundaries.
  Narrowed after Architecture Hardening V2 to SQL persistence and workflow
  boundaries outside the extracted transition policy.
- Competition stage creation, package execution, score recalculation, and
  finalization boundaries.
  Narrowed after Architecture Hardening V2 to scoring, finalization, stage
  execution, and broad persistence outside the extracted stage package plan
  transition policy.
- Integration materialization and raw import write paths.
  Narrowed after Architecture Hardening V3 to source/master-data command
  orchestration and raw staging paths outside the completed materialization and
  import lifecycle splits.
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
