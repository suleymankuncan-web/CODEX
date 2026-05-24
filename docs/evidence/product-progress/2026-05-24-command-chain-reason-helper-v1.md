# Command Chain Reason Helper V1 Evidence

Date: 2026-05-24

## Scope

The first Command Chain code slice adds a pure frontend helper that converts
already-fetched workflow, Store Action, and operations signal inputs into
source-linked reason items.

It does not render a new route, add a backend endpoint, change API response
shape, change auth or permission semantics, add DB state, change scoring,
change workflow lifecycle, or introduce AI/advice.

## Source Rules

- `STORE_PERSONNEL` receives no Command Chain management reasons.
- Ready operations signals are skipped; loading/unavailable signals keep an
  explicit limitation instead of becoming a zero-pressure claim.
- Workflow inbox items remain source-owned evidence. Checklist receipts and
  target requests carry limitation copy so they are not reinterpreted as direct
  coaching or target policy.
- Signal-source roles follow the current route guards. Import reasons are
  limited to `SUPER_ADMIN`/`INTEGRATION_ADMIN`, and snapshot reasons are
  limited to `SUPER_ADMIN`/`SNAPSHOT_OPERATOR`.
- Workflow-source roles follow source-route/source-guard evidence for target
  approvals, checklist acknowledgements, and Store Action plan items. Target
  approval reasons include `REGION_MANAGER` because `/admin/targets` is an
  allowed region-manager surface; store-manager target reasons remain blocked.
- Persisted Store Action plans are treated as the current human follow-up
  surface, not as new automatic escalation.
- Token/session/secret-looking source identifiers are redacted before a reason
  item is returned.
- Unknown source families, unknown workflow source types, and malformed
  source role lists fail closed by returning no reason instead of crashing or
  widening visibility.

## Verification

- `npm.cmd --prefix admin-web run test:scripts`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `git diff --check`

## Next Safe Slice

The helper can be wired into a minimal read-only admin/region surface only if a
real pilot question asks for "why does this store need attention?" visibility.
That later slice should still avoid new backend aggregation until the helper's
source vocabulary proves useful in product use.
