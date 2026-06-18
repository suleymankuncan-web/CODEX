# Sales Target Incentive V1 PR-6 Store UI Visual QA - 2026-06-18

## Scope

- Route: `/store/me`
- Route: `/store/incentives`
- Route: `/store/home` hidden-persona navigation proof
- Personas: `STORE_PERSONNEL`, `STORE_MANAGER`, `REGION_MANAGER`, hidden non-company/cashier-style fixtures
- API fixture: deterministic Playwright route mocks for auth session, my performance, own incentive projection, and store incentive projections

## Contract Boundary

- Backend incentive calculation: unchanged; frontend consumes the PR-5 read API.
- API response shape: unchanged.
- Auth and scope semantics: unchanged; Store UI only renders eligible projection data returned by `/api/store/me/incentives` and `/api/store/incentives`.
- Cashier, franchise, and operator visibility: no Store incentive card and no `Primler` navigation when the API has no eligible company-store projection.
- Correction, close, and admin workflows: not implemented in PR-6.

## Visual Checks

| Viewport | Screenshot | Horizontal overflow |
| --- | --- | --- |
| Eligible store manager desktop 1440x1100 | `docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/store-incentives-manager-desktop.png` | false |
| Eligible store manager mobile 390x1200 | `docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/store-incentives-manager-mobile-390.png` | false |
| Hidden manager desktop 1440x1100 | `docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/store-incentives-hidden-desktop.png` | false |
| Hidden manager mobile 390x1200 | `docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/store-incentives-hidden-mobile-390.png` | false |

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts pilot-smoke.spec.ts store-incentives-projection.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --check`
