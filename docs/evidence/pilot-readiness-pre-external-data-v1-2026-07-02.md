# Pilot Readiness Pre External Data V1 Evidence

## Reader And Action

Reader: pilot operator, future Codex session, product owner, or engineer preparing HR Axis before external/Nebim data arrives.

Action: use this evidence to see which pilot-facing surfaces are already covered, which gaps should become follow-up PRs, and which data-quality contracts must exist before external data work starts.

## Scope

This is PR1 audit/evidence for `docs/superpowers/plans/2026-07-02-pilot-readiness-pre-external-data-v1.md`.

Contract impact:

- No API shape changes.
- No DB schema changes.
- No auth/scope changes.
- No scoring/ranking/incentive/checklist formula changes.
- No external provider integration.
- No fake data.
- No runtime behavior changes.

## Baseline

- Date: 2026-07-02
- Branch: `codex/pilot-readiness-pre-external-data-audit`
- Base: `origin/main` at `f1188d72 fix: polish checklist modal mobile copy (#850)`
- Environment inspected: local repo and local Playwright mocked smoke.
- External data status: Nebim/dış bağlantı field shape and access still pending.
- Unrelated dirty files observed and excluded:
  - `docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/*.png`

## Verification Evidence

Command:

```powershell
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
```

Result:

```text
3 passed (26.4s)
```

Coverage from this smoke:

- `core admin routes open without unavailable states`
- `core store routes open without unavailable states`
- `protected route refresh returns to the same route`

Important limitation:

- This is local mocked Playwright evidence, not live staging persona evidence.
- It proves route shell health and mocked API behavior for selected core surfaces.
- It does not prove live Clerk persona setup, live staging data quality, or external provider readiness.

## Source Evidence

Store route source:

- `admin-web/src/app/store-route-registry.ts:144` defines company-store incentive eligibility.
- `admin-web/src/app/store-route-registry.ts:156` gates `/store/incentives` to `STORE_MANAGER` and `REGION_MANAGER` plus company store eligibility.
- `admin-web/src/app/store-route-registry.ts:165` defines `/store/home`.
- `admin-web/src/app/store-route-registry.ts:178` defines `/store/checklists`.
- `admin-web/src/app/store-route-registry.ts:192` defines `/store/tasks`.
- `admin-web/src/app/store-route-registry.ts:203` defines `/store/kpis`.
- `admin-web/src/app/store-route-registry.ts:214` defines `/store/me`.
- `admin-web/src/app/store-route-registry.ts:233` defines `/store/rankings`.
- `admin-web/src/app/store-route-registry.ts:244` defines `/store/feed`.
- `admin-web/src/app/store-route-registry.ts:278` defines `/store/incentives`.
- `admin-web/src/app/store-route-registry.ts:301` defines `/store/targets`.
- `admin-web/src/app/store-route-registry.ts:314` defines `/store/workforce`.
- `admin-web/src/app/store-route-registry.ts:325` defines `/store/reports`.
- `admin-web/src/app/store-route-registry.ts:337` defines persona-specific navigation ordering.

Admin route source:

- `admin-web/src/app/admin-shell.tsx:56` defines `adminRoute`.
- `admin-web/src/app/admin-shell.tsx:92` gates `/admin/operations` to `SUPER_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:96` gates `/admin/data-quality` to `SUPER_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:100` gates `/admin/integrations` to `SUPER_ADMIN` and `INTEGRATION_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:108` gates `/admin/master-data` to `SUPER_ADMIN`, `HR_ADMIN`, and `INTEGRATION_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:140` gates `/admin/reports` to `SUPER_ADMIN` and `REPORT_VIEWER`.
- `admin-web/src/app/admin-shell.tsx:164` gates `/admin/targets` to `SUPER_ADMIN`, `REPORT_VIEWER`, and `REGION_MANAGER`.
- `admin-web/src/app/admin-shell.tsx:168` gates `/admin/incentives` to `SUPER_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:172` gates `/admin/kpi-config` to `SUPER_ADMIN`.
- `admin-web/src/app/admin-shell.tsx:180` gates `/admin/auth` to `SUPER_ADMIN`.

Existing route matrix:

- `docs/architecture/pilot-route-role-matrix.md` classifies pilot/admin/store routes and their intended role boundaries, but this PR1 audit found it is stale for some active Store/Admin routes.

Audit delegation:

- Store route/persona audit: read-only, no file edits, no tests.
- Admin route/persona audit: read-only, no file edits, no tests.
- Friction/performance audit: read-only, no file edits, no secrets/env values.

## Persona Route Matrix

| Persona | Route | Expected | Evidence | Status | Notes |
|---|---|---:|---|---|---|
| Admin | `/admin/auth` | visible | `pilot-smoke.spec.ts` core admin route; `AuthDashboardPage.tsx` list limits clamp to 100/200 | covered local | Prior `limit must not be greater than 200` risk is guarded by `admin-web/e2e/auth-admin-surfaces.spec.ts`. |
| Admin | `/admin/master-data` | visible | `pilot-smoke.spec.ts` core admin route; separate `master-data-surfaces.spec.ts` exists | covered local | User reported in-page jank recently; performance measurement remains a follow-up candidate. |
| Admin | `/admin/integrations` | visible | `pilot-smoke.spec.ts` core admin route | covered local | Current active external source path remains Power BI/Excel. |
| Admin | `/admin/operations` | visible | `operations-control-tower.spec.ts` and `operations-surfaces.spec.ts` cover route behavior | covered by targeted specs | Not in core pilot-smoke list. |
| Admin | `/admin/reports` | visible | `reports-surfaces.spec.ts` covers route behavior | covered by targeted specs | Not in core pilot-smoke list. |
| Admin | `/admin/targets` | visible | `pilot-smoke.spec.ts` core admin route | covered local | Region manager can also access `/admin/targets` by admin route role. |
| Admin | `/admin/incentives` | visible | `admin-incentives.spec.ts` covers route behavior | covered by targeted specs | Super-admin only. |
| Admin | `/admin/kpi-config` | visible | `admin-kpi-config.spec.ts`, `kpi-config-surfaces.spec.ts`, `kpi-config-versioning.spec.ts` cover route behavior | covered by targeted specs | Super-admin only. |
| Region Manager | `/store/home` | visible | `pilot-smoke.spec.ts` core store route uses `/store`; store route registry | covered local | Assigned region/store data still needs live persona smoke. |
| Region Manager | `/store/kpis` | visible | `pilot-smoke.spec.ts` core store route; `store-surfaces.spec.ts` region KPI tests | covered local/targeted | User recently noted 29 vs 30 store count mismatch; keep as live data audit item. |
| Region Manager | `/store/rankings` | visible | `pilot-smoke.spec.ts`; `store-surfaces.spec.ts` rankings tests | covered local/targeted | Long store-name layout has targeted e2e coverage. |
| Region Manager | `/store/checklists` | visible | `pilot-smoke.spec.ts`; checklist session modal e2e; route registry | covered local/targeted | Current modal polish line merged through PR #850. |
| Region Manager | `/store/tasks` | visible | `pilot-smoke.spec.ts`; `store-surfaces.spec.ts` tasks tests | covered local/targeted | Region manager read-only remediation visibility should stay scoped. |
| Region Manager | `/store/targets` | visible | `store-targets-surfaces.spec.ts`; route registry | covered by targeted specs | Not in core pilot-smoke list. |
| Region Manager | `/store/incentives` | visible for company stores | `pilot-smoke.spec.ts`; incentive specs; route registry company-store gate | covered local/targeted | Initial perceived slowness remains performance candidate. |
| Region Manager | `/store/workforce` | visible | `store-surfaces.spec.ts`; `store-workforce-norm-status.spec.ts`; route registry | covered by targeted specs | Not in core pilot-smoke list. |
| Region Manager | `/store/feed` | visible and can post | `pilot-smoke.spec.ts`; `feed-surfaces.spec.ts`; route registry | covered local/targeted | Store roles read-only/post distinction should remain role-scoped. |
| Region Manager | `/store/reports` | visible | `store-surfaces.spec.ts` and `store-reports.spec.ts`; route registry | covered by targeted specs | Not in core pilot-smoke list. |
| Store Manager | `/store/home` | visible | route registry; `store-surfaces.spec.ts` store manager home/nav coverage | covered targeted | Live company-store SM persona still needs staging evidence. |
| Store Manager | `/store/incentives` | visible for company store only | route registry `canOpenStoreIncentives`; incentive e2e coverage | covered targeted | Store manager should not see BM approval package flow. |
| Store Personnel | `/store/me` | visible | `pilot-smoke.spec.ts`; `store-surfaces.spec.ts` personnel tests | covered local/targeted | Personal performance only. |
| Store Personnel | `/store/checklists` | forbidden | `store-surfaces.spec.ts` direct route denial tests; route registry excludes `personnel` | covered targeted | Negative route boundary exists. |

## Store Friction Pattern Audit

Searches performed:

```powershell
rg -n "Veri yok|Kaynak yok|UUID|uuid|scope|API|DB|mock|fake|FIXME|placeholder|\\.id\\b|userId|storeId|regionId" admin-web/src/pages admin-web/src/features
rg -n "refetchInterval|setInterval|poll|setTimeout" admin-web/src/pages admin-web/src/features
rg -n "limit must not be greater|limit.*200|Limit" admin-web/src backend/nestjs/src admin-web/e2e -g "*.ts" -g "*.tsx"
```

Findings:

- No Store/Admin page-level `refetchInterval` was found in the inspected page sources.
- `admin-web/src/features/auth/clerk-session.tsx` uses `window.setInterval` for Clerk session/token maintenance, not page polling.
- `StoreChecklistsPage.tsx` and feed/pilot pages use `setTimeout` for autosave, archive/reset, or state transitions; no 30-second page refresh pattern was found.
- Auth workbench list limits are clamped:
  - `admin-web/src/pages/AuthDashboardPage.tsx:71` sets assignment list limit `200`.
  - `admin-web/src/pages/AuthDashboardPage.tsx:72` sets user list limit `100`.
  - `admin-web/src/features/auth/api.ts:60` defines max auth admin list limit `200`.
  - `admin-web/e2e/auth-admin-surfaces.spec.ts:370` asserts list query limits stay within contract.

## Performance Candidates

| Route | Concern | Evidence | Root cause hypothesis | Fix decision |
|---|---|---|---|---|
| `/store/incentives` | User reported slow initial load | `StoreIncentivesPage.tsx` has one main incentives query and several local projection maps; no polling found | likely backend/query/data volume or initial projection cost; needs measurement | PR4 only if measurable evidence shows fixable frontend root cause |
| `/admin/master-data` | User reported in-page jank | Master data route has dedicated e2e coverage; no PR1 behavior change | likely large table/filter rendering or repeated derived lists | PR4 candidate after route-specific measurement |
| `/store/workforce` | Region Manager view can fan out to `2N + 1` requests | `store-workforce-region-view.tsx` loads org stores, then employees and headcount per scoped store | request fan-out becomes visible with 30+ stores and refresh refetches all | PR4 candidate: aggregate server-side or lazy-load details |
| `/store/kpis` | Monthly trend can issue one query per available period | `store-kpis-command-deck.tsx` uses `useQueries` across monthly periods | history grows with time and repeats summary-like reads | PR4 candidate: cap recent months or use a trend endpoint |
| `/store/targets` | Target approval page can fetch all request pages before month filtering | `targets/api.ts` pages `getAllTargetDistributionRequests()` with limit 200 | external history growth makes initial route heavier | PR4 candidate: current/latest period query first |
| `/admin/targets` | Admin target queue shares all-pages request behavior | `TargetApprovalQueuePage.tsx` filters/slices after all pages | same external-data scaling risk as Store targets | PR4 candidate with Store target fix |
| `/store/rankings` | Dense table and long names | `store-surfaces.spec.ts` has one-line long-name coverage and overflow checks | prior UI risk already guarded | no PR4 unless live pilot reproduces |
| `/store/kpis` | Store count mismatch risk in live BM data | route/e2e coverage exists; live data discrepancy was user-observed | likely data/scope/count source mismatch, not UI-only | PR4 only after live evidence confirms current mismatch |
| `/store/targets` | Important approval flow not in core smoke | `store-targets-surfaces.spec.ts` has targeted coverage | smoke pack gap rather than product bug | PR3 candidate |
| `/store/workforce` | Important norm kadro flow not in core smoke | `store-surfaces.spec.ts` and `store-workforce-norm-status.spec.ts` cover behavior | smoke pack gap rather than product bug | PR3 candidate |
| `/store/reports` | Important Excel package route not in core smoke | `store-reports.spec.ts` and `store-surfaces.spec.ts` cover route/export behavior | smoke pack gap rather than product bug | PR3 candidate |

## Open Findings

| Finding | Severity | Evidence | Recommended PR | Why |
|---|---:|---|---|---|
| Core pilot smoke does not include `/store/targets`, `/store/workforce`, `/store/reports`, `/admin/operations`, `/admin/reports`, `/admin/incentives`, or `/admin/kpi-config` | P2 | Dedicated specs exist, but `pilot-smoke.spec.ts` does not make them part of one pilot readiness route loop | PR3 | This is a smoke-pack completeness gap, not a runtime bug. |
| `/store/workforce` Region Manager view can fan out to `2N + 1` requests | P1 | Read-only audit found org stores plus per-store employees/headcount calls | PR4 if route measurement confirms user impact | This is the clearest Store route scaling risk before 30+ store pilot usage. |
| Store Manager `/store/incentives` visibility depends on company assigned-store type being present in session/scope data | P1 if live setup omits scope | Route registry intentionally hides incentives for non-company store types | PR5 runbook/live smoke, PR4 only if setup mismatch is reproduced | Company-store-only rule is correct, but live persona setup must carry the expected scope. |
| Store/Admin routes can render raw API error messages through `getErrorMessage()` | P2 | `ApiError` messages may include API paths, UUIDs, or internal response body text | PR4 copy/error hygiene | User-facing errors should use route-specific fallback copy. |
| `/store/workforce` can fall back to raw `store_id` when display name/code is missing | P2 | Store workforce region view bypasses the existing display label normalizer in this fallback path | PR4 with workforce fix | Prevents UUID leakage when external data is incomplete. |
| `/admin/targets` and `/store/targets` all-pages target request fetch can become slow with real history | P2 | Target API helper pages all requests with limit 200, then UI filters | PR4 target performance slice | External target history will grow quickly during pilot. |
| Live staging persona evidence is still separate from local mocked smoke | P2 | PR1 ran local mocked Playwright only | PR3/runbook | Pilot readiness should distinguish local contract evidence from live Clerk/staging evidence. |
| `/store/incentives` perceived slow initial load still lacks current timing evidence | P2 | User report plus page audit; no polling found | PR4 if measurable | Fix should start from measurement to avoid speculative rewrite. |
| `/admin/master-data` perceived in-page jank still lacks current timing evidence | P2 | User report plus page audit | PR4 if measurable | Needs route-specific render/query measurement. |
| Region manager KPI 29-store vs 30-assigned-store discrepancy remains a live-data audit item | P1 if reproduced | User report; not reproduced in PR1 local mocked smoke | PR4 if current live evidence confirms | Scope/count mismatch affects business trust. |
| Pilot route docs are stale for active Store/Admin routes and VM feed behavior is ambiguous | P2/P3 | Active routes exist outside the old matrix; registry allows VM feed while the matrix language implies otherwise | PR3 docs/smoke update | The matrix should match actual route registry before pilot handoff. |

No P0 blockers were found in PR1 local evidence.

## Fix Split

| Finding | PR | Risk | Why split this way |
|---|---|---|---|
| Pilot smoke coverage gap | PR3 | `R1/R2` if e2e added | Adds verification only; should not mix with UI/performance fixes. |
| Route matrix stale/incomplete | PR3 | `R0/R1` | Align docs with smoke additions and actual route registry. |
| External source canonical contract missing | PR2 | `R0` | Docs/contract; no runtime behavior. |
| Data quality/quarantine policy missing | PR2 | `R0` | Same docs/contract boundary as canonical source contract. |
| Incentives initial load performance | PR4-A if measured | `R1/R2` | Route-specific frontend/data-binding risk; should stay isolated. |
| Workforce region fan-out and store-id fallback | PR4-B if measured | `R1/R2` | Same route, same user surface; can combine if minimal. |
| Target all-pages fetch | PR4-C if measured | `R1/R2` | Store/Admin targets share the same data-loading concern. |
| Master data jank | PR4-D if measured | `R1/R2` | Admin route-specific performance risk; separate from Store pages. |
| KPI assigned-store count mismatch | PR4-E if reproduced | likely `R2/R3` | Could touch frontend binding or backend read model; must not be mixed with UI polish. |
| Shared user-facing error sanitization | PR4-F | `R1` | Broad copy behavior, but can stay small through shared helper usage. |
| Pilot daily ops runbook | PR5 | `R0` | Operational docs closeout after contracts/smoke decisions. |

## PR3 Smoke Decision

PR3 is useful. The audit shows a real smoke-pack gap: several pilot-important surfaces have targeted specs but are not part of the single pilot readiness smoke route loop. Recommended PR3:

- Add or extend pilot readiness smoke coverage for `/store/targets`, `/store/workforce`, `/store/reports`.
- Consider admin additions for `/admin/operations`, `/admin/reports`, `/admin/incentives`, `/admin/kpi-config` if route mocks already exist and runtime stays fast.
- Add direct forbidden assertions for `/admin/incentives` and `/admin/kpi-config` with a non-super role if fixtures stay lightweight.
- Add one VM `/store/feed` direct-navigation assertion after product confirms whether VM feed is intended to be allowed.
- Keep the smoke deterministic and mocked; live staging smoke belongs in runbook/evidence, not CI secrets.

## Next Steps

1. PR2: create canonical external data contract and data-quality/quarantine rules.
2. PR3: add narrow pilot smoke pack coverage for the route gaps above.
3. PR4: only implement measured and reproduced P1/P2 fixes.
4. PR5: create daily pilot ops runbook with live evidence and stop rules.
