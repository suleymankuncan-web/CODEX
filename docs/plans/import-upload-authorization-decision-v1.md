# Import Upload Authorization Decision V1

## Purpose

Record the current product and authorization decision for pilot import/upload
operations after the live Clerk evidence pass.

This decision was superseded on 2026-09-28 by the approved seven-role catalog.

## Decision

The dedicated integration-admin persona is retired. `SUPER_ADMIN` owns
integration and import administration.

The current pilot can treat authenticated import/upload evidence as closed with
the existing `SUPER_ADMIN` pilot session because:

- safe staging Power BI upload returned HTTP `201`,
- import batch list/readback returned HTTP `200` after PR #409 and Render
  deploy,
- there are no active staging `INTEGRATION_ADMIN` assignments,
- creating a role assignment only to make evidence pass would add auth/data
  mutation risk without improving pilot confidence.

Reintroducing a separate integration operator requires a new product and
authorization decision; it is not a parked catalog role.

## HR Admin Note

The product owner may later delegate import/upload operations to `HR_ADMIN`.
That is not claimed by this decision.

Current repo evidence shows:

- admin integration routes currently allow `SUPER_ADMIN`,
- backend integration upload/read endpoints require `SUPER_ADMIN`,
- granting `HR_ADMIN` access would be an explicit auth/permission behavior
  change and must be handled as a separate scoped PR with regression tests.

## Pilot Evidence Result

Controlled pilot import/upload evidence:

- `Go` with the existing `SUPER_ADMIN` pilot session.
- No retired integration-admin realm role or Clerk persona is used.

Broad production:

- still `No-Go`, but not because of an integration-admin persona.
- remaining blockers are Redis/BullMQ durability posture, Supabase restore
  drill, external alert delivery or accepted log-retention evidence, and any
  future role-specific performance budget that the owner requires.

## Guardrails

- Do not recreate a retired integration-admin assignment to satisfy old evidence wording.
- Do not widen `HR_ADMIN` integration permissions without a dedicated auth PR.
- Keep integration operations on `SUPER_ADMIN` until a newer owner decision.
- Do not treat broad production as approved by this decision.

## Verification

Guarded by:

- `scripts/import-upload-authorization-decision-contract.test.mjs`
- `scripts/live-evidence-proof-pass-contract.test.mjs`
- `scripts/production-evidence-blockers-v2-contract.test.mjs`
- `scripts/production-readiness-decision-contract.test.mjs`
