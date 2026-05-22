# Import Upload Authorization Decision V1

## Purpose

Record the current product and authorization decision for pilot import/upload
operations after the live Clerk evidence pass.

This is a docs-only decision. It does not change backend guards, frontend route
guards, API response shape, database schema, provider configuration, or user
workflow behavior.

## Decision

Dedicated `INTEGRATION_ADMIN` persona proof is not required for the current
controlled pilot.

The current pilot can treat authenticated import/upload evidence as closed with
the existing `SUPER_ADMIN` pilot session because:

- safe staging Power BI upload returned HTTP `201`,
- import batch list/readback returned HTTP `200` after PR #409 and Render
  deploy,
- there are no active staging `INTEGRATION_ADMIN` assignments,
- creating a role assignment only to make evidence pass would add auth/data
  mutation risk without improving pilot confidence.

`INTEGRATION_ADMIN` remains a future optional separation-of-duties role, not a
pilot blocker.

## HR Admin Note

The product owner may later delegate import/upload operations to `HR_ADMIN`.
That is not claimed by this decision.

Current repo evidence shows:

- admin integration routes currently allow `SUPER_ADMIN` and
  `INTEGRATION_ADMIN`,
- backend integration upload/read endpoints currently require
  `INTEGRATION_ADMIN`,
- `SUPER_ADMIN` can satisfy those requirements through the existing role guard,
- granting `HR_ADMIN` access would be an explicit auth/permission behavior
  change and must be handled as a separate scoped PR with regression tests.

## Pilot Evidence Result

Controlled pilot import/upload evidence:

- `Go` with the existing `SUPER_ADMIN` pilot session.
- No dedicated `INTEGRATION_ADMIN` Clerk persona is needed before the current
  pilot continues.

Broad production:

- still `No-Go`, but not because of missing dedicated `INTEGRATION_ADMIN`
  evidence.
- remaining blockers are Redis/BullMQ durability posture, Supabase restore
  drill, external alert delivery or accepted log-retention evidence, and any
  future role-specific performance budget that the owner requires.

## Guardrails

- Do not create a staging `INTEGRATION_ADMIN` assignment just to satisfy old
  evidence wording.
- Do not widen `HR_ADMIN` integration permissions without a dedicated auth PR.
- Do not remove the `INTEGRATION_ADMIN` role catalog entry in this docs-only
  decision.
- Do not treat broad production as approved by this decision.

## Verification

Guarded by:

- `scripts/import-upload-authorization-decision-contract.test.mjs`
- `scripts/live-evidence-proof-pass-contract.test.mjs`
- `scripts/production-evidence-blockers-v2-contract.test.mjs`
- `scripts/production-readiness-decision-contract.test.mjs`
