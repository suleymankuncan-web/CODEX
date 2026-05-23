# Rules / Config Versioning Inventory V1

Status: active evidence
Shelf: evidence
Last verified: 2026-05-23

## Reader And Action

Reader:

- A future engineer deciding whether a rule/config change needs a domain-owned
  edit, a read-only governance surface, or a new shared rules/config boundary.

After reading, they should know the current source of truth, version/audit
posture, first safe read-only surface, and parked risks for the active
rule/config families.

## Sokrates Decision

Decision:

- Do not add a generic rules engine, shared config schema, DB migration, or new
  workflow engine for Track 6.
- Treat KPI config as the first proven read-only governance/diff/audit surface.
- Keep every other family domain-owned until it proves independent versioning,
  audit, simulation, approval/publish, rollback, or cross-module reuse need.

Evidence:

- `docs/plans/rules-config-boundary-decision-v1.md` already rejects a generic
  rules engine and records domain ownership.
- `/admin/kpi-config` already shows draft/live diff counts, latest published
  version metadata, snapshot anchoring copy, and audit trail rows.
- `admin-web/e2e/admin-kpi-config.spec.ts` covers the KPI governance preview
  and edit/save behavior without changing scoring semantics.
- Store Action source decisions keep KPI exception follow-up, checklist
  acknowledgements, target approval, and future sources separate.

Counterargument:

- A central rules/config layer may eventually be useful. It is still premature:
  most families either have a domain owner already or are intentionally
  parked. Centralizing now would hide unresolved product policy behind a
  powerful abstraction.

Risk:

- LOW for this docs/guard inventory.
- HIGH if misread as approval to create dynamic config, shared mutable rules,
  scoring changes, or approval workflow changes.

Door:

- This inventory is a two-way-door documentation slice.
- A shared rules/config engine would be near one-way-door and requires a
  separate owner decision.

Stop rule:

- Stop if the next implementation cannot name source of truth, owner,
  version/audit need, rollback, and tests before code starts.

## Domain Inventory

| Rule / Config Family | Current Owner | Version / Audit Posture | First Read-Only Surface | Parked / Not Now |
| --- | --- | --- | --- | --- |
| KPI thresholds, score profiles, grading bands | Reporting/KPI config domain, surfaced by `/admin/kpi-config`. | Published version metadata, draft/live diff preview, audit trail, and snapshot anchoring are already visible. | Existing `KpiConfigGovernancePreviewPanel` and `KpiConfigAuditPanel`. | No generic scoring DSL, silent historical reinterpretation, or scoring math change. Rollback UI and future effective scheduling require a new decision. |
| Checklist weights and item scoring | Checklist template/version domain. | Template versioning and effective dates exist; checklist score blending remains domain-owned. | Existing checklist template builder and checklist result read surfaces; no cross-domain governance panel yet. | No global weight engine, automatic redistribution, or cross-module score blending change without a separate decision. |
| Target approval and target references | Target distribution workflow plus assigned-store action scope. | Target requests and approved references are workflow/audit objects; approval rules stay source-owned. | Existing admin/store target request and coverage/readiness surfaces. | No multi-step approval engine, delegated chain engine, or target scoring behavior change. |
| Competitions and stage/package rules | Competition service/repository and package-plan approval lifecycle. | Stage/package/team rules and stage-package-plan audit are competition-owned. | Existing competition dashboards, stage/package plan read/audit surfaces. | No shared stage-progression rules table or recalculation engine. |
| Store Action candidates and lifecycle | Store Action domain, sourced from approved source decisions such as KPI exceptions. | Persisted plans own lifecycle/audit; candidate generation remains source-bounded. | Existing `/store/tasks` action-plan list/detail/status/close/cancel surfaces. | No generic workflow engine, non-KPI source ingestion, auto action generation, comments, escalation, or notifications without a new go/no-go decision. |
| Incentives / prim | Intake/spec only. | No payout formula/version/audit lifecycle is approved. | Existing honest `/store/incentives` placeholder/intake surface. | No incentive engine, payout schema, payout API, or payroll-facing behavior from assumptions. |
| Workflow inbox routing | Source workflows plus shared inbox language. | Inbox maps source status into queue language; source workflows keep state machines. | Existing admin/store inbox and operations workflow pressure surfaces. | No central workflow engine or notification service. |
| Runtime/provider configuration | Environment variables, backend config service, provider dashboards/runbooks. | Runtime config is operational configuration, not business-editable rules. | Existing health/readiness/runbook evidence, not an app config editor. | No DB-backed runtime config editor or provider setting mutation from the app. |

## Current First Surface

Track 6's first code/product surface is already present and should not be
duplicated:

- `/admin/kpi-config` shows the draft vs live publishing model.
- The governance preview summarizes added, changed, and removed rows for store
  profile, personnel profile, ownership matrix, and grading bands.
- Latest published version and published-at metadata are shown when available.
- The audit panel shows saved/published config changes with diff metadata.
- Snapshot anchoring is explained as active for new runs while
  pre-governance snapshots remain readable.

This means the next Track 6 code slice should not start by adding a second
surface. It should start only when a new rule family proves a missing
read-only governance need.

## Next Safe Slice When Needed

If Track 6 needs code later, the next safe slice is one of:

- Extend the existing KPI config governance preview with one more read-only
  explanation that does not change scoring or publish behavior.
- Add a docs/test guard for checklist template version ownership if checklist
  scoring or template governance is touched by a real product slice.
- Add a Store Action source-decision guard before introducing any non-KPI
  candidate source.

Do not combine any of these with DB schema, auth, API response shape,
reporting math, approval semantics, or workflow state-machine changes.

## Verification

Local verification for this inventory should be:

```powershell
git diff --check
npm.cmd run test:scripts
```

If a future slice touches `/admin/kpi-config`, add:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-kpi-config.spec.ts
```

