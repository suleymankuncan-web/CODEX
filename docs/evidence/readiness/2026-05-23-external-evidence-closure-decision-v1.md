# External Evidence Closure Decision V1 - 2026-05-23

## Scope

This note consolidates the current external-evidence posture after the Redis,
alert delivery, Supabase recovery, upload, and protected persona evidence
threads were split out of one broad blocker.

It is a decision record. It does not change product code, API response shape,
auth/permission semantics, database schema, provider configuration, CSS,
workflow behavior, or user-facing behavior.

It records no raw bearer tokens, cookies, auth codes, provider subject IDs,
database URLs, Redis URLs, passwords, provider tokens, Slack webhook URLs,
message IDs, private keys, private email contents, or private payloads.

## Sokrates Decision

Claim:

- The project now has enough named evidence for a controlled internal pilot,
  but not enough for broad production.

Assumptions:

- The project is not being launched to the field yet.
- `READINESS_PROFILE=controlled-pilot` is the correct live staging posture.
- Controlled pilot can tolerate operator-run recovery and rerunnable queue
  work, as long as those limits are explicit.
- Broad production requires stronger provider posture, RPO/RTO acceptance, and
  incident policy before widening access.

Evidence:

- Protected persona evidence:
  `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`.
- Redis/BullMQ staging proof:
  `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`.
- Redis production posture:
  `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`.
- Alert provider delivery:
  `docs/evidence/readiness/2026-05-22-alert-provider-delivery-proof.md`.
- Alert email policy:
  `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`.
- Better Stack email alert proof:
  `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`.
- Supabase logical restore proof:
  `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`.
- Supabase recovery posture:
  `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`.
- Upload proof and authorization decision:
  `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md` and
  `docs/plans/import-upload-authorization-decision-v1.md`.

Counterargument:

- Controlled-pilot readiness is not broad-production readiness.
- Provider tests do not replace production incident policy.
- Free/non-persistent Redis does not prove durable production queue behavior.
- Logical local restore does not prove managed Supabase restore or PITR.
- `SUPER_ADMIN` upload proof does not prove future `HR_ADMIN` upload
  delegation.

Risk:

- Controlled internal pilot: LOW/MEDIUM if the current guardrails stay in
  place and scope stays narrow.
- Broad production today: HIGH and No-Go.
- Treating this decision as a field rollout approval: HIGH and blocked.

Door:

- Controlled-pilot evidence closure is a two-way-door. It can be strengthened
  later without rewriting the app.
- Broad-production provider changes, recovery drills, and incident policy are
  near one-way-door enough to require explicit owner acceptance.

Stop rule used:

- Do not fake provider evidence.
- Do not record secrets or private payloads.
- Do not run destructive restore against production or the staging source.
- Do not change auth/API/DB/provider behavior while closing docs evidence.

## Closure Matrix

| Area | Controlled Pilot Status | Broad Production Status | Notes |
| --- | --- | --- | --- |
| Protected Clerk personas | Closed | Needs rerun after broad-release config changes | Five-persona route/API/scope evidence exists. |
| Assigned-store action scope | Closed for sampled store manager path | Needs rerun after role/scope changes | Assigned read returned allowed, unassigned read returned forbidden. |
| Redis/BullMQ | Closed with accepted Free-tier pilot risk | No-Go until persistent Redis-compatible tier or explicit written risk acceptance | Free/non-persistent tier is not production durable queue evidence. |
| Alert delivery | Closed for controlled pilot | Needs final incident policy and app-level error-tracking decision if required | Render Slack and Better Stack email test alert are proven. |
| Supabase recovery | Closed with local logical restore accepted | No-Go until managed/PITR/RPO/RTO posture is accepted or tested | Logical restore covers app-owned schemas, not full Supabase platform restoration. |
| Upload/import smoke | Closed for current `SUPER_ADMIN` operator path | Needs new decision if ownership shifts to `HR_ADMIN` or another role | Do not create `INTEGRATION_ADMIN` just to satisfy old blocker wording. |

## Current Decision

Controlled internal pilot:

- Status: Conditional Go.
- The previously broad external-evidence blocker is now split into named,
  reviewable decisions.
- The project may continue internal/staging controlled-pilot work with:
  - real protected persona evidence,
  - Redis/BullMQ staging health,
  - accepted Free-tier Redis risk for controlled pilot,
  - external Slack/email alert delivery proof,
  - accepted logical restore proof,
  - safe upload evidence through the approved `SUPER_ADMIN` operator path.

Broad production:

- Status: No-Go.
- The remaining blockers are explicit and no longer generic:
  - production-grade Redis upgrade/evidence or written risk acceptance,
  - incident policy/app-level error-tracking decision,
  - managed Supabase restore/PITR/RPO/RTO posture,
  - any future import/upload role delegation proof,
  - rerun protected persona and performance evidence after any broad-release
    config change.

## Upload Reconciliation

Current upload proof is closed for the controlled pilot because:

- safe staging upload returned HTTP `201`,
- the uploaded sample was intentionally minimal and non-private,
- `docs/plans/import-upload-authorization-decision-v1.md` accepts the current
  `SUPER_ADMIN` pilot session,
- a dedicated `INTEGRATION_ADMIN` persona is not required for the current pilot.

Future changes:

- If upload ownership shifts to `HR_ADMIN`, first scope the auth/API route
  change and then rerun a sanitized upload/readback smoke.
- If a new sample file is required, define the safe sample shape first.
- Do not add a new role or widen permissions as part of evidence bookkeeping.

## Verification Ladder

Local:

- `git diff --check`
- `npm.cmd run test:scripts`

Before broad production:

- Rerun deployed readiness and protected persona smoke after final provider
  config changes.
- Rerun backend protected load with real role-specific tokens.
- Prove Redis persistent tier health.
- Accept or test Supabase managed/PITR recovery posture.
- Decide whether Better Stack plus Render notifications are enough or whether
  app-level error tracking is required.

## Final Posture

- Controlled pilot: Conditional Go.
- Broad production: No-Go.
- Rewrite/rearchitecture: Not indicated by this evidence work.
- Next best work: either broad-production provider hardening when the product is
  ready for field launch, or continue product/domain work under the controlled
  pilot posture.
