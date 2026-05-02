# UI Localization Foundation Design

## Goal

Build the first stable localization foundation for `admin-web` so the app can default to Turkish, switch to English, and grow screen by screen without rewriting UI surfaces later.

## Scope

- Default language is Turkish (`tr`).
- English (`en`) is available from a small shell-level toggle.
- The preference is stored in the browser first; user-profile persistence can be added later.
- V1 localizes the competition read experience and the shell labels needed to prove the pattern.
- API enum values, role codes, audit codes, and backend-owned identifiers remain stable and untranslated.

## Approach

Use a lightweight typed dictionary instead of adding `react-i18next` now. The app already has `admin-web/src/lib/i18n.ts`; V1 extends that file for storage and locale normalization, then adds a focused React provider under `admin-web/src/features/localization`.

The provider exposes `locale`, `setLocale`, and `t(key)`. Pages can opt in one at a time, starting with admin/store competition surfaces. Readability helpers accept a locale so their labels stay deterministic and easy to test.

## UI

The language selector is a compact segmented control with `TR` and `EN` buttons. It appears in admin and store shell action clusters, keeps existing routes intact, and has accessible labels. The selector does not become a settings module yet.

## Testing

Playwright covers the V1 behavior:

- Default store competition read summary appears in Turkish.
- Switching to English updates the same visible labels.
- The selected language persists after reload.

Release verification remains `npm.cmd run check:release` from `admin-web`.

## CODEX Dürüst Yorum

This is intentionally small. Full-app translation now would create noise and churn because many older screens still mix product copy, technical labels, and partially Turkish text. This foundation gives us the safe path: new and actively touched surfaces become localized, while backend contracts stay stable.
