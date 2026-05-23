# Decision Registry V1

Status: active
Shelf: operating
Last verified: 2026-05-23

## Reader And Action

Reader:

- a future agent, engineer, product owner, or operator who needs to know why the
  project is in its current state before opening code, provider, or product
  work.

After reading, they should be able to find the active decision, its source
document, and the trigger that would change it.

## Registry Rule

This registry is a map, not a replacement for the source documents.

- Use it to find the current decision quickly.
- Use the linked source document for details and evidence.
- Do not treat a registry row as runtime proof.
- Do not change behavior by editing this file.
- If a decision changes, update the source document first, then this registry.

## Active Decisions

| Decision | Status | Current stance | Source of truth | Change trigger |
| --- | --- | --- | --- | --- |
| Controlled pilot execution | active | Continue with scoped staging/internal pilot users; fix real P0/P1 blockers and record feedback. | `docs/plans/controlled-pilot-execution-roadmap-v1.md` | Pilot feedback reveals a stop issue or a new pilot cohort is proposed. |
| Broad production rollout | blocked_external | No-Go. Local gates and staging proof are not enough for broad production. | `docs/evidence/readiness/2026-05-18-production-readiness-decision.md` | Production owner accepts Redis, alerting, backup/PITR/RPO/RTO, incident, and provider posture. |
| Documentation library | guarded | `docs/README.md` is the front door; important docs carry status/shelf metadata. | `docs/plans/docs-library-metadata-standard-v1.md` | New docs become undiscoverable or active/parked/historical status drifts. |
| Project growth execution | active | Execute the next eight growth tracks in order, one reviewable slice at a time. | `docs/plans/project-growth-execution-roadmap-v1.md` | Pilot feedback, data-quality, operations, coaching, auth preview, rules, workforce, or production ops direction changes. |
| Sokrates and work discipline | active | Sokrates is the default decision system; `discipline.md` is the daily PR/test rhythm. | `sokrates.md`, `discipline.md` | Real misses show the process is too heavy, too loose, or stale. |
| Refactor workstream | closed | Broad refactor is closed as a standing theme; refactor only when a concrete product/risk slice needs it. | `docs/plans/refactor-completion-inventory-v1.md` | File-size guard fails, reviewability degrades, or a product slice exposes a boundary problem. |
| API contract drift | guarded | OpenAPI/generated client approach is established; do not hand-roll new frontend API contracts casually. | `docs/plans/api-contract-drift-plan.md` | New endpoint family or contract drift risk appears. |
| Store Action V1B | active | Persisted Store Action command path is proven for controlled pilot manager scope; future expansion needs separate go/no-go. | `docs/domains/store-action.md` | Non-KPI sources, detail/comments/attachments/escalation, or broader roles are proposed. |
| Auth source of truth | guarded | Application DB role/scope/action-store assignments authorize behavior; Clerk proves identity/session. | `docs/domains/auth.md` | Role model, scope semantics, or provider session assumptions change. |
| Role set | active | Active roles include `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`. | `docs/plans/pilot-persona-evidence-runbook-v1.md` | A new role is introduced or route visibility changes. |
| Integration admin role | parked | Dedicated `INTEGRATION_ADMIN` is not required for the current controlled pilot; super-admin or HR/admin delegation covers the path. | `docs/plans/import-upload-authorization-decision-v1.md` | A real operator model requires separate integration-only authority. |
| JSON source integration | parked | JSON source integration is suspended; Excel/Power BI remain the active import path. | `docs/domains/import-master-data.md` | A real JSON provider contract, mapping evidence, and reconciliation plan exist. |
| Redis/BullMQ posture | active/blocked_external | Staging durable queue proof exists for controlled pilot; broad production needs persistent-tier or explicit risk acceptance. | `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md` | Broad production is requested or queue durability becomes business-critical. |
| Alert provider posture | active/blocked_external | Slack/Better Stack staging alert path is proven; email is not counted as proven. | `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md` | Production alert destination, escalation owner, and provider proof are accepted. |
| Supabase recovery posture | active/blocked_external | Staging logical restore is proven; managed backup/PITR/RPO/RTO acceptance remains broad-production work. | `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md` | Production recovery policy and restore target are approved. |
| UI redesign | parked | Do not polish or redesign broad UI until the user starts the design track. | `docs/plans/active-next-actions.md` | User explicitly begins the visual/site/page redesign phase. |
| Norm Kadro / Workforce Planning Read-Only V1 | active evidence | Do not create a new module now; use existing workforce norm plan, snapshot/reporting, and headcount-gap reads as read-only planning context. | `docs/evidence/norm-kadro-workforce-planning-readonly-v1.md` | A mutable baseline editor, new API, Store Action source, approval flow, payroll, scheduling, or labor-policy behavior is proposed. |

## Update Rule

When adding or changing a decision:

1. Make or update the source document first.
2. Add one row here with status, stance, source, and trigger.
3. Link from `docs/README.md` only if a cold reader should start from it.
4. Add a guard only when drift would create real confusion.

## Stop Rules

Stop and split the work if a registry update starts changing:

- code behavior,
- API response shape,
- auth or permission semantics,
- DB schema or migrations,
- provider config,
- CSS or user-facing workflow,
- production readiness claims without real evidence.
