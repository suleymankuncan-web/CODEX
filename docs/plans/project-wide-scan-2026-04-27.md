# Project-Wide Scan - 2026-04-27

## Purpose

This report records the full-project control scan requested before the next product step.

It is not a penetration test and it does not replace real staging/production evidence. It is a repository-wide code, configuration, test, release-gate, and risk scan over the local project.

## Scan Scope

Workspace:

```powershell
C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI
```

Scanned local files:

- 626 files, excluding generated/runtime folders such as `.git`, `node_modules`, `dist`, `coverage`, `tmp`, and `temp`.
- root scripts and release gate
- backend NestJS modules, config, auth, scope, repositories, and tests
- frontend React/Vite surfaces, API helpers, browser storage usage, and E2E tests
- docs/plans and current-state handoff files
- `.gitignore`, package scripts, and audit gates

## Release Gate Baseline

Before code fixes, the official root release gate passed:

- root script tests: 9 passed
- backend: lint, 37 suites / 274 tests, build, `npm audit --omit=dev`
- frontend: lint, 7 script tests, build, 28 Playwright tests, `npm audit --omit=dev`

Frontend build did not show the earlier problematic chunk-size warning during this scan.

## Security And Hygiene Findings

### Clear

- No tracked `.env` file was found.
- `.env` files are ignored by `.gitignore`.
- No critical committed secret was found in the project scan.
- Secret-like matches were redaction guards, runbook placeholders, local demo Keycloak defaults, and documentation.
- Frontend scan found no `dangerouslySetInnerHTML`, `eval`, `new Function`, or direct `document.cookie` use.
- Browser `sessionStorage` / `localStorage` use is intentional for auth/session handoff and locale preference.
- Backend has global auth/scope/role guards registered through Nest `APP_GUARD`.
- Backend has global validation with transform, whitelist, and forbid-non-whitelisted behavior.
- Health endpoint remains intentionally public.

### Fixed During Scan

1. Production JWT fallback guard

Risk:

- In production, if `JWT_JWKS_URL` was missing, the application could still fall back to the local `"change-me"` JWT secret.
- That is acceptable for local development, but unsafe as a production fallback.

Fix:

- `AppConfigService.jwtSecret` now rejects missing/default `JWT_SECRET` in production unless JWKS verification is configured.
- Local development keeps its fallback behavior.
- New contract tests cover production failure and JWKS-backed production compatibility.

2. Empty or foreign access-scope guard

Risk:

- Store listing and target-distribution request listing had paths where an empty actor scope or a requested foreign filter could widen access.
- The dangerous shape was: no effective actor scope should never become "all data", and requested filters should constrain actor scope, not replace it.

Fix:

- Store listing now applies actor scope first with priority: store > region > company > no access.
- Requested company/region/store filters are applied as extra constraints.
- Target-distribution listing now applies the same no-empty-scope rule and narrowest-scope priority.
- New repository tests prove empty scope produces `WHERE FALSE` and foreign requested scope cannot replace actor scope.

## Verification After Fix

Targeted red/green tests:

- New tests first failed against the old behavior.
- After the fix, targeted backend tests passed: 3 suites / 7 tests.

Backend release gate after fix:

- `npm.cmd run check:release`
- lint passed
- 40 suites / 281 tests passed
- build passed
- `npm audit --omit=dev` reported 0 vulnerabilities

Official root release gate after fix and documentation:

- root script tests: 9 passed
- backend: lint, 40 suites / 281 tests, build, `npm audit --omit=dev`
- frontend: lint, 7 script tests, build, 28 Playwright tests, `npm audit --omit=dev`
- frontend build completed without a Vite chunk-size warning that would break the build

## Remaining Risk Register

### Blocked External: Real IdP Staging Evidence

Still not completed because the real staging IdP registration values, credentials, and seeded action store IDs are not available in the repo.

Local guardrails are ready. Completion still requires real staging evidence.

### Blocked External: Real Nebim / Source Ingest Evidence

Still not completed because source delivery method, auth model, payload shape, cadence, identity keys, and correction behavior are not confirmed.

Source-agnostic ingest foundations are ready. A Nebim-specific connector should not be guessed.

### Planned Investment: UI / Design System

The current UI remains a working draft by design. This is not counted as hidden release debt because backend/data foundations are still the priority.

### Watch Area: Repeated Scope Rules

This scan closed two concrete scope-widening risks. The next useful local hardening step would be a broader "no empty scope can list all data" repository contract pass, applied carefully to remaining list/query surfaces.

## CODEX Durust Yorum

Proje iyi durumda, ama "prod hazir" diye kandirabilecegimiz bir noktada degil. Daha dogru ifade su: zemin guclu, defter kontrollu, buyume yonu saglikli.

Benim gozumde iyi olan kisimlar:

- release gate artik ciddi calisiyor
- backend test sayisi ve kontrat testleri artiyor
- audit, import, KPI, scope ve auth sinirlari giderek daha net
- yeni fikirler hemen kodlanmiyor; once modul siniri ve risk soruluyor
- competition/feed tarafinda ikinci skor motoru gibi dagitici kararlardan kacindik

Eksik ve dikkat isteyen kisimlar:

- real IdP staging evidence hala dis bagimli
- Nebim/source adapter hala dis bagimli
- tum listeleme repository'leri icin genel no-empty-scope kontrati bir adim daha guclendirilebilir
- UI gorsel kalite bilincli olarak taslakta tutuluyor

Sonuc: proje gercekten iyi bir yolda. En buyuk risk kodun dagilmasi degil; dis kaynak netlesmeden erken connector/feature yazmak olur. O yuzden mevcut yaklasim dogru: sadece planli yatirim kabul edilir.

## Next Logical Step

Sonraki teknik adim icin onerim:

- "No-empty-scope repository contract pass" ile kalan liste/query yuzeylerinde bos actor scope'un asla full data'ya donmedigini testle kilitlemek.

Eger bu hafta Nebim/source bilgisi gelirse, bu adimin yerine source mapping specification acilabilir.
