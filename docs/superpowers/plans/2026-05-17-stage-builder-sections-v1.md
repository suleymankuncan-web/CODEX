# Stage Builder Sections v1

## Goal

Reduce the Competition Stage Builder review risk without changing stage creation, team template, package plan, approval, clone, cancel, or execute behavior.

## Why This Matters

`StageBuilderForm` owns admin competition stage creation, package plans, team template reuse, approval decisions, and execution handoff. Those flows are operationally important because a bad change can create the wrong competition structure or execute the wrong package plan. This is useful maintenance, not a cosmetic React Doctor chase.

## Scope

- Keep the exported `StageBuilderForm` component as a small boundary and move the stateful content into a stable content hook.
- Split team assignment cards and stage package draft controls into focused components.
- Keep API calls, query keys, mutation invalidation, validation helpers, copy, and CSS class names intact.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`
- `npm.cmd --prefix admin-web run test:e2e -- competition-surfaces.spec.ts -g "stage builder|competition stage|stage format|league then final stage package|stage package plan|team template"`
- `npm.cmd --prefix admin-web run check:release`
- `npm.cmd run check:release`

## Result

React Doctor dropped the two Stage Builder giant component findings; the project moved from 5 issues across 4 files to 3 issues across 3 files. The score remains 99/100 because the remaining findings are other admin pages.

## Deploy Note

This is a frontend-only refactor. After merge, the normal frontend deployment pipeline is enough; no manual Render backend deploy is required.

## PR Summary

Competition stage builder now keeps stage, team, and package plan behavior intact while rendering through smaller form and package draft sections.
