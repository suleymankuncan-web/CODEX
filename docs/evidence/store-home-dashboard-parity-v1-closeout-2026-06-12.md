# Store Home Dashboard Parity V1 Closeout

Date: 2026-06-12

Scope: Store/Admin shell toolbar parity plus `/store` and `/store/home` Store
Home dashboard parity for Store Manager and Region Manager personas.

## PR Train

| Slice | PR | Merge commit | Outcome |
| --- | --- | --- | --- |
| PR-0 prototype lock | #696 | `162082bef1fe8ba807816b4d022acd35aadc2fc6` | Locked the Store Home dashboard prototypes and added the prototype hash guard. |
| PR-1 toolbar parity | #697 | `dab4ea2f2658ba36f7a0858797a232405f756e78` | Moved Store and Admin sidebar nav bodies toward the approved prototype rhythm while keeping the existing Lufian header/brand area unchanged. |
| PR-2 dashboard parity | #698 | `068e78e3af68797d7c2c668a97b7b934d8519df6` | Reworked Store Home for Store Manager and Region Manager as dashboard summary surfaces, removed old source/debug summary remnants, and kept actions role-aware. |
| PR-3 closeout | this PR | pending | Records final parity evidence, screenshot artifacts, data mapping, unchanged behavior, and handoff state. |

## Prototype Contracts

Hash values below are the LF-normalized SHA-256 values enforced by
`scripts/prototype-parity-guard.test.mjs`.

| Prototype | Surface | Hash |
| --- | --- | --- |
| `docs/prototypes/store-home-store-manager-standard-v1.html` | `/store/home` Store Manager dashboard | `B36442A7244FCF4FE85954E4F08C88E2A3684055DD03D854F3C54DA629022E37` |
| `docs/prototypes/store-home-region-manager-standard-v1.html` | `/store/home` Region Manager dashboard | `DF4E1583D39588FFA2B150937DAC3556983A59F781960C8DC986ED396B4A1E81` |

The prototype contract is layout, density, row rhythm, palette, status tone,
and dashboard content structure. Prototype-only helpers, demo role controls,
and fake data did not move into runtime.

## Route And Persona Matrix

| Route | Persona / role shape | Production result |
| --- | --- | --- |
| `/store` | Store Manager | Renders the Store Home dashboard through `StoreHomePage`; root store route still follows the existing shell redirect rules for checklist-only personas. |
| `/store/home` | Store Manager | Shows `Magaza ozet dashboard`, real authorized-store scope, open work from workflow/checklist sources, checklist status when the role can see checklists, and KPI/approval rows only when navigation permits them. |
| `/store/home` | Region Manager | Shows `Bolge ozet dashboard`, authorized region/store scope, checklist/KPI/targets/reports rows only when the resolved Store navigation includes those paths. |
| `/store/home` | Store Personnel / Visual Merchandiser | Existing daily-command behavior remains; no new KPI, approvals, checklist, target, or report links are exposed outside resolved navigation. |
| `/store/home` | Admin landing roles such as `HR_ADMIN` | Store Home may render as an entry surface, but action rows and links are filtered by the role-aware navigation path set. The regression spec asserts no `/store/kpis`, `/store/reports`, `/store/targets`, `/store/approvals`, `/store/checklists`, or `/store/tasks` links for the covered admin landing fixture. |

## Real Data Mapping

| Visible value or action | Runtime source |
| --- | --- |
| Authorized store count / scope badge | Existing auth session summary and store scope formatting in `StoreHomePage`. |
| Store Manager open work | Existing workflow inbox items with `inboxStatus === 'needs_attention'` plus checklist acknowledgement summary count when available. |
| Checklist status / queue / coverage | Existing checklist acknowledgement query and mobile checklist-today state through `buildChecklistHomeSummary`. |
| Daily command brief items | Existing `buildDailyCommandBriefItems` output filtered through the resolved role-aware Store navigation paths. |
| KPI summary, targets, reports rows | Existing route availability and honest `Bekliyor` / pending state where Store Home has no dedicated aggregate contract. |
| Links and action rows | `getRoleAwareStoreNavigation(authSummary)` path set; UI does not hard-code actions that the current role cannot see. |

No fake KPI, score, ranking, target, coaching, checklist, or workflow data was
introduced.

## States

- Loading: existing React Query loading states continue to produce pending
  labels for unavailable counts.
- Empty: missing workflow/checklist source data stays as an honest pending or
  unavailable value rather than synthetic business data.
- Error: workflow inbox errors make request/open-work values unavailable instead
  of inventing counts.
- Access / role scope: row and link visibility is filtered through resolved
  Store navigation. Backend permissions remain the authority.
- Partial data: KPI, target, and report summaries stay pending on Store Home
  until a real aggregate contract exists.

## Visual Evidence

Production screenshot artifacts are committed under
`docs/evidence/store-home-dashboard-parity-v1-2026-06-12/`.

| Persona | Viewport | Screenshot |
| --- | --- | --- |
| Store Manager | Desktop, 1440 wide | `docs/evidence/store-home-dashboard-parity-v1-2026-06-12/store-manager-desktop.png` |
| Store Manager | Mobile, 390 wide | `docs/evidence/store-home-dashboard-parity-v1-2026-06-12/store-manager-mobile.png` |
| Region Manager | Desktop, 1440 wide | `docs/evidence/store-home-dashboard-parity-v1-2026-06-12/region-manager-desktop.png` |
| Region Manager | Mobile, 390 wide | `docs/evidence/store-home-dashboard-parity-v1-2026-06-12/region-manager-mobile.png` |

Local visual smoke for PR #698 checked the four captures for visible dashboard
content, no page-level overflow, and absence of the old summary/source rows
named by the user.

## Intentional Deviations

- The production shell keeps the real Lufian header/brand area. The HR Axis
  prototype logo language was not moved into Store/Admin production shells.
- The sidebar/nav body moved toward the prototype rhythm, but auth, route guard,
  mobile shell behavior, and role-aware item resolution stayed unchanged.
- KPI, target, and report summary values remain pending on Store Home because
  there is no Store Home aggregate contract for those values.
- Production Store Home keeps real shell-level state and existing StoreSurface
  primitives instead of prototype-only static helpers.

## Unchanged Behavior

Contract Impact: intentionally unchanged.

This PR train did not change:

- API request or response shape,
- DB schema or migrations,
- auth, permission, role, scope, route guard, or session semantics,
- Store route prefetch behavior,
- workflow inbox, checklist acknowledgement, target, KPI, ranking, scoring,
  snapshot, or checklist-weight semantics,
- BullMQ/import/provider behavior,
- Store workforce, approvals, targets, reports, KPI, rankings, or task workflow
  behavior outside the Store Home entry surface.

## Regression Coverage

`admin-web/e2e/store-surfaces.spec.ts` covers:

- Store Manager dashboard rendering and old `Magaza ozeti` / source-row removal.
- Store Manager workflow inbox prefetch and Store Home task navigation.
- Region Manager Store Home checklist and field-queue dashboard behavior.
- Admin landing role action-link filtering against role-aware navigation.
- Store Personnel daily command brief still hiding `/store/kpis`.
- English Store Home dashboard copy and old English hero copy removal.

## Verification

PR #696:

- `node --test scripts/prototype-parity-guard.test.mjs`: pass.

PR #697:

- GitHub/Vercel checks: pass.
- Codex review: no major issues before merge.

PR #698 local gates:

- `git diff --check`: pass.
- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd exec -- playwright test store-surfaces.spec.ts -g "store home dashboard actions follow role-aware navigation|region manager home surfaces checklist field queue summary|store personnel daily command brief"`: pass, 3/3.
- `npm.cmd exec -- playwright test store-surfaces.spec.ts -g "store shell exposes Turkish-first chrome|store home prefetches the task queue|store home keeps the daily brief pending|region manager home surfaces checklist field queue summary|store home dashboard actions follow role-aware navigation|store personnel daily command brief|store home switches to English copy"`: pass, 7/7.
- Desktop/mobile screenshot smoke for Store Manager and Region Manager: pass.

PR #698 remote gates:

- `frontend-release-check`: pass.
- `release-check`: pass.
- `release-rehearsal`: pass.
- `Vercel`: pass.
- `Vercel Preview Comments`: pass.
- Codex review on `e74f3eca43`: did not find major issues.

PR-3 closeout gate:

- `git diff --check`: pass.
- `node --test scripts/prototype-parity-guard.test.mjs`: pass.
- `npm.cmd run test:scripts`: pass, 458/458.

## Remaining Risks

- This line records local screenshot evidence and CI/E2E evidence; it is not a
  live protected staging persona smoke.
- Store Home aggregate KPI/target/report cards can become richer only after a
  dedicated real read contract exists. Until then, pending states are the
  intended honest behavior.
