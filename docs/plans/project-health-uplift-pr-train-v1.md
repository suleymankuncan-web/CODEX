# Project Health Uplift PR Train V1

Status: active
Shelf: architecture
Created: 2026-06-08
Use when: executing the Project Health Uplift PR train or checking its stop rules.
Do not use when: making a new feature-intake source of truth.
Last verified: 2026-06-08

## Purpose

This plan raises the practical project health score without adding another
source of truth or opening a broad refactor sprint.

This is an execution plan, not a policy. The source of truth for request intake
remains `docs/plans/request-intake-and-decision-policy.md`; this plan only
orders the PR train that applies that policy to the current health gaps.

Current working estimate:

- architecture/refactor/guard health: about `96/100`
- whole-project operating health: about `88/100`
- target after this train: `91-92/100`

The gap is not missing process. The gap is making the existing process faster,
more enforceable, and more visible in the places where recent real bugs escaped:
affected verification selection, UI prototype parity, Store persona/scope
regression coverage, and app-level observability.

Score impacts below are directional estimates. They are not meant to be summed
mechanically; the final score is reassessed after verification, merged PRs, and
remaining parked risks are known.

## Non-Goals

- Do not create a new policy that competes with
  `docs/plans/request-intake-and-decision-policy.md`.
- Do not reopen broad refactor work.
- Do not add paid providers or new external observability vendors.
- Do not change API shape, DB schema, auth/permission semantics, scoring,
  ranking, snapshot interpretation, queue/import lifecycle, or user workflows
  unless a later PR explicitly stops and receives a separate product/API
  decision.
- Do not treat local smoke, fake data, or prototype demo rows as production
  evidence.

## Source Documents

Read these before starting the train:

- `CONTRIBUTING.md`
- `current-state.md`
- `sokrates.md`
- `discipline.md`
- `docs/plans/request-intake-and-decision-policy.md`
- `docs/process/product-experience-principles.md`
- `docs/plans/decision-registry-v1.md`
- `docs/plans/refactor-completion-inventory-v1.md`
- `docs/plans/operational-observability-review.md`
- `docs/plans/scope-auth-regression-matrix-v1.md`

## PR Train

| PR | Slice | Goal | Risk class | Expected score impact |
| --- | --- | --- | --- | --- |
| PR-1 | Intake/docs consolidation | Keep Request Intake as the only feature/request intake source of truth and link UI parity/refactor inventory docs. | R0 docs/process | +0.5 |
| PR-2 | Affected verification selector | Make targeted verification selection explicit so PRs do not default to full e2e for every change. | R0/R1 docs-script | +1.0 |
| PR-3 | Prototype parity guard/evidence | Make approved prototype implementation evidence repeatable and hard to drift. | R0/R1 docs-script | +0.75 |
| PR-4 | Store persona regression pack | Convert recent Store scope/personnel/KPI/workforce bug classes into targeted regression coverage. | R2/R3 test-only | +1.0 |
| PR-5 | Observability contract scout | Document current app-level observability signals and the exact providerless gap before runtime work. | R0 docs | +0.5 |
| PR-6 | Providerless app-level error foundation | Add the smallest no-paid-provider app-level error/correlation visibility slice if PR-5 proves the contract. | R2/R3 runtime | +1.0 |

## PR-1: Intake / Docs Consolidation

Scope:

- Include this plan file in the PR.
- Include the current local changes in
  `docs/plans/request-intake-and-decision-policy.md`.
- Keep `Request Intake And Decision Policy` as the source of truth.
- Add relationship links to:
  - `docs/process/product-experience-principles.md`
  - `docs/plans/refactor-completion-inventory-v1.md`
- Do not create or keep a separate feature intake policy.
- Do not change runtime code.
- Do not update `current-state.md` yet unless PR-1 is merged as a standalone
  closeout; the train-level closeout owns the final current-state update.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts`

Stop if:

- the change creates a second source of truth,
- the PR tries to rewrite `discipline.md` or `sokrates.md` broadly,
- the docs start prescribing behavior that no verification path can enforce.

## PR-2: Affected Verification Selector

Goal:

Create a repo-native affected verification selector that maps changed files to
the smallest credible verification set. The release gate remains mandatory for
release-class changes; this PR only prevents every small PR from defaulting to
full e2e.

Expected behavior:

```text
small docs/process PR
-> git diff --check
-> npm.cmd run test:scripts when guarded docs/scripts are touched

Store UI-only PR
-> npm.cmd --prefix admin-web run lint
-> npm.cmd --prefix admin-web run build
-> targeted Playwright route/spec

Store KPI PR
-> frontend lint/build
-> targeted store KPI Playwright
-> backend KPI/reporting contract tests if API/read model changed
-> API/OpenAPI check if contract can drift

R5 auth/DB/scoring/queue PR
-> targeted negative tests
-> backend/frontend relevant checks
-> full relevant release/check path
```

Implementation shape:

- Preferred artifact: a small repo-local selector script plus contract tests.
- If an existing script/evidence index already covers the same role, extend it
  instead of creating a duplicate selector.
- The selector output is advisory. It recommends affected checks, but
  `discipline.md` and release-blocking review still decide whether broader
  gates are needed.
- The helper must always show why a full release gate is or is not required.
- The helper must list affected route/service/test families when it can infer
  them; if it cannot infer them, it must say so rather than silently passing.
- It must not weaken, replace, or rename `check:release`.
- If the implementation can be done docs-only with existing guarded commands,
  keep it docs-only and record why no script is needed.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts`
- targeted tests for the selector, if a script is added

Stop if:

- the selector can skip release gates for R5 changes,
- the selector depends on brittle local branch names,
- the selector creates false confidence without listing affected routes/services.
- the selector would require a CI workflow rewrite in the same PR.

## PR-3: Prototype Parity Guard / Evidence

Goal:

Turn the existing prototype-to-product rules into a repeatable PR evidence path.
Approved prototypes are implementation contracts, not loose inspiration.

Scope:

- Reuse existing sources:
  - `docs/process/product-experience-principles.md`
  - `discipline.md`
  - `docs/prototypes/README.md`
- Strengthen evidence expectations only where there is a real gap; do not
  duplicate the full prototype-to-product policy in another file.
- Keep prototype hash/checklist evidence practical.
- Preferred artifact: an evidence template/checklist and, only if useful, a
  script guard that checks locked prototype references or forbidden demo-only
  production leaks.

Minimum UI PR evidence:

- approved prototype/source screenshot/spec reference,
- route/persona/role visibility matrix,
- real data mapping for every visible value/action,
- loading, empty, error, access, and partial-data states,
- desktop and mobile screenshot comparison,
- fake data and prototype-only helper cleanup,
- intentional visual deviations with reasons.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts`
- prototype guard test if the guard is changed
- no runtime build is required unless the PR changes frontend source files

Stop if:

- the PR tries to make all prototypes global theme contracts,
- evidence becomes too heavy for small UI fixes,
- demo-only role switchers or fake rows are allowed into product code.

## PR-4: Store Persona Regression Pack

Goal:

Recent real bugs show the weakest practical surface is not architecture
documents; it is role/scope/date/personnel behavior across Store pages. This PR
should be test-only unless a failing test exposes a confirmed bug that is split
into a follow-up fix PR.

Target bug classes:

- Region Manager assigned-store visibility.
- Store Manager own-store visibility.
- Store KPI selected period and selected store behavior.
- Personnel profile action visibility and `canOpenProfile` behavior.
- Workforce assigned-store rows and norm/actual display.
- Missing personnel target fallback (`Hedef bekleniyor`) rather than synthetic
  HG percentages.

Primary routes:

- `/store/kpis`
- `/store/workforce`
- `/store/rankings`
- `/store/tasks`
- `/store/me`
- `/store/personnel/:employeeId`

Verification:

- targeted Playwright spec(s), preferably split from the broad store surface
  spec only when it improves reviewability without dropping existing coverage,
- targeted backend scope/reporting tests if read policies are touched,
- `npm.cmd --prefix admin-web run build`,
- `npm.cmd --prefix admin-web run lint`,
- `npm.cmd run test:scripts`.

Stop if:

- production behavior must change to make the tests pass,
- fixtures imply access broader than backend authorization allows,
- the test suite becomes slower without a focused spec split,
- one PR mixes test-only characterization with runtime fixes.
- the failing behavior is real and needs code; open a separate fix PR instead
  of expanding this regression-pack PR.

## PR-5: Observability Contract Scout

Goal:

Before runtime observability work, record what the project already has and what
is genuinely missing. This prevents fake dashboards or paid-provider work from
appearing as "observability".

Inspect:

- `/api/health` response fields,
- existing backend structured/error logging,
- correlation id behavior,
- `admin-web` error boundaries and route error states,
- `/admin/operations`,
- alert provider decisions and Better Stack evidence,
- Render/Vercel platform signals,
- current `log-only` observability posture.

Deliverable:

- one docs/evidence note or plan section that classifies:
  - proven signals,
  - controlled-pilot acceptable signals,
  - broad-production blockers,
  - providerless runtime slice candidates,
  - stop conditions.
- an explicit decision on whether PR-6 should proceed, narrow, or stop.

Verification:

- `git diff --check`
- `npm.cmd run test:scripts`

Stop if:

- the PR claims production-grade monitoring without provider/owner evidence,
- it invents new metrics that are not present in code or health responses,
- it proposes a paid provider as a hidden dependency.

## PR-6: Providerless App-Level Error Foundation

Goal:

If PR-5 proves a safe route, add the smallest runtime foundation that improves
operator visibility without a paid provider.

PR-6 is conditional. If PR-5 concludes that a safe providerless runtime slice
would require a migration, provider, new auth semantics, or fake metrics, PR-6
must stop as `not safe yet` instead of forcing implementation.

Allowed candidates:

- frontend route error boundary evidence that keeps users out of blank screens,
- sanitized client-side error event capture if an existing backend endpoint or
  audit-safe path already supports it,
- backend error/correlation visibility surfaced through existing health or
  operations read models,
- `/admin/operations` showing honest app-level error visibility state.

Disallowed without a separate decision:

- new paid observability provider,
- new push/email/Slack notification workflow,
- DB migration,
- production alert escalation policy,
- user-surveillance style client telemetry,
- fake "all healthy" dashboard states.

Verification:

- frontend lint/build,
- backend targeted tests if backend code changes,
- targeted `/admin/operations` Playwright if UI changes,
- `npm.cmd run test:scripts`,
- full release gate only if the slice touches shared health/error handling.

Stop if:

- a migration, queue drain, provider secret, or new auth semantics are required,
- error visibility cannot be proven without fake data,
- rollback is not a plain PR revert.

## Completion Definition

The train is complete when:

- PR-1 through PR-6 are either merged or explicitly stopped with evidence.
- Each merged PR has one review story, rollback by PR revert, and a PR body that
  names what did not change.
- `current-state.md` records the final status and remaining parked risks.
- `docs/plans/decision-registry-v1.md` is updated only if a durable decision
  actually changed.
- Release/verification evidence distinguishes affected checks from full release
  gates.
- No new source-of-truth policy was created.
- The final report includes which PRs were merged, which were intentionally
  stopped, and the updated whole-project health estimate.

## Expected Result

After this train, the project should not merely have more rules. It should have
lower change cost:

- smaller and more accurate PR verification,
- stronger prototype implementation discipline,
- better Store persona regression protection,
- clearer observability gap ownership,
- and a safe first providerless app-level visibility step if the scout supports
  it.
