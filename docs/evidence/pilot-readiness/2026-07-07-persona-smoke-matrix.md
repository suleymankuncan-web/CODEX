# Pilot Readiness PR3 - Persona Smoke Matrix

Status: in_progress  
Branch: `codex/pilot-persona-smoke-v1`  
Date: 2026-07-07  
Scope: PR3 persona smoke and critical flow evidence  
Secrets policy: no passwords, OTPs, cookies, bearer tokens, database URLs, private credentials, or raw connection strings recorded.

## Scope

This PR references the PR1 findings below:

| Finding ID | Severity | Area | PR3 handling |
| --- | --- | --- | --- |
| PRA-20260707-01 | P1 | Rankings profile access for SM/Personnel | Local e2e confirms backend-gated profile navigation and forbidden direct-route behavior. |
| PRA-20260707-03 | P1 | Incentives close/edit state | Local e2e confirms review feedback and correction drawer editability; DB readback confirms May/June final snapshots exist. |
| PRA-20260707-10 | P1 | Login/session bounce | Staging cookie-session smoke passed for Admin, BM, SM and Personnel; local SPA navigation recovery tests passed. |
| PRA-20260707-13 | P2 | Checklist fill modal/read-only risk | Existing contract confirms BM/VM filters keep store population visible; fill-modal usability remains PR5 surface polish unless live smoke proves a P1 blocker. |

## Code Change In This PR

The cookie-session smoke script used to require `assignedStoreCount > 0` for every expected role. That was wrong for global admin personas. The smoke now keeps the assigned-store requirement only for store-scoped roles:

- `REGION_MANAGER`
- `STORE_MANAGER`
- `STORE_PERSONNEL`
- `VISUAL_MERCHANDISER`

This changes only test/smoke behavior. It does not change product auth, role or scope semantics.

## Staging Cookie-Session Smoke

| Persona | Command | Result | Landing | Role proof | Scope proof | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Admin | `npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session` with admin pilot env mapped into `AUTH_SMOKE_*` | pass | `/admin/operations` | `SUPER_ADMIN` | company scope 1, assigned store 0 | Assigned store scope is not required for global admin. |
| Bolge Muduru | `npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session` with BM pilot env mapped into `AUTH_SMOKE_*` | pass | `/admin/competitions` | `REGION_MANAGER` | company scope 1, assigned store 30 | Store route behavior is also covered by local route e2e. |
| Magaza Muduru | `npm.cmd --prefix admin-web run smoke:auth:staging:store-manager` | pass | `/store/home` | `STORE_MANAGER` | company scope 1, assigned store 1 | Cookie auth, CSRF rejection and logout cleanup passed. |
| Personel | `npm.cmd --prefix admin-web run smoke:auth:staging:store-personnel` | pass | `/store/me` | `STORE_PERSONNEL` | company scope 1, assigned store 1 | Cookie auth, CSRF rejection and logout cleanup passed. |

Common staging smoke assertions:

- Browser session creation returned `201`.
- Session endpoint returned authenticated role proof.
- Session cookie was HttpOnly, Secure and SameSite=Lax.
- No app bearer/provider token was stored in browser storage.
- Unsafe cookie-authenticated POST without CSRF token returned `403`.
- Logout cleared the app cookie.

## Local Persona And Critical Flow Tests

| Command | Result | Coverage |
| --- | --- | --- |
| `npm.cmd --prefix admin-web run test:e2e -- store-manager-persona.spec.ts store-personnel-persona.spec.ts store-incentives-contracts.spec.ts` | pass, 9 tests | SM route boundaries, SM checklist acknowledgement, SM incentives hidden, personnel route boundaries, incentives compact surface, review immediate feedback, correction drawer money input/footer usability. |
| `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store sidebar\|route navigation"` | pass, 5 tests | Lazy route recovery, transient feed failure retry, sidebar prefetch, manager page transitions without manual refresh, no blank shell transition. |
| `npm.cmd --prefix admin-web run test:e2e -- store-checklists-contracts.spec.ts` | pass, 1 test | BM and VM checklist filters keep assigned store population visible. |

## Incentives Period Readback

Read-only DB readback was performed with no credential values printed or recorded.

| Period | Close run status counts | Final snapshots | Final rows | Stores | Store reviews |
| --- | --- | ---: | ---: | ---: | --- |
| 2026-05 | failed: 1, succeeded: 3 | 32 | 128 | 29 | reviewed: 4 |
| 2026-06 | succeeded: 1 | 14 | 58 | 14 | none |

Interpretation:

- May and June both have succeeded incentive close runs and final snapshots.
- A UI state that still says month-close is waiting is not explained by missing close-run data alone.
- June has no store review rows yet, so "control pending" can be a legitimate review state; it should not block opening/editing a final snapshot correction drawer.
- Store review and drawer behavior are covered locally; live UI verification remains a PR5 store-surface check if the user still reproduces a specific store/period lock.

## Finding Outcomes

| Finding ID | PR3 outcome | Remaining action |
| --- | --- | --- |
| PRA-20260707-01 | No product scope leak reproduced. Local e2e confirms non-privileged ranking rows are summary-only and direct forbidden profiles hide backend details. | Keep in final pilot smoke; no PR3 product code fix. |
| PRA-20260707-03 | Frontend contract passes. DB readback confirms May/June close data exists. | If live drawer remains disabled for a named store/period, handle as PR5 single-surface fix with API payload evidence. |
| PRA-20260707-10 | Staging cookie-session smoke passed for all four personas. Local SPA navigation tests passed. | If browser-specific login bounce recurs, capture browser/storage state separately; no current code fix proven. |
| PRA-20260707-13 | Existing checklist filter contract passes. Fill-modal usability is not fully covered by current e2e. | PR5 should add a targeted fill-modal usability test before any visual/polish fix. |

## Risks Not Closed By PR3

| Risk | Reason | Next PR |
| --- | --- | --- |
| Reports Excel data correctness | Not persona smoke; export content needs workbook readback. | PR4 |
| Store Me / Rankings / KPIs / Incentives visual polish | Not a PR3 route-auth or critical-flow fix unless blocking. | PR5 |
| Checklist fill modal usability | Current e2e covers filters but not scoring modal fillability. | PR5 |
| Browser-specific login bounce | Current staging smoke and local SPA tests pass; no reproducible failure. | PR6 runbook notes if user reproduces again |

