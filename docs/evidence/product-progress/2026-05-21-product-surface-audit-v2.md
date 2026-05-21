# Product Surface Audit V2

## Purpose

Refresh the Product Readiness V1 route decision after the latest technical-debt
and workforce-read boundary line. This is a repo/browser-test evidence pass for
choosing the next product-readiness slices. It does not change code, API shape,
auth, permissions, DB state, KPI/ranking scoring, import lifecycle, competition
state, CSS behavior, or user workflow semantics.

## Sokrates Triage

Claim:

- The next UI/UX work should focus on three high-value surfaces that still have
  clear V1 gaps: Admin KPI Config, Store KPI/Rankings, and
  Integration/Master Data.

Assumptions:

- Current route code, page size, existing Playwright specs, and previous
  product-progress evidence are enough to prioritize surfaces.
- Browser evidence for implementation must come from targeted Playwright or a
  local browser pass in each code slice; this audit only chooses where to look
  first.
- The existing HR Axis / Store Ops design language remains the target:
  operational, dense, readable, and quiet.

Repo evidence:

- `admin-web/src/pages/AdminKpiConfigPage.tsx` remains a large governance
  editor surface.
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx` and
  `admin-web/src/pages/StoreRankingsPage.tsx` remain large store-facing KPI
  and ranking surfaces.
- `admin-web/src/pages/IntegrationDashboardPage.tsx` and
  `admin-web/src/pages/MasterDataBootstrapPage.tsx` remain large operational
  admin surfaces.
- `admin-web/src/features/competitions/StageBuilderForm.tsx` has already been
  reduced substantially, with package-plan UI moved into a companion component.
- `docs/evidence/product-progress/2026-05-20-uiux-v1-route-inventory.md`
  already parks broad redesign and asks for concrete gaps before reopening
  large workflow/form surfaces.
- `docs/plans/technical-debt-resolution-roadmap-v1.md` lists these same
  frontend surfaces as the remaining oversized reviewability/product-readiness
  candidates.

Browser-test evidence:

- `admin-web/e2e/admin-kpi-config.spec.ts` covers governance preview,
  localization, draft editability, and weight-total feedback.
- `admin-web/e2e/store-surfaces.spec.ts` covers the store KPI/ranking family
  indirectly through store performance, ranking, and personnel flows.
- `admin-web/e2e/kpi-benchmark-explainability.spec.ts` covers KPI benchmark
  explanation behavior and should stay in the verification ladder for KPI work.
- `admin-web/e2e/integration-surfaces.spec.ts` covers integration dashboard,
  import detail, and master-data behavior, including recent copy/readability
  and token-retention checks.
- `admin-web/e2e/competition-surfaces.spec.ts` exists for the competition
  surface, but current repo evidence says competition should wait unless a
  fresh browser pass shows a higher-value gap than the KPI/integration work.

Counterargument:

- Page length is not itself a product problem. Some large pages are already
  usable and covered. A visual/browser pass could reveal that another route has
  a sharper operator problem than these first three.

Risk:

- Overall risk is MEDIUM because changes will be user-visible.
- Admin KPI Config is LOW/MEDIUM if limited to form feedback/readability and
  existing tests.
- Store KPI/Rankings is MEDIUM because it is close to scoring trust; no scoring
  or data interpretation changes are allowed.
- Integration/Master Data is MEDIUM/HIGH because import lifecycle and master
  data save flows are operationally sensitive; first slices must be copy,
  overflow, state clarity, or test evidence only.

Door:

- Two-way door for docs and visual/readability changes.
- Near one-way door if a slice starts changing scoring, import lifecycle,
  auth/permission, DB, API response, competition state, or command/write
  semantics. Those are out of scope here.

Stop rules:

- Stop if a proposed improvement needs backend/API/Auth/DB changes.
- Stop if a UI slice changes KPI scoring, ranking interpretation, import
  state transitions, retry behavior, promotion semantics, or competition
  submission payload/state.
- Stop if browser evidence shows broad redesign would be required.
- Stop if a PR can no longer be explained in one paragraph or cleanly reverted.

Verification ladder:

1. Repo diff read and `git diff --check`.
2. `npm.cmd --prefix admin-web run lint`.
3. `npm.cmd --prefix admin-web run build`.
4. Targeted Playwright for the touched surface.
5. If a slice touches generated/API contracts, run OpenAPI/api generate/check.
6. GitHub/Vercel checks plus Codex no-major/thumbs-up before merge.

## First Three Product-Readiness Targets

### 1. Admin KPI Config

Decision:

- Start here.

Why:

- It is explicitly in the requested Product Readiness V1 sequence.
- It has a large page file and a direct targeted Playwright spec.
- The domain is important, but safe UI work can stay in form feedback,
  hierarchy, validation explanation, empty/error/loading clarity, keyboard
  labels, and mobile overflow.

Allowed first slice:

- Improve operator clarity around the KPI config editor without changing config
  persistence, API calls, validation rules, or published/draft semantics.
- Add or strengthen targeted Playwright assertions if a concrete gap is found.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-kpi-config.spec.ts --workers=1
```

### 2. Store KPI / Rankings

Decision:

- Continue after Admin KPI Config.

Why:

- Store KPI and ranking pages are large, user-facing, and trust-sensitive.
- Existing tests cover core behavior, but V1 gaps remain around mobile proof,
  dense table/card readability, first-screen hierarchy, and detail route
  evidence.

Allowed first slice:

- Improve responsive/readability/test coverage for `/store/kpis`,
  `/store/rankings`, or `/store/personnel/:employeeId`.
- Preserve all score, rank, official/preview/no-data, and source-trust
  semantics.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --workers=1
npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts --workers=1
```

### 3. Integration Dashboard / Master Data

Decision:

- Continue after KPI surfaces, unless Admin KPI or Store KPI browser evidence
  exposes a stronger adjacent gap.

Why:

- These are operationally central and still large.
- Previous PRs improved import detail and master-data labels, so this must not
  reopen them broadly.
- The remaining safe gaps are likely mobile overflow, panel density, loading or
  error recovery, and test-evidence improvements.

Allowed first slice:

- One narrow visible improvement in either `/admin/integrations` or
  `/admin/master-data`, backed by existing `integration-surfaces` coverage.
- Do not change upload, retry, evidence export, mapping approval, promotion,
  save behavior, bearer-token behavior, or store-master payloads.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts --workers=1
```

## Parked For Now

### Stage Builder / Competition

Decision:

- Do not start here by default.

Why:

- `StageBuilderForm.tsx` has already been reduced substantially.
- Remaining competition work is close to package-plan and submission behavior.
- It is worth opening only if the fresh KPI/integration browser passes show no
  stronger V1 gap, or if a concrete competition form issue is isolated.

Allowed future slice:

- Readability, accessibility, or test-evidence only.
- No submission payload, package-plan lifecycle, score/finalization, stage
  state, or backend repository behavior changes.

### High-Risk Backlog

Keep parked without a separate decision:

- command/write/auth/permission changes,
- DB migrations,
- API Gateway or service decomposition,
- external provider evidence,
- JSON/source adapter work,
- import lifecycle/retry/promotion semantics,
- KPI/ranking scoring semantics,
- competition state-machine or payload changes.

## PR Batching Guidance

- Do not open one PR per tiny label or assertion.
- Batch only changes that share the same route family, risk class,
  verification ladder, and rollback story.
- Split immediately if a branch starts combining KPI scoring trust with import
  lifecycle, auth/write semantics, or broad visual redesign.

## Next Action

Open a narrow Admin KPI Config V1 product-readiness branch first. Before code,
inspect the page and targeted spec for the smallest concrete gap. If no real
gap appears, record that evidence and move to Store KPI/Rankings instead.
