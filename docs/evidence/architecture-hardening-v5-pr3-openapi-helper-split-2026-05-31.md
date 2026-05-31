# Architecture Hardening V5 PR-3 OpenAPI Helper Split

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-openapi-helper-split`

## Scope

This PR performs the generator helper split that was blocked in V4 and made
safe by V5 PR-2.

Runtime behavior remains unchanged. The extraction only moves pure OpenAPI
schema helper functions and the mutable path item type out of:

- `backend/nestjs/src/openapi/generate-openapi.ts`

and into:

- `backend/nestjs/src/openapi/openapi-schema-helpers.ts`

## Contract Impact

Contract Impact: unchanged.

The acceptance gate is an empty generated OpenAPI diff:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff --exit-code -- docs/api/openapi.json
```

## Size Impact

The frozen oversized source baseline is reduced:

- `backend/nestjs/src/openapi/generate-openapi.ts`: 5256 -> 5169 lines
- `backend/nestjs/src/openapi/openapi-schema-helpers.ts`: 93 lines

The file-size guard baseline in `scripts/file-size-guard.test.mjs` was lowered
to the new real generator size so future PRs cannot silently grow it back.

## Verification

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff --exit-code -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
```

`npm.cmd run test:scripts` initially failed as expected because the frozen
oversized baseline still pointed at the old 5256-line generator. The baseline
was lowered to 5169 and the command must pass before PR open.

## Rollback

Revert the helper extraction and file-size baseline update. No migration, data
repair, queue drain, API client regeneration, or runtime deployment sequencing
is required.
