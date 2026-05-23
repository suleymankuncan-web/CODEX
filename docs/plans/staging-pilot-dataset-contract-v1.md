# Staging Pilot Dataset Contract V1

Date: 2026-05-23

## Purpose

Define the minimum staging data shape needed to prove controlled pilot
reliability without adding a DB seed, migration, or fake demo dataset in this
slice.

## Sokrates Decision

Claim: protected pilot evidence is only meaningful if staging has known assigned
and unassigned entities for each persona.

Assumption: the existing application can prove the pilot loop with a small,
stable dataset; it does not need a broad synthetic enterprise dataset yet.

Evidence:

- Store Action V1B now depends on assigned-store scoping.
- Auth/session comes from Clerk, but role/scope/action-store assignments come
  from application DB records.
- Import, snapshot, workflow, KPI, and reporting screens already expose read
  models that need freshness/source context.

Counterargument: a manually maintained staging dataset can drift. That is true,
so this contract must be checked before pilot evidence runs.

Risk: LOW as docs-only. MEDIUM/HIGH when data is created or modified in
staging.

Door: two-way-door for the contract. One-way-ish for destructive staging edits
or records that look like production data.

Stop rule: do not create seed scripts, migrations, or bulk DB mutations from
this contract without a separate implementation decision and rollback plan.

Verification ladder:

1. Confirm the required entities exist.
2. Confirm role/scope/action-store assignments are tied to the intended
   personas.
3. Confirm read models have at least one current positive row and one controlled
   empty/negative case.
4. Confirm Store Action assigned and unassigned store cases.
5. Only then run protected persona evidence.

## Minimum Entities

| Entity | Minimum Shape | Why Needed |
| --- | --- | --- |
| Company | One active pilot company. | Anchors regions, stores, users, imports, snapshots, and reporting. |
| Region | One active region under the pilot company. | Proves region manager/reporting filters later without inventing data. |
| Stores | At least two active stores: one assigned to the store manager, one unassigned negative-control store. | Required for positive and negative assigned-store action proof. |
| Users | Six Clerk-linked active pilot personas: `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, `STORE_PERSONNEL`, `REPORT_VIEWER`. | Required for route/backend role evidence. |
| Employees | At least one employee/personnel record tied to the assigned store. | Required for store/personnel surfaces and workforce references. |
| Role assignments | Application DB role records for each persona. | Clerk identity alone is not authorization. |
| Scope assignments | Store/company/region/action-store scopes matching the matrix. | Required for fail-closed checks. |
| KPI baseline | One current KPI row for the assigned store and one controlled exception/candidate. | Required for Store Action candidate and reporting freshness. |
| Store Action plan | One persisted action plan for the assigned store and one no-data/empty state case. | Required for Store Tasks visibility and lifecycle evidence. |
| Import batch | One successful or partially successful import batch with timestamps and source metadata. | Required for import/data-quality evidence. |
| Snapshot run | One recent snapshot run with materialization metadata. | Required for reporting freshness proof. |
| Workflow item | One workflow inbox item tied to a known source. | Required for workflow and Store Action relation evidence. |

## Required Positive And Negative Cases

| Area | Positive Case | Negative Case |
| --- | --- | --- |
| Store shell | Store manager can open assigned store surfaces. | Store personnel cannot open admin shell. |
| Store Action read | Store manager sees assigned store action plans. | Store manager does not see unassigned store action plans. |
| Store Action command | Store manager can create/update/close/cancel only assigned-store plans when command evidence is scoped. | Same persona gets forbidden/blocked for unassigned store command. |
| Reporting read | Report viewer can open reporting read surfaces. | Report viewer cannot perform auth/admin or Store Action commands. |
| Admin read | HR admin can open scoped admin operational surfaces. | HR admin cannot use super-admin-only auth mutation surfaces. |
| Import/readiness | Super admin can inspect integration/readiness evidence. | Non-admin store personas cannot reach integration admin route. |

## Data Freshness Expectations

- KPI, import, and snapshot rows should have timestamps close enough to the
  current pilot window to avoid stale-proof confusion.
- If a row is intentionally old, the evidence must label it as stale data.
- Snapshot and import source metadata should identify the run/batch without
  leaking private uploaded file contents.
- Store Action plans should include at least one active state and one terminal
  state when lifecycle evidence is being tested.

## Out Of Scope

- New DB migrations.
- New seed scripts.
- Automatic Store Action generation from all data sources.
- New auth roles.
- Production data copies.
- Bulk restore into staging without explicit approval.

## Dataset Readiness Checklist

- [ ] Pilot company exists.
- [ ] Pilot region exists.
- [ ] Assigned and unassigned stores exist.
- [ ] Five required personas exist in Clerk and application DB.
- [ ] Role assignments match the persona matrix.
- [ ] Scope/action-store assignments match the intended positive and negative
      cases.
- [ ] KPI baseline and exception/candidate exist.
- [ ] Store Action plan read/lifecycle rows exist for assigned-store proof.
- [ ] Import batch and snapshot run are fresh enough or explicitly marked stale.
- [ ] Workflow item exists for inbox/read relation proof.
- [ ] No private raw data, tokens, or provider identifiers are copied into docs.
