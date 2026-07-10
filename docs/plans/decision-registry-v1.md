# Decision Registry V1

Status: active
Shelf: operating
Last verified: 2026-07-10

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
| Project growth execution | closed | The first eight post-foundation tracks are complete; the roadmap is reference, not automatic next work. | `docs/plans/project-growth-execution-roadmap-v1.md` | Full project analysis or pilot evidence identifies a new ordered growth line. |
| Sokrates and work discipline | active | Use layered reading. GitHub Codex review is owner-disabled and must not be requested or awaited; required checks, mergeability, verification, and final local adversarial review remain mandatory. | `CONTRIBUTING.md`, `sokrates.md`, `discipline.md` | A newer explicit owner instruction re-enables GitHub Codex review, or real misses show the process is too heavy, too loose, or stale. |
| CI post-merge release proof | guarded | Run the canonical full release once for a release-impacting PR. Reuse it after merge only when the associated merged PR, base parent, latest successful gate timing, and tree hash match exactly; otherwise run the full release fallback. | `docs/plans/release-check-gate.md` | Exact-tree proof produces a false acceptance, repeated false fallback, or a supported merge strategy changes. |
| Refactor workstream | closed | Broad refactor is closed as a standing theme; refactor only when a concrete product/risk slice needs it. | `docs/plans/refactor-completion-inventory-v1.md` | File-size guard fails, reviewability degrades, or a product slice exposes a boundary problem. |
| API contract drift | guarded | OpenAPI/generated client approach is established; do not hand-roll new frontend API contracts casually. | `docs/plans/api-contract-drift-plan.md` | New endpoint family or contract drift risk appears. |
| Store Action V1B | guarded | Persisted manager command path and checklist remediation are implemented in controlled scope; target projection runtime generation remains parked. | `docs/domains/store-action.md`, `docs/evidence/store-action-checklist-remediation-v1-closeout-2026-06-02.md` | Target projection runtime, wider sources/actions, comments/attachments/escalation, region-manager verification, or broader roles are proposed. |
| Auth source of truth | guarded | Application DB role/scope/action-store assignments authorize behavior; Clerk proves identity/session. | `docs/domains/auth.md` | Role model, scope semantics, or provider session assumptions change. |
| Role set | active | Active roles include `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, `STORE_PERSONNEL`, `REPORT_VIEWER`, and `VISUAL_MERCHANDISER`. Visual Merchandiser is a specialized store-facing checklist role, not a default pilot persona; VM-only Store access is limited by the active route matrix. | `docs/plans/pilot-persona-evidence-runbook-v1.md`, `docs/plans/pilot-scenario-pack-v1.md`, `docs/architecture/pilot-route-role-matrix.md` | A backend catalog role, route visibility, or pilot persona decision changes. |
| Integration admin role | parked | Dedicated `INTEGRATION_ADMIN` is not required for the current controlled pilot; super-admin or HR/admin delegation covers the path. | `docs/plans/import-upload-authorization-decision-v1.md` | A real operator model requires separate integration-only authority. |
| JSON source integration | parked | JSON source integration is suspended; Excel/Power BI remain the active import path. | `docs/domains/import-master-data.md` | A real JSON provider contract, mapping evidence, and reconciliation plan exist. |
| Redis/BullMQ posture | active/blocked_external | Staging durable queue proof exists for controlled pilot; broad production needs persistent-tier or explicit risk acceptance. | `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md` | Broad production is requested or queue durability becomes business-critical. |
| Alert provider posture | active/blocked_external | Better Stack external health email alert proof plus Render platform notifications are accepted for controlled pilot; app-level exception tracking and final production incident policy remain parked. | `docs/plans/controlled-pilot-alert-incident-policy-v1.md` | Production alert destination, escalation owner, app-level error tracking decision or explicit risk acceptance, and production profile proof are accepted. |
| Supabase recovery posture | active/blocked_external | App-owned schema logical restore is accepted for controlled pilot; managed restore/PITR/RPO/RTO and non-database Supabase surface recovery remain parked production work. | `docs/plans/controlled-pilot-recovery-posture-v1.md` | Production recovery policy, disposable managed restore target, PITR/RPO/RTO posture, or explicit owner risk acceptance is approved. |
| Production Ops Closure Decision Packet V1 | active/blocked_external | Controlled pilot remains Conditional Go; broad production remains No-Go until Redis, recovery, incident, protected smoke, upload delegation, and rollback authority owner rows are accepted. | `docs/evidence/readiness/2026-05-23-production-ops-closure-decision-packet-v1.md` | Owner accepts the rows and final provider/env smoke evidence is rerun. |
| P0 trust operations | active/blocked_external | Controlled pilot uses existing log-only observability; provider-backed app-level error tracking and broad-production trust claims wait for provider, destination, redaction, owner, and smoke proof. | `docs/plans/p0-trust-operations-execution-v1.md` | Provider is selected, owner path is accepted, auth/provider/env changes expire evidence, or broad production is requested. |
| P1 operator support | active | Start with read-only/docs-only support contracts for trace, diagnostics, stale data, idempotency, correction, import preview, performance escalation, role lifecycle, and glossary. | `docs/plans/p1-operator-support-execution-v1.md` | Pilot support friction, diagnostic UI work, data correction, import preview, or support permission requests appear. |
| P2 product intelligence | active | Do not build UI now. Keep Daily Command Brief, Command Chain Intelligence, Store Performance Replay, internal change visibility, and usage/performance correlation behind source-linked read-only slices and explicit UI/content intake. | `docs/plans/p2-product-intelligence-execution-v1.md` | User starts UI/content redesign, pilot feedback asks for a brief/replay, or a source-linked read-only slice is explicitly chosen. |
| P3 operating triggers | parked/triggered | Migration policy, dependency cadence, browser/device support, evidence automation, freeze windows, manual overrides, pilot triage cadence, mutable Norm Kadro, protected performance, and app-level error tracking are not active work until their trigger occurs. | `docs/plans/p3-operating-triggers-v1.md` | A dated trigger, owner, verification ladder, and one-paragraph PR story exist. |
| UI redesign | guarded/parked | Scoped Store/Admin modernization trains are complete; another broad redesign is parked. | `docs/process/product-experience-principles.md`, `docs/plans/active-next-actions.md` | Owner explicitly opens a new visual/product-experience track after project analysis or pilot evidence. |
| Norm Kadro / Workforce Planning Read-Only V1 | active evidence | Do not create a new module now; use existing workforce norm plan, snapshot/reporting, and headcount-gap reads as read-only planning context. | `docs/evidence/norm-kadro-workforce-planning-readonly-v1.md` | A mutable baseline editor, new API, Store Action source, approval flow, payroll, scheduling, or labor-policy behavior is proposed. |
| Separate mobile app | parked | Discovery, persona order, offline posture, and prototype sequence are documented; implementation is not active. | `docs/plans/mobile-app-discovery-v1.md` | Owner approves implementation after project analysis and a screen/data/auth/offline intake. |
| Workspace hygiene cleanup | guarded | Inventory is classified as merged/superseded/dirty/unknown/preserve; no deletion is authorized. | `docs/plans/workspace-hygiene-inventory-2026-07-09.md` | Owner approves a separately verified proposed-delete list. |
| Project-analysis implementation | active/evidence-gated | Owner-approved execution completed A1 (#917), A2 (#918), B1 blocker recording (#920), E1 (#921), and bounded D1 pure-logic unit-test seeding (#923). B1 now has partial owner-attested positive mutation evidence with remaining read-only gaps blocked; A3 (#919) still needs ten successful root-release runs for its dated p95 outcome. Runtime remains parked without a factual P0/P1 finding. | `docs/plans/project-analysis-implementation-plan-v1.md`, `docs/evidence/performance/2026-07-10-e2e-worker-concurrency-a3.md`, `docs/evidence/pilot-readiness/2026-07-05-owner-attested-mutation-flows.md`, `docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md` | Ten A3 root-release samples are available, remaining B1 read-only inputs arrive, a factual P0/P1 finding appears, or the owner amends the plan. |
| Next runtime train | parked | Docs/process alignment and analysis are complete, but no runtime line is selected automatically. | `current-state.md`, `docs/plans/project-control-board-v1.md`, `docs/plans/project-analysis-implementation-plan-v1.md` | An approved P0/P1 pilot/demo finding produces one reviewable finding-specific spec. |

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
