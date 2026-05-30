# Architecture Hardening V4 PR-5 OpenAPI Generator Parity Blocker

Date: 2026-05-31
Branch: `codex/v4-pr5-openapi-generator-helper-split`

## Summary

PR-5 cannot safely start the OpenAPI generator helper split yet because the
pre-refactor parity gate fails on a clean `origin/main` baseline.

The PR-1 contract requires this command sequence to produce no
`docs/api/openapi.json` diff before and after the refactor:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:check
```

Current evidence shows the first command rewrites the tracked OpenAPI contract
before any PR-5 code changes. That means a helper split cannot prove
`Contract Impact: unchanged` using the required gate.

## Evidence

From clean `origin/main` commit `9c3c32afcf1748e3fd515d81d96437e2b8157891`:

- `npm.cmd --prefix backend/nestjs run openapi:generate` completed.
- `git diff -- docs/api/openapi.json` produced a large diff.
- `npm.cmd --prefix admin-web run api:check` then failed with stale generated
  types against the rewritten OpenAPI output.
- After restoring `docs/api/openapi.json`, `npm.cmd --prefix admin-web run
  api:check` passed again.

A semantic probe comparing tracked vs generated OpenAPI documents showed:

```json
{
  "trackedPaths": 156,
  "generatedPaths": 156,
  "pathDiff": { "onlyTracked": [], "onlyGenerated": [] },
  "trackedSchemas": 139,
  "generatedSchemas": 134,
  "schemaDiffOnlyTrackedCount": 7,
  "schemaDiffOnlyGeneratedCount": 2
}
```

The path set is stable, but schema metadata is not. A stable-key comparison
shows the generated DTO schemas lose validation-derived properties. Example:

- tracked `AcknowledgeChecklistInstanceDto` has `acknowledgementNote`.
- generated `AcknowledgeChecklistInstanceDto` has empty `properties`.
- tracked `AddChecklistResponseDto` has `templateItemId`, `responseValue`,
  `scoreValue`, `isNonCompliant`, and `commentText`.
- generated `AddChecklistResponseDto` has empty `properties`.

The built file for `AddChecklistResponseDto` contains TypeScript design metadata
but no Swagger plugin `_OPENAPI_METADATA_FACTORY`, while some DTOs with explicit
Swagger metadata do have it. This indicates a generator metadata/baseline drift,
not a safe helper-only refactor target.

## Decision

PR-5 helper extraction is stopped.

Do not refactor `backend/nestjs/src/openapi/generate-openapi.ts` until a separate
OpenAPI baseline/metadata decision is made and the pre-refactor parity gate is
green.

## Non-Goals

This evidence does not approve:

- updating `docs/api/openapi.json`,
- regenerating `admin-web/src/generated/openapi-types.ts`,
- changing API response shape,
- changing Nest Swagger plugin settings,
- adding DTO decorators broadly.

Those require a separate PR with `Contract Impact: changed` or an explicit
metadata restoration plan.

## Next Safe Action

Proceed only with a separate OpenAPI generator parity repair/investigation PR,
or park PR-5 and continue with the next V4 slice that does not depend on the
OpenAPI generated-output contract.