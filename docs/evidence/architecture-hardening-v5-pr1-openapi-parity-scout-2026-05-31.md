# Architecture Hardening V5 PR-1 OpenAPI Parity Scout

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-plan`

## Scope

This scout rechecked the V4 OpenAPI generator blocker from current `main`
before starting any V5 runtime changes.

No generator code, DTO code, controller code, generated client file, API route,
auth behavior, DB schema, or user-facing workflow was changed.

## Commands Run

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff --stat -- docs/api/openapi.json
git diff --numstat -- docs/api/openapi.json
```

The generated `docs/api/openapi.json` diff was then restored with:

```powershell
git restore -- docs/api/openapi.json
```

## Result

The V4 blocker still reproduces.

`openapi:generate` completes successfully, but rewrites the tracked OpenAPI
contract before any generator helper refactor:

```text
docs/api/openapi.json | 5056 ++++++++++++++++++-------------------------------
1 file changed, 1889 insertions(+), 3167 deletions(-)
```

Semantic comparison of tracked versus freshly generated OpenAPI output:

```json
{
  "trackedPaths": 156,
  "generatedPaths": 156,
  "pathDiff": {
    "onlyTracked": [],
    "onlyGenerated": []
  },
  "trackedSchemas": 139,
  "generatedSchemas": 134,
  "schemaDiffOnlyTrackedCount": 7,
  "schemaDiffOnlyGeneratedCount": 2,
  "changedSchemaCount": 46,
  "changedPathCount": 9,
  "firstChangedSchemas": [
    "CreateActionStoreAssignmentDto",
    "CreateUserAccountDto",
    "CreatePilotUserBindingDto",
    "GrantRolePermissionDto",
    "RegisterMobileSessionDto",
    "CreateSellerCodeRequestDto",
    "CreateOffboardingRequestDto",
    "ApproveSellerCodeRequestDto",
    "RejectWorkforceRequestDto",
    "ResubmitSellerCodeRequestDto"
  ],
  "firstChangedPaths": [
    "/api/admin/migrations/run",
    "/api/admin/migrations/status",
    "/api/admin/checklist-templates/{checklistTemplateId}/publish",
    "/api/mobile/checklists/instances/{checklistInstanceId}/responses",
    "/api/mobile/checklists/instances/{checklistInstanceId}/complete",
    "/api/mobile/checklists/instances/{checklistInstanceId}/acknowledge",
    "/api/feed",
    "/api/admin/feed",
    "/api/snapshots/daily-closure/run"
  ]
}
```

## Decision

V5 must start with OpenAPI metadata/baseline repair, not generator helper
extraction.

The safe next runtime PR is `Architecture Hardening V5 PR-2` from
`docs/plans/architecture-hardening-v5-plan.md`:

- classify each diff family,
- decide whether the generated contract should be restored as
  `Contract Impact: unchanged` or updated as `Contract Impact: changed`,
- make the parity gate green before moving `generate-openapi.ts` internals.

## Stop Conditions Carried Forward

PR-2 must stop if:

- repairing metadata changes runtime API behavior,
- frontend generated types would change without an explicit contract decision,
- broad DTO decorator changes are proposed without exact diff evidence,
- a generator helper split is attempted before the parity gate is green.
