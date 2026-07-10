# Archive Guard Migration Register V1

Status: active
Shelf: architecture
Use when: an executable documentation guard still depends on the former long handoff.
Do not use when: reconstructing historical project direction or bulk-rewriting archive references.
Last verified: 2026-07-10
Source of truth: the narrow active document named for each guard domain.

## Reader And Action

Reader:

- an engineer or future agent changing a documentation guard that still reads
  historical handoff material.

After reading, they should be able to replace only the guard they touch with
the narrowest active authority, while preserving the archive for historical
reconstruction.

## Rule

The active handoff is for current facts and next action. The former long
handoff is historical context, not a universal discoverability index. Do not
add a new executable dependency on it. Migrate dependencies incrementally when
a guard is already being touched; do not bulk rewrite the remaining archive
readers.

## First Completed Group

| Guard domain | Canonical authority now used | Reason |
| --- | --- | --- |
| File-size policy | Execution discipline and refactor-completion inventory | The policy and exception boundary live with current engineering rules. |
| Evidence command index | Documentation library, runbook registry, and P3 trigger policy | Command discoverability belongs to the current operating library. |
| Mobile checklist implementation plan | Active next actions and debt ledger | Completion and debt accounting are current planning facts. |
| Mobile checklist design | Active next actions and debt ledger | Design completion is current planning/accounting context, not handoff history. |
| Debt-ledger consistency | Active handoff, active next actions, and debt ledger | Counts and paid-debt rationale have live canonical owners. |

## Remaining Reader Inventory

Inventory baseline: `origin/main` had 46 executable readers of
`docs/history/current-state-through-pr-913-2026-07-09.md`. The first completed
group removes five safe dependencies. The 41 entries below are the remaining
2026-07-10 snapshot, including the one deliberate archive-boundary guard.
They are an on-touch migration queue, not authority to bulk-edit the readers.

| Guard | Domain | Narrow active owner on touch | Disposition |
| --- | --- | --- | --- |
| `scripts/alert-provider-delivery-proof-contract.test.mjs` | alert/readiness evidence | `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/backend-foundation-hardening-plan-contract.test.mjs` | hardening/debt | `docs/plans/active-next-actions.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/backup-restore-drill-runbook-contract.test.mjs` | recovery runbook | `docs/plans/controlled-pilot-recovery-posture-v1.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/backup-restore-local-evidence-contract.test.mjs` | local restore evidence | `docs/plans/project-debt-ledger.md` | safe |
| `scripts/controlled-pilot-feedback-log-contract.test.mjs` | pilot operating record | `docs/plans/controlled-pilot-operating-checklist-v1.md`; `docs/plans/pilot-readiness-gate-v1.md` | safe |
| `scripts/controlled-pilot-operating-checklist-contract.test.mjs` | pilot runbook discovery | `docs/plans/pilot-readiness-gate-v1.md`; `docs/plans/runbook-registry-v1.md` | safe |
| `scripts/controlled-pilot-round-1-outcome-contract.test.mjs` | round-one provenance | `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`; `docs/plans/pilot-readiness-gate-v1.md` | safe |
| `scripts/controlled-pilot-round-2-stabilization-contract.test.mjs` | round-two provenance | `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/current-state-handoff-contract.test.mjs` | archive supersession boundary | `docs/history/current-state-through-pr-913-2026-07-09.md` only for its named historical-status assertion | retain: narrow provenance exception |
| `admin-web/scripts/localization-contract.test.mjs` | localization closeout history | `docs/plans/ui-localization-strategy.md`; `docs/plans/decision-registry-v1.md`; `docs/plans/active-next-actions.md` | triage: choose active-strategy assertion or a named historical-provenance exception |
| `scripts/db-health-migration-evidence-contract.test.mjs` | DB/migration plan and debt | `docs/plans/active-next-actions.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/excel-import-runbook-contract.test.mjs` | import operator runbook | `docs/domains/import-master-data.md`; `docs/plans/pilot-readiness-gate-v1.md` | safe |
| `scripts/import-upload-authorization-decision-contract.test.mjs` | upload authorization decision | `docs/plans/import-upload-authorization-decision-v1.md`; `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md`; `docs/evidence/readiness/2026-05-22-production-evidence-blockers-v2.md` | rewrite archive-only assertion against primary sources |
| `scripts/internal-change-visibility-contract.test.mjs` | docs/evidence discovery | `docs/README.md`; `docs/evidence/README.md`; `docs/plans/p2-product-intelligence-execution-v1.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/live-evidence-proof-pass-contract.test.mjs` | dated staging proof | `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md`; `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md` | rewrite dated proof assertions against the evidence itself |
| `scripts/master-data-bootstrap-pilot-smoke-runbook-contract.test.mjs` | master-data pilot runbook | `docs/domains/import-master-data.md`; `docs/plans/pilot-readiness-gate-v1.md` | safe |
| `scripts/migration-fresh-db-smoke-contract.test.mjs` | fresh-DB recovery preflight | `docs/plans/controlled-pilot-recovery-posture-v1.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/mobile-api-bff-inventory-contract.test.mjs` | parked mobile architecture | `docs/plans/mobile-app-discovery-v1.md` needs an explicit inventory link; otherwise `docs/plans/project-debt-ledger.md` only for accounting | triage before migration |
| `scripts/monthly-ranking-score-source-contract.test.mjs` | reporting/KPI score source | `docs/domains/reporting-kpi.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/norm-kadro-workforce-planning-contract.test.mjs` | read-only workforce decision | `docs/plans/project-growth-execution-roadmap-v1.md`; `docs/plans/feature-backlog.md`; `docs/plans/decision-registry-v1.md` | safe |
| `scripts/operator-evidence-consistency-contract.test.mjs` | import/master-data operator language | `docs/domains/import-master-data.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/pilot-evidence-preflight-contract.test.mjs` | pilot external-evidence No-Go | `docs/plans/pilot-readiness-gate-v1.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/pilot-readiness-consolidation-contract.test.mjs` | conditional-Go consolidation | `docs/plans/pilot-readiness-gate-v1.md`; `docs/plans/controlled-pilot-operating-checklist-v1.md` | safe |
| `scripts/pilot-readiness-gate-contract.test.mjs` | pilot gate policy | `docs/plans/pilot-readiness-gate-v1.md`; `docs/plans/active-next-actions.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/production-evidence-blockers-v2-contract.test.mjs` | production evidence blockers | `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/production-ops-closure-decision-packet-contract.test.mjs` | owner acceptance and broad-production No-Go | `docs/domains/readiness-ops.md`; `docs/plans/decision-registry-v1.md`; `docs/plans/runbook-registry-v1.md` | safe |
| `scripts/production-readiness-decision-contract.test.mjs` | readiness decision/history | `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`; `docs/plans/active-next-actions.md`; `docs/plans/project-debt-ledger.md` | triage: isolate PR #240 historical-provenance assertion or remove it |
| `scripts/project-growth-execution-roadmap-contract.test.mjs` | growth-track status | `docs/README.md`; `docs/plans/decision-registry-v1.md`; `docs/plans/project-control-board-v1.md`; `docs/plans/runbook-registry-v1.md` | safe |
| `scripts/project-health-snapshot-contract.test.mjs` | dated health snapshot | `docs/plans/active-next-actions.md`; `docs/plans/project-risk-scan-2026-04-30.md` | safe |
| `scripts/readiness-profile-reset-proof-contract.test.mjs` | profile reset and broad-smoke caveat | `docs/plans/production-evidence-closure-joint-plan-v1.md`; `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md` | safe |
| `scripts/redis-bullmq-staging-proof-contract.test.mjs` | Redis/BullMQ controlled-pilot proof | `docs/plans/redis-bullmq-controlled-pilot-runbook-v1.md`; `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/refactor-completion-inventory-contract.test.mjs` | finite refactor boundary | `docs/plans/technical-debt-resolution-roadmap-v1.md`; `docs/plans/decision-registry-v1.md` | safe |
| `scripts/rules-config-boundary-contract.test.mjs` | no-generic-rules-engine decision | `docs/plans/rules-config-boundary-decision-v1.md`; `docs/plans/technical-debt-resolution-roadmap-v1.md`; `docs/plans/project-growth-execution-roadmap-v1.md` | safe |
| `scripts/scope-auth-regression-matrix-contract.test.mjs` | read/action scope matrix | `docs/plans/scope-auth-regression-matrix-v1.md`; `docs/plans/project-debt-ledger.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/security-launch-blocker-closeout-contract.test.mjs` | browser-session security closeout | `docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md`; `docs/plans/project-control-board-v1.md`; `docs/plans/runbook-registry-v1.md`; `docs/evidence/README.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/source-agnostic-import-boundary-contract.test.mjs` | Power BI/Excel active, JSON parked | `docs/plans/source-agnostic-import-boundary-v1.md`; `docs/domains/import-master-data.md`; `docs/plans/decision-registry-v1.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/staging-auth-session-edge-evidence-contract.test.mjs` | logout/expired-token pilot evidence | `docs/plans/staging-auth-session-edge-evidence-guard-v1.md`; `docs/plans/pilot-readiness-gate-v1.md`; `docs/plans/controlled-pilot-operating-checklist-v1.md`; `docs/plans/project-debt-ledger.md`; `docs/plans/active-next-actions.md` | safe |
| `scripts/store-performance-replay-surface-spec-contract.test.mjs` | parked read-only replay spec | `docs/plans/store-performance-replay-readonly-surface-spec-v1.md`; `docs/plans/p2-product-intelligence-execution-v1.md` | safe |
| `scripts/supabase-staging-logical-restore-proof-contract.test.mjs` | logical restore evidence/caveat | `docs/plans/production-evidence-closure-joint-plan-v1.md`; `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md` | safe |
| `scripts/test-suite-hygiene-contract.test.mjs` | no-coverage-loss plan | `docs/plans/test-suite-hygiene-v1.md`; `docs/plans/active-next-actions.md`; `docs/plans/project-debt-ledger.md` | safe |
| `scripts/usage-performance-correlation-policy-contract.test.mjs` | privacy/correlation policy | `docs/plans/usage-performance-correlation-policy-v1.md`; `docs/README.md`; `docs/plans/p2-product-intelligence-execution-v1.md`; `docs/plans/active-next-actions.md` | safe |

The snapshot therefore has 35 safe on-touch migrations, two primary-source
assertion rewrites, three triage decisions, and one deliberate provenance
exception. Update this table when a listed reader is touched; do not claim the
count is permanently fixed.

## Retained Historical Boundary

The active-handoff contract continues to verify that the archive is explicitly
marked historical and linked as reconstruction context. A guard may retain a
historical reference only when it validates provenance or the archive boundary
itself. That exception must be narrow and named in its own review story.

## Next Safe Migration

When another archive-dependent guard is changed, identify its domain owner
first, replace only that dependency, run its targeted contract plus the root
script suite, and record the replacement here if it establishes a new pattern.
Do not use this register to authorize a broad archive rewrite.
