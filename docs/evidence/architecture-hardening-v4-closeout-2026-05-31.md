# Architecture Hardening V4 Closeout - 2026-05-31

Status: closeout pending this PR

## Scope

Architecture Hardening V4 closed the next bounded hardening line selected by
`docs/evidence/architecture-hardening-v4-pr1-inventory-2026-05-31.md`.

The line reduced growth risk in master-data promotion orchestration, workforce
request write persistence, selected competition review-command persistence,
Store targets E2E reviewability, and future Store UI refactor guardrails.

This line did not change API response shape, DB schema, migrations, auth or
permission semantics, KPI scoring output, ranking sort, checklist weights,
snapshot interpretation, BullMQ behavior, import retry behavior,
materialization lifecycle status, Store UI runtime behavior, or user-facing
workflow behavior.

## Merged PRs

| PR | Commit | Purpose | Risk Reduced |
| --- | --- | --- | --- |
| #571 | `2ac63af98f8eecf21e5b9414c5711f21d6f21d42` | Added the V4 execution plan and PR-before-Codex-review discipline updates. | Converted the next hardening line into ordered small PRs with parity, rollback, and stop conditions. |
| #572 | `7b6d6fc02d98b5a2b487e0ca0ce5b0f40e5cf35c` | Produced the V4 inventory and behavior freeze matrix. | Locked protected behavior, test maps, PR-4 selected boundary, PR-5 generator target, and PR-6 E2E target before runtime refactors. |
| #573 | `5840cfbd80c4a911b6b8e016c7b0ab9d7cf7b626` | Extracted master-data bootstrap promotion helper logic. | Promotion readiness, promotable-row assertions, promotion-row builders, and readiness summary logic moved out of the central service after parity assertions were strengthened. |
| #574 | `3cc9ccae2c373ae16e32c560c527f98144c0c58b` | Split workforce request write helpers. | Audit event insert persistence and repeated seller-code/offboarding write-return projections moved behind focused infrastructure helpers while transaction ownership stayed in the facade. |
| #575 | `9c3c32afcf1748e3fd515d81d96437e2b8157891` | Split selected competition stage package plan review command persistence. | Approve/reject review UPDATE and audit writes moved out of `CompetitionRepository`; scoring, finalization, and stage execution stayed parked. |
| #576 | `d502a52558abd82ab730d0ceeddcc9199f7a9c22` | Recorded the OpenAPI generator parity blocker before code movement. | Prevented an unsafe helper split after clean-main `openapi:generate` rewrote `docs/api/openapi.json` and exposed generated DTO schema metadata drift. |
| #577 | `7ca292682d62b3a5b5b9b9cea5ef1b64e22c8078` | Split Store targets E2E scenarios into a focused spec. | Store targets behavior assertions now have a smaller review/test entrypoint without dropping route mocks, fixture meaning, role coverage, or payload checks. |
| #578 | `c685e311507faefbcf9bf0e475d59a5c95b28cac` | Added Store UI refactor guard foundation. | Future Store UI refactors now have script coverage for stack/process rules and selected active-source legacy/debug/fake-data regressions. |
| This PR | pending merge | Records V4 closeout. | Prevents reopening the same V4 debt line without new evidence and updates the maintained architecture health estimate. |

## Boundary State After V4

Direct `DatabaseService` application allowlist:

- Remains empty.

Store Ops broad repository cast allowlist:

- Remains empty.

Large-source and hotspot state:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
  is roughly 906 lines after PR #573 and stays below its frozen V4 cap.
- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
  is roughly 910 lines after PR #574 and is no longer in the oversized-source
  baseline.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
  is roughly 1295 lines after PR #575. Only the selected stage package plan
  review command persistence moved; broader competition scoring/finalization
  and stage execution remain parked by design.
- `admin-web/e2e/store-surfaces.spec.ts` is roughly 4959 lines after PR #577;
  Store targets scenarios now live in
  `admin-web/e2e/store-targets-surfaces.spec.ts`.
- `backend/nestjs/src/openapi/generate-openapi.ts` remains parked. PR #576
  proved generator output parity is not currently available from clean main, so
  code movement would be a contract-risk PR rather than a behavior-preserving
  helper split.

Guard coverage added or improved:

- `scripts/store-ui-refactor-guard.test.mjs` checks the Store redesign plan for
  `shadcn/ui`, Tailwind v4, lucide, real-data-only, role-aware navigation, and
  parked `/store/incentives` rules.
- The same guard scans active Store page, Store shell/sidebar/navigation,
  Store Action, and Store localization source paths for selected legacy
  class/debug/fake-data regressions while keeping explicit baselines for known
  existing localized copy.

## Verification Record

Representative local gates run across V4:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition-stage-package-plan-transition.policy.spec.ts src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store targets"
npm.cmd --prefix admin-web run test:e2e -- store-targets-surfaces.spec.ts --workers=1
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
git diff --check
```

Remote gates were followed for each PR. PRs were merged only after GitHub/Vercel
checks were green, mergeability was clean, and actionable review comments were
addressed or resolved.

## Remaining Intentional Risk

The project is safer to grow, but not debt-free.

Still parked by design:

- OpenAPI generator helper extraction is blocked by current generated schema
  metadata/baseline drift. Resolve the OpenAPI baseline or run a separate
  `Contract Impact: changed` PR before moving generator internals.
- `CompetitionRepository` still owns scoring, finalization, stage execution,
  and broader persistence paths. These require separate invariant/test
  decisions before movement.
- Deeper workforce seller-code/offboarding command splits remain parked until
  parity tests can prove transaction grouping.
- Store UI redesign remains a product/UI line. V4 added guardrails but did not
  productize or redesign Store screens.
- Remaining broad E2E and generated-script files should be reopened only for a
  concrete gate-time, flake, precision, or reviewability trigger.

## Architecture Health Estimate

Estimated architecture health after V4: `93/100`.

Reasoning:

- The V2 and V3 direct DB and broad repository escape hatches remain closed.
- V4 moved the highest-confidence write/workflow helper boundaries that had
  parity coverage.
- The OpenAPI generator was not refactored because the parity gate failed
  before code movement; that is the main reason this closeout does not claim
  the original `94/100` target.
- Store targets E2E coverage and Store UI refactor guardrails are stronger, but
  they are maintainability guardrails, not product behavior proof.

This score is not production readiness proof. It is a maintainability and
feature-growth estimate based on repository evidence, local verification, and
remote PR gates from the V4 PR line.
