# Auth And Authorization Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer or future agent changing login, session, role, scope, route
  visibility, or action-store behavior.

After reading, they should know which documents to open before changing auth
or permission behavior.

## Source Documents

Use these first:

- `docs/plans/scope-auth-regression-matrix-v1.md`
- `docs/plans/authorization-matrix-drift-guard-v1.md`
- `docs/plans/clerk-persona-staging-evidence-runbook-v1.md`
- `docs/plans/pilot-persona-evidence-runbook-v1.md`
- `docs/plans/auth-admin-repository-risk-review-2026-04-30.md`
- `docs/plans/auth-admin-user-account-boundary-decision-v1.md`
- `docs/plans/import-upload-authorization-decision-v1.md`

Current live evidence:

- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`
- `docs/evidence/system-flow/clerk-region-manager-live-evidence-2026-05-23.md`

## Active Rules

- Clerk authenticates identity.
- Application DB role/scope/action-store assignments authorize behavior.
- `readScope` and assigned-store action scope are separate concepts.
- Route visibility proof is not enough; backend endpoint authorization must also
  fail closed.
- Raw tokens, cookies, provider subjects, full JWTs, and private user data do
  not belong in evidence.

## Parked Or High-Risk

- Widening `HR_ADMIN` import/upload permission.
- New roles beyond the active pilot role set.
- Auth redirect/return behavior changes.
- DB role/scope schema changes.

Open those only with a scoped auth decision, targeted tests, and protected
persona evidence.
