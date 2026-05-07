# UI Localization Strategy

## Purpose

Define and preserve the Turkish/English localization direction now that the pilot-facing implementation wave is active.

The goal is to support:

- default Turkish UI
- optional English UI
- full Turkish character support
- consistent formatting for dates, numbers, money, exports, validation, and status labels

This document is the active localization boundary note. The closeout evidence is tracked in `docs/plans/ui-localization-closeout-v1.md`.

## Product Decision

The application supports two UI languages in the pilot-facing web UI:

- `tr`: Turkish, default
- `en`: English

Turkish must be a first-class language, not a partial translation layer. Characters such as `Ç`, `Ş`, `İ`, `ı`, `ğ`, `ü`, and `ö` are expected and must be preserved end to end.

## Current State

Pilot localization implementation status: `closeout_guarded`

The frontend has an active typed locale foundation:

- `admin-web/src/lib/i18n.ts`
- `appLocales = ['tr', 'en']`
- `defaultAppLocale = 'tr'`
- `getIntlLocale()` returns `tr-TR` or `en-US`
- `admin-web/src/features/localization/LocalizationProvider.tsx`
- `admin-web/src/features/localization/dictionary.ts`
- namespace message files under `admin-web/src/features/localization/messages/`

The pilot-facing admin/store shell, route guards, auth flow, reports, import, master-data, targets, competition, store, and common operational surfaces now use the local dictionary pattern. English remains available through the `TR / EN` toggle and the selected locale persists in browser storage.

The closeout boundary is intentionally smaller than a full product design-system localization program. Backend contract values, raw technical codes, source data, and future export workflows remain governed by the stable-value rules below.

## Localization Boundaries

### Must Be Localized

User-facing text should stay in translation keys:

- page titles
- navigation labels
- buttons
- table headers
- empty states
- loading states
- validation messages
- toast and error messages
- dashboard card labels
- filter labels
- tooltips
- modal text
- form helper text
- CSV/Excel export headers

### Must Stay Stable

Technical and contract values must not be translated:

- route paths
- API paths
- role codes
- permission codes
- enum values returned by backend
- database values
- audit event codes
- integration source codes
- KPI metric codes
- test fixture identifiers

Example:

- backend value: `needs_action`
- Turkish label: `Aksiyon Gerekli`
- English label: `Needs Action`

## Turkish Character Rules

All source files and generated text artifacts must stay UTF-8 compatible.

Avoid ASCII-only Turkish labels such as:

- `Magaza`
- `Bolge`
- `Calisan`

Prefer correct Turkish labels:

- `Mağaza`
- `Bölge`
- `Çalışan`

## Casing Rules

Turkish casing is locale-sensitive.

Do not use plain casing helpers for user-facing Turkish text when the result is displayed to users:

- avoid `toUpperCase()`
- avoid `toLowerCase()`

Use locale-aware casing when needed:

- `toLocaleUpperCase('tr-TR')`
- `toLocaleLowerCase('tr-TR')`

Important examples:

- `i` uppercases to `İ` in Turkish
- `I` lowercases to `ı` in Turkish

## Formatting Rules

Dates, times, numbers, percentages, and money should use locale-aware formatters.

Preferred approach:

- `Intl.DateTimeFormat`
- `Intl.NumberFormat`
- locale from `getIntlLocale(activeLocale)`

Examples:

- Turkish date/number style: `tr-TR`
- English date/number style: `en-US`

Do not hard-code date or number formatting inside page components.

## Search And Filter Rules

Search behavior must be Turkish-aware when searching user-facing labels or names.

Future search helpers should consider:

- locale-aware normalization
- Turkish casing
- diacritic behavior
- consistent behavior across table filters and global search

The system should avoid silently treating Turkish names incorrectly because of ASCII-only assumptions.

## Export Rules

CSV and Excel exports must preserve Turkish characters.

When CSV export is implemented or expanded:

- use UTF-8 output
- consider UTF-8 BOM for Excel compatibility
- translate export headers according to selected language
- keep raw technical identifiers stable when the export is meant for integration or audit use

## Error Handling

Backend error codes should stay stable.

Frontend should map stable backend errors into localized labels/messages.

Recommended shape:

- backend: `code`, `message`, `details`
- frontend: localized display message by `code`
- fallback: safe generic localized error

Do not translate backend contract codes.

## Language Preference

Default behavior:

- first visit: Turkish
- user switch: `TR / EN`
- stored preference: browser storage first
- later option: persist preference on user profile

The selected language should not change auth, role, scope, route, or data access behavior.

## Suggested Implementation Direction

The project currently uses Option A.

### Option A: Lightweight Local Dictionary

Use a local typed dictionary and a small `t()` helper.

Best when:

- the app is still moderate in size
- we want minimal dependencies
- translation needs are straightforward

Trade-off:

- pluralization and nested formatting may become custom work

### Option B: `react-i18next`

Use `react-i18next` with typed key discipline.

Best when:

- UI text surface grows significantly
- pluralization, interpolation, and namespaces matter
- language switching should be standardized

Trade-off:

- adds dependency and setup complexity

Recommended future path:

- keep the typed local dictionary while the app remains moderate in size
- move to `react-i18next` if translation surface becomes broad enough to justify it

## Implementation Gate

Before expanding localization beyond the pilot-facing web UI, run the feature intake interview from:

- [request-intake-and-decision-policy.md](./request-intake-and-decision-policy.md)

Minimum questions to answer:

- Should language preference be per-browser or per-user?
- Which screens are included in the first localization pass?
- Should backend-provided labels remain backend-owned or be mapped in frontend?
- Do exports follow active UI language or fixed Turkish business language?
- Do we need a translator workflow, or will translations be maintained by developers first?

## Verification

Pilot localization closeout should not be considered complete until:

- Turkish is default on first load
- English switch works without reload bugs
- Turkish characters render correctly in all major surfaces
- route guards and auth behavior are unchanged
- date/number formatting changes by locale
- CSV/Excel exports preserve Turkish characters when export headers become localized workflow scope
- release check passes

## Current Decision

Pilot-facing localization is implemented and guarded for the current controlled pilot.

The current implementation path is the lightweight typed dictionary. Keep it until pluralization, translator workflow, or broader product language requirements justify a heavier i18n library.

When adding or changing UI:

- keep new user-facing strings easy to move into translation keys
- avoid embedding technical enum text directly into UI
- avoid ASCII-only Turkish labels
- preserve UTF-8 text in docs and frontend files
- keep route, role, permission, audit, source, KPI, and database codes stable
- keep full product bilingual depth and broad visual redesign as future UI/design-system investment, not a blocker for the current pilot
