# Risk Based Visit Plan V1 Closeout

Date: 2026-06-16

Plan: `docs/superpowers/plans/2026-06-16-risk-based-visit-plan-v1.md`

Status: runtime PR train closed through PR #717 and PR #718; this document is
the PR-3 closeout evidence artifact.

## Scope

V1 adds a read-only, checklist-bound visit-priority layer for field managers.
It answers which assigned stores should be visited first and why, using only
existing checklist visit data already loaded by Store checklist and Store Home
surfaces.

Implemented surfaces:

- `/store/checklists`: `Ziyaret Plani` tab for visit-managing personas.
- `/store/home`: compact Region Manager `Bu hafta ziyaret onceligi` summary.

The feature remains inside the Checklist product flow. It does not introduce a
separate field-visit module, route planner, calendar, notification workflow, or
Store Action automation.

## PR Train

| Slice | PR | Merge commit | Outcome |
| --- | --- | --- | --- |
| PR-1 checklist plan V1A | #717 | `b07336c2c1a1f397c1ed97e161ba9f859ae3081e` | Added shared checklist coverage rows, deterministic visit-plan model, checklist plan tab, role/no-mutation/mobile/empty/performance coverage, and the locked plan document. |
| PR-2 Region Manager home V1B | #718 | `83a669f4aa0a87fa505638a73022d8196154dc9e` | Reused the visit-plan model on Store Home for Region Manager, added high-risk count/top-store summary, localized reasons, read-only role gating, and unavailable-data handling. |

## Runtime Files

PR #717 added or changed:

- `admin-web/src/pages/store-checklists-coverage-model.ts`
- `admin-web/src/pages/store-visit-plan-model.ts`
- `admin-web/src/pages/store-checklists-visit-plan.tsx`
- `admin-web/src/pages/StoreChecklistsPage.tsx`
- `admin-web/src/pages/store-checklists-model.ts`
- `admin-web/src/pages/store-checklists-controls.tsx`
- `admin-web/src/features/localization/messages/store-checklists.ts`
- `admin-web/src/styles/store-checklists-flow.css`
- `admin-web/src/styles/store-checklists-flow-responsive.css`
- `admin-web/src/styles/store-checklists-session-responsive.css`
- `admin-web/e2e/checklist-today-surfaces.spec.ts`
- `scripts/backend-architecture-boundary-guard.test.mjs`

PR #718 added or changed:

- `admin-web/src/pages/store-home-visit-priority.ts`
- `admin-web/src/pages/StoreHomePage.tsx`
- `admin-web/src/features/localization/messages/store-home.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

## Behavior Summary

- Region Manager and Visual Merchandiser planning uses assigned-store checklist
  data only.
- Store Manager does not receive an actionable planning tab or home planning
  card in V1.
- Read-only/reporting admin landing personas do not see the Region Manager home
  planning card unless the session can actually manage checklist visits.
- Plan rows sort deterministically by risk level, risk score, last visit age,
  and store name.
- Plan row action switches to the existing checklist visit workflow; it does
  not start a checklist instance.
- Store Home summary shows pending/unavailable state when checklist source data
  fails instead of rendering a misleading calm zero.

## Data Sources

The implementation uses existing frontend data only:

- `MobileChecklistToday.stores`
- `MobileChecklistToday.templates`
- `MobileChecklistToday.activeInstances`
- `MobileChecklistToday.completedThisMonth`
- `MobileChecklistToday.pendingAcknowledgements`
- `MobileChecklistToday.monthlySummaries`
- checklist acknowledgement items already fetched by the page or home surface

No KPI, ranking, norm kadro, request center, route distance, calendar, or SLA
signal was added to V1.

## Codex Review Remediation

PR #717 Codex P2 items were addressed before merge:

- selected-month missing-store filtering,
- pending-status plan filtering after acknowledgement reason derivation,
- visit-plan action localization,
- historical-month acknowledgement score fallback,
- historical template-version coverage inside Visit Plan only while current
  visit coverage remains strict by template id.

Final Codex signal for PR #717:

- `Didn't find any major issues`
- reviewed commit: `5d212f8716`

PR #718 Codex P2 items were addressed before merge:

- restrict Store Home card to actual checklist-visit planners,
- render visit-priority reasons through localization,
- keep Store Home visit-priority card pending/unavailable when checklist source
  data fails.

Final Codex signal for PR #718:

- `Didn't find any major issues`
- reviewed commit: `b11ee40846`
- all three inline review threads were marked resolved after fixes.

## Remote Check Evidence

PR #717:

- `frontend-release-check`: pass
- `release-check`: pass
- `release-rehearsal`: pass
- `Vercel`: pass
- `Vercel Preview Comments`: pass
- merged at `2026-06-16T14:41:15Z`

PR #718:

- `frontend-release-check`: pass
- `release-check`: pass
- `release-rehearsal`: pass
- `Vercel`: pass
- `Vercel Preview Comments`: pass
- merged at `2026-06-16T17:25:40Z`

## Local Verification On Closeout Branch

Commands run after PR #718 was merged into `main` and before writing this
closeout PR:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager"
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Results:

- frontend lint: pass
- frontend build: pass; existing Vite chunk-size warning only
- `checklist-today-surfaces.spec.ts`: 26/26 passed
- `store-surfaces.spec.ts -g "region manager"`: 8/8 passed
- protected staging cookie-session smoke: passed for configured
  `REGION_MANAGER` persona

The full checklist Playwright run printed Vite proxy `ECONNREFUSED` logs for
Store Action plan endpoints while no backend was running. The spec still passed
26/26; this is recorded as test-run noise, not a failing assertion.

## Protected Staging Smoke

Command:

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Sanitized result:

- `evidenceStatus`: `protected_staging_cookie_session_passed`
- frontend: `https://staging.hr-axis.com`
- backend API: `https://api-staging.hr-axis.com/api`
- expected landing: `/admin/competitions`
- expected role: `REGION_MANAGER`
- browser session create status: `201`
- no-bearer session status: `401`
- authenticated session status: `200`
- role codes: `REGION_MANAGER`
- assigned store count: `3`
- browser session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`
- app bearer token stored in browser storage: `false`
- provider id token stored in browser storage: `false`
- suspicious token-shaped storage key count: `0`
- CSRF unsafe request without header: `403`
- app cookie present after logout: `false`

Limitations:

- Password, one-time code, bearer token, provider token, cookie value, provider
  subject, and raw storage values are intentionally excluded.
- This smoke proves only the configured Region Manager staging persona.
- It does not approve broad production readiness or all possible personas.

## Contract Impact

Contract Impact: intentionally unchanged.

This PR train did not change:

- API request or response shape,
- DB schema or migrations,
- auth, permission, role, scope, route guard, or session semantics,
- checklist scoring, checklist weights, or acknowledgement behavior,
- KPI, ranking, snapshot, norm kadro, or request-center calculations,
- workflow inbox or Store Action/task generation behavior,
- queue/import/provider behavior,
- notifications,
- calendar or scheduling commands.

## Remaining Boundaries

- V1 is not a visit scheduler. Calendar, route planning, postpone/cancel, and
  notification flows remain out of scope.
- V1 is not an automatic task generator. Low score and follow-up signals remain
  visible checklist context; Store Action generation would require a separate
  approved write/workflow slice.
- V1 uses checklist data only. KPI, norm kadro, request-center, route-distance,
  and SLA signals remain future integrations if product explicitly approves
  them and a real source contract exists.
- Local 200-store Playwright coverage proves the frontend read model stays
  lightweight in the test fixture; it is not a protected staging load test.

## Final State

After PR #718, local `main` is aligned with `origin/main` at
`83a669f4 Add region manager visit priority summary (#718)`.
