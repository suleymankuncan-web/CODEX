# GSM Onay KPI And Store Surface Fixes V1 Closeout

Date: 2026-06-21

Plan:
`docs/superpowers/plans/2026-06-21-gsm-onay-kpi-and-store-surface-fixes-v1.md`

Status: runtime PR train closed through PR #769, PR #770, and PR #771; this
document is the PR-4 closeout evidence artifact.

## Scope

This PR train fixes three active Store UI regressions and adds `GSM_ONAY` as a
real store-level KPI.

Implemented outcomes:

- `/store/workforce`: Region Manager row grid keeps the action column inside
  the Store shell, metric icons are centered, and the existing detail workflow
  remains available.
- `/store/incentives`: Region Manager final prim amount editing keeps the raw
  edit string while focused and only formats on blur/save/reset/person switch.
- GSM approval import: `GSM_ONAY` is added through the KPI catalog, score
  profile, normalization, materialization, ranking sort allowlist, and generated
  API artifacts.
- Store score weights are now `TARGET_ACHIEVEMENT=35`, `CR=20`, `ATV=15`,
  `UPT=15`, `BM_CHECKLIST=5`, `VM_CHECKLIST=5`, `GSM_ONAY=5`.
- `/store/rankings`: store-row action/detail drawer was removed and the store
  table now shows `GSM Onayı`; personnel detail behavior remains unchanged.
- `/store/kpis`: Store Manager and Region Manager KPI surfaces render
  `GSM Onayı` when the API/config surface returns that metric.

## PR Train

| Slice | PR | Merge commit | Outcome |
| --- | --- | --- | --- |
| PR-1 UI regression fixes | #769 | `76882d4364ac5185cd424879d86c8ca8a64ef5a7` | Fixed workforce row/action fit and incentive final amount editing without changing contracts. |
| PR-2 GSM KPI/import/scoring | #770 | `013dedea255fc9bd35b54acea56e0bee9aa96145` | Added `GSM_ONAY` to KPI definition/profile/import/materialization/scoring/ranking contract and regenerated API artifacts. |
| PR-3 frontend visibility | #771 | `ced4cac17eff0823024c13df2dfb9ed8f19bd458` | Displayed `GSM Onayı` in rankings and KPI surfaces, removed store-row ranking action/detail, and updated fixtures. |
| PR-4 closeout evidence | this PR | pending | Records import/UI smoke evidence and passes the final release gate. |

## Excel Contract

The accepted GSM approval report shape is:

```text
sheet=Export
headers=["Mağaza Kodu", "Mağaza Adı", "Gsm Onay %"]
```

Rules:

- `Mağaza Kodu` maps to `sourceStoreId`.
- `Mağaza Adı` maps to `storeName`.
- `Gsm Onay %` maps to `GSM_ONAY`.
- Values between `0` and `1` are treated as decimal ratios.
- Values above `1` and up to `100` are treated as percentages and converted to
  ratios for score evaluation.
- Store matching prefers `Mağaza Kodu`; store name matching is only fallback.
- Blank/null GSM values and unmatched stores produce row-level feedback and do
  not synthesize zero KPI actuals.

The user-supplied `C:\Users\suley\Downloads\Ocak GSM.xlsx` file was not added
to the repository. Tests use sanitized fixture rows instead.

## Import Smoke Evidence

PR #770 includes targeted tests that prove the import path with sanitized rows:

- `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.spec.ts`
  normalizes the sample row:

```text
Mağaza Kodu=SM182
Mağaza Adı=Balıkesir 10 Burda AVM
Gsm Onay %=0.9120521172638436
```

- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
  covers one valid GSM row, one null GSM row, and one unmatched store code.
- `backend/nestjs/src/modules/integration/application/kpi-materialization.service.spec.ts`
  materializes `GSM_ONAY` with `actual_value` as display percentage points and
  `achievement_rate` as the ratio used by scoring.
- `backend/nestjs/src/modules/store-ops/application/performance-score-evaluator.service.spec.ts`
  proves `GSM_ONAY` contributes the new 5-point score weight when present and
  remains visible as missing without inventing a score when absent.
- `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
  proves `sortKey=GSM_ONAY` is accepted for store rankings and scored from
  `achievement_rate`.

PR #770 verification commands:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/kpi-import-normalization.service.spec.ts src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/kpi-materialization.service.spec.ts src/modules/integration/application/materialization.service.spec.ts src/modules/store-ops/application/performance-score-evaluator.service.spec.ts src/modules/store-ops/application/kpi-config.contract.spec.ts src/modules/store-ops/application/ranking.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd run test:scripts
git diff --check
git diff --cached --check
```

Results recorded on PR #770: pass.

## UI Smoke Evidence

PR #769 and PR #771 include targeted Playwright coverage for the affected Store
surfaces:

- `/store/workforce`: row/action fit and centered metric icon regressions are
  covered in `admin-web/e2e/store-surfaces.spec.ts`.
- `/store/incentives`: `admin-web/e2e/store-incentives-projection.spec.ts`
  fills final amount with `1500000`, asserts the focused edit value remains
  `1500000`, and asserts the submitted normalized value is `1500000.00`.
- `/store/rankings`: `admin-web/e2e/store-surfaces.spec.ts` asserts the store
  table header contains `GSM Onayı`, the store table no longer exposes a store
  `Aksiyon` header, and store rows do not show `Detay aç`.
- `/store/kpis`: `admin-web/e2e/store-surfaces.spec.ts` asserts Store KPI and
  Region Manager KPI fixtures render `GSM Onayı` and that Region Manager
  sorting sends `sortKey=GSM_ONAY`.

PR #769 verification commands:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store workforce"
npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts
```

Results recorded on PR #769: pass after rerunning the Playwright suites
serially because one parallel attempt competed for the same preview port.

PR #771 verification commands:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store rankings|store KPI|region manager store KPI"
git diff --check
git diff --cached --check
```

Results recorded on PR #771: pass.

## Contract Impact

Contract Impact: none for this PR-4 closeout evidence slice.

The PR train contract change happened intentionally in PR #770:

- new store KPI code: `GSM_ONAY`;
- new GSM approval upload handling for the report headers listed above;
- store score profile weights changed to include `GSM_ONAY=5`;
- OpenAPI and admin-web generated API types were regenerated.

This closeout PR does not add runtime code, API shape, DB schema, auth,
permission, scope, scoring, import, ranking, checklist, workforce, or incentive
workflow changes.

## PR-4 Local Verification

Commands run on `codex/gsm-onay-pr4-closeout-evidence`:

```powershell
npm.cmd run check:release
git diff --check
```

Results:

- `npm.cmd run check:release`: pass.
- Root script tests: pass.
- Admin-web release path: pass, including `313/313` Playwright tests and `npm
  audit --omit=dev` with `0` vulnerabilities.
- Backend release path: pass, `158/158` Jest suites and `1011/1011` tests.
- Known non-failing noise: Vite chunk-size warning and local Vite proxy
  `ECONNREFUSED` logs for Store Action endpoints while no backend proxy target
  was running. The release gate exited successfully.
- The release gate regenerated older Store Incentives visual evidence PNGs as a
  side effect; those generated binary changes were restored because they are not
  part of this PR-4 closeout scope.
- `git diff --check`: pass.

## Residual Risk

- Historical GSM values only exist for periods that have imported GSM files.
- Stores without matched store code/name show the existing missing-data state.
- Future Nebim direct integration may replace the batch upload path.
- This closeout records local and PR-level evidence only; it does not claim
  protected staging upload proof or broad production readiness.

## Final State

After PR #771, local `main` was aligned with `origin/main` at
`ced4cac1 Show GSM approval on store KPI surfaces (#771)` before this closeout
branch was created.
