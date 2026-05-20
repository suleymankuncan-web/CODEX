# Store Home Manager Copy Slice

## Purpose

Record the first implementation slice selected by
`docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`.
This is a small product-readiness change for `/store/home`, not a backend,
auth, API, DB, CSS, or workflow behavior change.

## Sokrates Decision

Claim:

- Empty manager home copy made the store-manager landing page feel unfinished.

Assumptions:

- Filling existing localization keys is safer than changing layout or route
  behavior.
- Existing store-home Playwright coverage is enough to verify the copy is
  visible in both Turkish-first and English locale paths.

Evidence:

- `admin-web/src/features/localization/messages/store-home.ts` had empty
  `storeHome.command.managerCopy`, `managerHeroTitle`, and `managerHeroCopy`
  entries in both Turkish and English dictionaries.
- `admin-web/src/pages/StoreHomePage.tsx` already renders these keys when they
  are non-empty.
- `admin-web/e2e/store-surfaces.spec.ts` already covers `/store/home` and the
  English locale persistence path.

Counterargument:

- Copy is subjective and can be refined later. That is true, so this slice kept
  the wording concise and avoided layout/CSS changes.

Risk:

- LOW. This uses existing localization keys and existing render paths.

Door:

- Two-way door. The strings and assertions can be changed or reverted without
  data or contract impact.

Decision:

- Fill only the manager home copy keys.
- Add targeted Playwright assertions for the Turkish manager hero title and the
  English manager hero title.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npx.cmd playwright test store-surfaces.spec.ts -g "store home" --workers=1`
- `git diff --check -- admin-web/src/features/localization/messages/store-home.ts admin-web/e2e/store-surfaces.spec.ts`

## Result

- The store-manager home screen now has visible manager intro and hero copy in
  Turkish and English.
- No business logic, API response shape, auth, permission, DB migration, CSS, or
  data-fetch behavior changed.
