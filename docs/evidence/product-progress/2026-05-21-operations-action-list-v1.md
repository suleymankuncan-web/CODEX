# Operations Action List V1

## Scope

Add a read-only operator action list to `/admin/operations`.

The list is derived from the same existing signals already loaded by the
Operations Control Tower:

- backend health query state,
- import overview and needs-action preview,
- data-quality summary from import and snapshot signals,
- snapshot overview and needs-action preview,
- external evidence blocker list.

## Guardrails

- No backend endpoint was added.
- No API response shape changed.
- No auth, permission, or route access behavior changed.
- No DB migration or runtime/provider configuration changed.
- No import retry, mapping approval, snapshot rerun, scoring, or data-quality
  workflow behavior changed.

## Verification

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1`
