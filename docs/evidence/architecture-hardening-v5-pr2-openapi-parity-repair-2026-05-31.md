# Architecture Hardening V5 PR-2 OpenAPI Parity Repair

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-openapi-parity`

## Scope

This PR repairs the OpenAPI generator parity blocker recorded in V4 and
reconfirmed in V5 PR-1.

The change is limited to generator metadata preservation:

- `backend/nestjs/src/openapi/openapi-baseline-preservation.ts`
- `backend/nestjs/src/openapi/openapi-baseline-preservation.spec.ts`
- `backend/nestjs/src/openapi/generate-openapi.ts`
- `backend/nestjs/src/openapi/pilot-feedback-openapi.ts`

No controller, DTO validation, service, repository, DB schema, auth,
permission, queue, scoring, or user-facing workflow behavior changed.

## Problem

`npm.cmd --prefix backend/nestjs run openapi:generate` completed from clean
`main`, but rewrote `docs/api/openapi.json` before any helper refactor. V5 PR-1
measured the drift as 1889 insertions and 3167 deletions.

The diff was not a path-set change:

- tracked paths: 156
- generated paths: 156
- only tracked paths: 0
- only generated paths: 0

The drift came from generator metadata instability:

- some DTO schemas lost validation-derived properties,
- some path/query parameters lost baseline metadata,
- some response schemas moved between `$ref` and inline shape,
- unreferenced generated DTO schemas appeared even when custom request schemas
  were the actual contract.

## Repair

The generator now reads the existing tracked OpenAPI document as a baseline and
uses it only to preserve metadata when current generation is degraded:

- richer baseline schema metadata is preserved only when generated schema
  properties are a subset or missing,
- generated schema metadata is not overwritten when generation adds fields,
- operation parameters/request bodies/responses preserve the baseline when the
  generated operation loses metadata,
- generated-only schemas are pruned only when they are not referenced and are
  absent from the tracked baseline,
- path and schema order follows the tracked baseline so repeated generation is
  stable.

The pilot-feedback manual schema now uses `$ref` for nested feedback rows so the
manual schema remains stable instead of expanding the same object inline.

## Contract Impact

Contract Impact: intentionally unchanged.

Proof:

```powershell
git restore -- docs/api/openapi.json
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
```

The final OpenAPI diff is empty.

## Verification

```powershell
npm.cmd --prefix backend/nestjs test -- src/openapi/openapi-baseline-preservation.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs run build
```

## Rollback

Squash revert this PR.

Rollback requires no migration, no data repair, no queue drain, no generated
client rollback, and no user-facing workflow rollback.

## Next Slice

V5 PR-3 can now attempt the OpenAPI generator helper split using the original
parity gate:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:check
```
