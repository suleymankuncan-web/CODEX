# UI Localization Closeout V1

Date: 2026-05-07

Status: `closeout_guarded`

## Decision

The pilot-facing Turkish/English localization wave is complete enough for the controlled staging/internal pilot. Turkish is the default UI language, English remains available through the existing toggle, and the pilot-facing admin/store surfaces are maintained through the typed local dictionary.

This does not mean every future product surface, export workflow, backend error code, or visual design refinement is finished. Full product bilingual depth remains a future UI/design-system investment.

## Closed For Current Pilot

- Turkish-first chrome and navigation on the checked admin and store surfaces.
- English toggle and persisted locale behavior on the checked localized surfaces.
- App shell loading, verifying, rejected, forbidden, admin navigation, and store workspace fallback copy.
- Mojibake guard for localization source files and this strategy boundary.
- Dictionary ownership for shell fallback copy, so route guard copy does not drift back into `App.tsx`.

## Still Future, Not A Pilot Blocker

- Backend stable error-code mapping into localized frontend display messages.
- CSV/Excel export header localization when export workflow scope is reopened.
- Translator or non-developer copy workflow.
- Full visual design-system pass and page-by-page UI polish.
- Future source adapter or JSON localization implications while JSON source integration remains suspended.

## Guard

`admin-web/scripts/localization-contract.test.mjs` guards this closeout by checking:

- localization namespace files exist,
- localization source files do not contain mojibake markers,
- interpolation support remains present,
- the strategy records `closeout_guarded`,
- the active handoff records the pilot closeout boundary,
- App shell fallback copy stays dictionary-owned.

## Verification

Run before merging a localization closeout or follow-up slice:

```powershell
npm.cmd --prefix admin-web run test:scripts -- localization-contract.test.mjs
npm.cmd run check:release
```
