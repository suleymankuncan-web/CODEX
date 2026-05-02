# UI Localization Strategy

## Purpose

Define the future Turkish/English localization direction before the UI grows too much.

The goal is to support:

- default Turkish UI
- optional English UI
- full Turkish character support
- consistent formatting for dates, numbers, money, exports, validation, and status labels

This document is a decision note, not an immediate implementation plan.

## Product Decision

The application should eventually support two UI languages:

- `tr`: Turkish, default
- `en`: English

Turkish must be a first-class language, not a partial translation layer. Characters such as `Ç`, `Ş`, `İ`, `ı`, `ğ`, `ü`, and `ö` are expected and must be preserved end to end.

## Current State

The frontend already has a small locale foundation:

- `admin-web/src/lib/i18n.ts`
- `appLocales = ['tr', 'en']`
- `defaultAppLocale = 'tr'`
- `getIntlLocale()` returns `tr-TR` or `en-US`

This is a good start, but it is not yet a complete translation system.

## Localization Boundaries

### Must Be Localized

User-facing text must move to translation keys when the localization phase starts:

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

When the project is ready for implementation, choose one of these paths:

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

- start with a typed local dictionary if scope is small
- move to `react-i18next` if translation surface becomes broad enough to justify it

## Implementation Gate

Before implementing localization, run the feature intake interview from:

- [request-intake-and-decision-policy.md](./request-intake-and-decision-policy.md)

Minimum questions to answer:

- Should language preference be per-browser or per-user?
- Which screens are included in the first localization pass?
- Should backend-provided labels remain backend-owned or be mapped in frontend?
- Do exports follow active UI language or fixed Turkish business language?
- Do we need a translator workflow, or will translations be maintained by developers first?

## Verification

Localization implementation should not be considered complete until:

- Turkish is default on first load
- English switch works without reload bugs
- Turkish characters render correctly in all major surfaces
- route guards and auth behavior are unchanged
- date/number formatting changes by locale
- CSV/Excel exports preserve Turkish characters
- release check passes

## Current Decision

Localization is approved as a future project direction.

It is not yet active implementation work.

Until implementation starts:

- keep new user-facing strings easy to move into translation keys
- avoid embedding technical enum text directly into UI
- avoid ASCII-only Turkish labels
- preserve UTF-8 text in docs and frontend files
