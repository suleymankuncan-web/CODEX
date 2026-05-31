# Admin UI Modernization V1 PR-10 Targets Visual QA - 2026-05-31

## Scope

- Route: `/admin/targets`
- Surface: target distribution approval queue, target coverage summary, recent approved target requests
- Role fixture: `SUPER_ADMIN` with one assigned action store
- API fixture: deterministic Playwright route mocks for auth session, target distribution requests, and target coverage

## Contract Boundary

- API response shape: unchanged
- Approval payload: unchanged and covered by `admin-targets-surfaces.spec.ts`
- Auth and action-scope semantics: unchanged; approval remains limited by assigned action stores
- Target state-machine semantics: unchanged
- Store target workflows: unchanged and covered by `store-targets-surfaces.spec.ts`

## Visual Checks

- Desktop screenshot: `admin-ui-modernization-v1-pr10-targets-visual-qa-2026-05-31/admin-targets-desktop.png`
- Mobile screenshot: `admin-ui-modernization-v1-pr10-targets-visual-qa-2026-05-31/admin-targets-mobile-390.png`
- Legacy class check: `.hero-panel`, `.metric-card`, `.dashboard-card`, `.status-pill` count = 0
- Horizontal overflow check:
  - Desktop: false
  - Mobile 390px: false

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- admin-targets-surfaces.spec.ts store-targets-surfaces.spec.ts`
- `npm.cmd --prefix admin-web run test:e2e -- admin-targets.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --check`
