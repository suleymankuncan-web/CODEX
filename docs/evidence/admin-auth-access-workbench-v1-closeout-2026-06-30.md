# Admin Auth Access Workbench V1 Closeout

Status: complete
Date: 2026-06-30
Surface: `/admin/auth`
Prototype: `docs/prototypes/admin-auth-access-workbench-v1.tsx`

## Scope

The approved Admin Auth Access Workbench prototype is promoted into the real
`/admin/auth` route. The production route uses backend Auth Admin data and keeps
the workbench model: user inventory, selected user detail, account edit,
role/store assignment trays, deactivate/reactivate, and audit review.

## PR Chain

- PR #831: backend user account contract gaps.
- PR #832: frontend auth API/model/mutation layer.
- PR #833: production `/admin/auth` workbench UI and E2E contract update.
- Current PR: closeout evidence, prototype registry, lifecycle E2E coverage.

## Prototype And Route Boundary

- Locked prototype SHA-256:
  `DFDBC11C2CD9D7B451CF8B5AEEEB16455D3E370E1C60B8B310E42F2F7BF34069`.
- Production route owner: `admin-web/src/pages/AuthDashboardPage.tsx`.
- Production components:
  - `admin-web/src/features/auth/AuthAccessWorkbenchView.tsx`
  - `admin-web/src/features/auth/AuthAccessWorkbenchTrays.tsx`
  - `admin-web/src/features/auth/auth-access-workbench-model.ts`
- Production styles:
  - `admin-web/src/styles/admin-auth-access-workbench.css`
  - `admin-web/src/styles/admin-auth-access-workbench-detail.css`
- Dev-only `?prototype=access-workbench-v1` route is not present in
  `admin-web/src/App.tsx`.

## Screenshot Evidence

- Desktop:
  `docs/evidence/screenshots/admin-auth-access-workbench-v1-desktop-2026-06-30.png`
- Mobile:
  `docs/evidence/screenshots/admin-auth-access-workbench-v1-mobile-2026-06-30.png`

Screenshots were captured from the production `/admin/auth` route in the app
shell with route-level Auth Admin API fixtures. They verify layout, density,
toolbar, metrics, user inventory, selected user detail, action panel, and mobile
stacking behavior. They are visual evidence, not a live staging data proof.

## Functional Evidence

- User list supports `limit: 100` and `q` through
  `getUserAccounts({ limit: 100, q })`.
- User create is covered by `auth-admin-surfaces.spec.ts`.
- User profile update is covered by `auth-admin-surfaces.spec.ts`.
- User deactivate with reason body is covered by
  `auth-admin-surfaces.spec.ts`.
- User reactivate is covered by `auth-admin-surfaces.spec.ts`.
- Role assignment create is covered by `auth-admin-surfaces.spec.ts`.
- Store/action assignment create is covered by
  `auth-admin-surfaces.spec.ts`.
- Mobile no-horizontal-overflow check remains in `auth-admin-surfaces.spec.ts`.
- Core admin pilot smoke now validates `/admin/auth` through the workbench
  heading instead of the removed old catalog link.

## Verification

Local targeted verification:

```powershell
npm.cmd --prefix admin-web run test:e2e -- e2e/auth-admin-surfaces.spec.ts
npm.cmd --prefix admin-web run test:e2e -- e2e/pilot-smoke.spec.ts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
git diff --check
```

PR #833 CI verification:

- `release-rehearsal`: success
- `frontend-release-check`: success
- `release-check`: success
- `Vercel`: success
- `Vercel Preview Comments`: success

## Known Boundaries

- Clerk session revocation is not claimed. The visible copy stays at
  application access closure.
- `Davet bekliyor` is not shown because there is no verified backend pending
  invite state in this V1.
- Screenshots use route-level fixtures. Live staging persona smoke remains a
  separate operator runbook activity when credentials and OTP flow are available.
