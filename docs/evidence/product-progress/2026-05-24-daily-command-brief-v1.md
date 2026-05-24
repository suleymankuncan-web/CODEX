# Daily Command Brief V1 Evidence

Date: 2026-05-24

## Scope

Store home now exposes a read-only Daily Command Brief panel. The brief only
links to existing source pages and does not create a new score, automated
advice, write action, API response shape, auth rule, DB change, or global CSS
behavior.

## Source Rules

- Store Action / task focus uses the existing workflow inbox signal and the
  existing read-only Store Action candidate helper.
- Checklist focus uses the existing checklist home summary that was already
  visible on store home.
- Personnel brief stays personal: performance, ranking, and feed links only.
- Source links go to existing routes such as `/store/tasks`, `/store/checklists`,
  `/store/approvals`, `/store/me`, `/store/rankings`, `/store/kpis`, and
  `/store/feed`.

## Verification

- `git diff --check`
- `node --test scripts/file-size-guard.test.mjs`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store home prefetches|region manager home surfaces|store personnel daily command brief"`
- `npm.cmd run system-flow:generate`
- `npm.cmd run test:scripts`

## Risk Notes

- The brief intentionally does not query persisted action-plan records on store
  home. That keeps the first slice aligned with the existing workflow prefetch
  and avoids adding another home-page API dependency.
- Store personnel do not receive task or checklist links from the brief.
- The generated system-flow map was refreshed because `/store` and
  `/store/home` now have an explicit Store Home workflow-inbox dependency.
