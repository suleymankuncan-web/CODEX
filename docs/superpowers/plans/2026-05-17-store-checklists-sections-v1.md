# Store Checklists Sections v1

## Goal

Reduce the Store Checklists page risk without changing the field visit or store acknowledgement behavior.

## Why This Matters

`StoreChecklistsPage` owns live store checklist visits, BM/VM scope visibility, acknowledgement handoff, and workflow inbox refreshes. Its previous single-component shape made those flows harder to review safely. This is useful product maintenance, not a cosmetic React Doctor chase.

## Scope

- Split the command hero, visit panel, visit table rows, modals, and acknowledgement panels into focused components.
- Keep query keys, mutation invalidation, route search handling, role checks, copy, and CSS class names intact.
- Group visit panel modal/display/error state to avoid adding boolean-prop debt while extracting sections.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`
- `npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store checklist acknowledgement refreshes the store task queue"`
- `npm.cmd --prefix admin-web run check:release`
- `npm.cmd run check:release`

## Result

React Doctor dropped the Store Checklists giant component finding; the project moved from 7 issues across 6 files to 6 issues across 5 files. The score remains 99/100 because the remaining findings are other giant components.

## Deploy Note

This is a frontend-only refactor. After merge, the normal frontend deployment pipeline is enough; no manual Render backend deploy is required.

## PR Summary

Store checklists now render through focused hero, visit, modal, and acknowledgement sections without changing checklist visit or acknowledgement behavior.
