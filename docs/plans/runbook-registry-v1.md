# Runbook Registry V1

Status: active
Shelf: operating
Last verified: 2026-05-23

## Reader And Action

Reader:

- an operator, future agent, engineer, or pilot moderator who needs to know
  which repeatable checklist to run for a given project situation.

After reading, they should be able to choose the right runbook, know which
inputs are required, and avoid inventing fake evidence when live input is
missing.

## Registry Rule

This registry points to repeatable procedures. It does not replace the
procedures.

- Use this file to choose the runbook.
- Use the linked document for exact steps and evidence format.
- Do not paste secrets into evidence.
- If a required provider/token/target is missing, record a blocker instead of
  creating mock proof.

## Runbooks

| Situation | Runbook | Required input | Output/evidence | Stop condition |
| --- | --- | --- | --- | --- |
| Continue controlled pilot | `docs/plans/controlled-pilot-execution-roadmap-v1.md` | Pilot user, session scope, feedback owner | Feedback log entry and P0/P1/P2/P3 classification | P0 stop issue, unscoped user, or missing owner. |
| Run pilot day checklist | `docs/plans/controlled-pilot-operating-checklist-v1.md` | Pilot session schedule and roles | Pre/during/after checklist state | Real pilot context is missing. |
| Prove Clerk persona route visibility | `docs/plans/clerk-persona-staging-evidence-runbook-v1.md` | Real Clerk session for target persona | Sanitized role/scope route evidence | No real token/session or role assignment drift. |
| Rebuild persona evidence matrix | `docs/plans/pilot-persona-evidence-runbook-v1.md` | Persona accounts for active role set | Route visibility, backend smoke, read/action scope notes | Any role cannot be proven safely. |
| Prove Store Action command path | `docs/evidence/pilot-readiness/2026-05-23-store-action-command-live-proof-v1.md` | Real `STORE_MANAGER` session and assigned/unassigned stores | Create/status/close/cancel plus 403 negative proof | Missing token, missing store assignment, or unsafe write target. |
| Check deployed readiness | `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md` | Public staging URLs, optional bearer token | Public health and protected route/load evidence | Protected claim requires token but none exists. |
| Check alert routing | `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md` | Better Stack/Render notification path and destination | Provider delivery note and alert smoke output | Destination cannot be proven or email is assumed without delivery. |
| Check Redis/BullMQ posture | `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md` | Render Key Value / Redis URL configured in staging | Queue backend health and durability signal | Broad production claim without persistent-tier decision. |
| Prove Supabase restore posture | `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md` | Approved disposable restore target | Sanitized restore counts and caveats | No approved target or production data risk. |
| Run production evidence closure | `docs/plans/production-evidence-closure-joint-plan-v1.md` and `docs/evidence/readiness/2026-05-23-production-ops-closure-decision-packet-v1.md` | Owner approval for provider/recovery/Redis/incident posture | Production Ops Closure Decision Packet V1 updates | Any external input is missing. |
| Close P0 trust operations | `docs/plans/p0-trust-operations-execution-v1.md` | Provider decision, alert destination, redaction policy, owner path, and target environment | Docs-only gate or later sanitized provider smoke evidence | Provider input is missing, evidence would contain secrets, or behavior would change without scope. |
| Shape operator support work | `docs/plans/p1-operator-support-execution-v1.md` | Support symptom, affected role/scope, safe source fields, and owner | Read-only/docs-only contract or later targeted diagnostic evidence | The slice would mutate data, bypass permissions, expose secrets, or claim runtime proof from docs. |
| Generate system flow map | `docs/flows/README.md` | Current repo source and generator scripts | Updated flow JSON/HTML and contract test result | Generator creates false fanout or broad behavior claim. |
| Add a new feature safely | `docs/plans/feature-integration-spine-v1.md` and `docs/plans/new-module-template.md` | Problem, role, scope, source-of-truth, read/write boundary | Feature intake/spec and go/no-go gates | Source-of-truth, auth, DB, API, or rollback is unclear. |
| Guard docs library structure | `docs/plans/docs-library-metadata-standard-v1.md` | Important doc or shelf change | Metadata, library links, and docs contract test | The library becomes a dumping ground. |
| Execute growth track sequence | `docs/plans/project-growth-execution-roadmap-v1.md` | Current branch, selected track, and Sokrates triage | One reviewable slice with matching verification | Slice mixes multiple tracks or needs missing external input. |
| Run release gate | `docs/plans/project-progress-plan-v1.md` | Clean branch and relevant code/test changes | Local/CI release-gate output | Red check, hidden behavior change, or unreviewable diff. |

## Evidence Safety

Never record:

- raw bearer tokens,
- passwords,
- Clerk cookies,
- provider secrets,
- database URLs,
- Redis URLs,
- personal data beyond sanitized role/scope/session facts.

Use evidence files for proof, not for new direction. Use the decision registry
or source decision doc for direction.

## Update Rule

Add a row when a procedure is repeatable and future work will likely ask,
"which checklist do I run now?"

Do not add a row for:

- one-off notes,
- single PR descriptions,
- broad ideas without a repeatable action,
- provider work that cannot be run without real input.
