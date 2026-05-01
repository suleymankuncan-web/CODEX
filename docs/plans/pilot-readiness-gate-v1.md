# Pilot Readiness Gate V1

## Metadata

- Status: V1 pilot readiness gate.
- Owner: HR/Admin product owner with backend/data support.
- Last updated: 2026-05-01.
- Purpose: Decide whether the app can enter a limited pilot without confusing local technical readiness with real-world pilot evidence.

Pilot is not approved until the required external evidence is recorded.

## Current Truth

The local foundation is healthy enough to continue hardening:

- root release gate exists,
- backend tests, frontend Playwright tests, build, and audit pass,
- migration tracking and fresh DB smoke exist,
- auth/scope guards exist,
- import, master-data staging, scoring, checklist, and target reference foundations exist,
- debt ledger and repo hygiene are guarded.

This does not mean the pilot is approved. It means the codebase is controlled enough to prepare for pilot evidence.

## Required Evidence Before Pilot

### 1. real staging IdP evidence

Required source:

- `docs/plans/phase-7-staging-auth-smoke-runbook.md`
- `docs/plans/phase-7-auth-evidence-template.md`

Required proof:

- staging frontend URL is known,
- staging API URL is known,
- staging IdP issuer and JWKS URL are known,
- backend uses JWKS verification,
- smoke user can log in through staging IdP,
- expected role and read scope are returned,
- assigned-store action succeeds,
- unassigned-store action returns `403`,
- logout and expired-token behavior are proven,
- evidence is sanitized and contains no raw token, code, verifier, secret, cookie, or session dump.

### 2. true store/personnel baseline evidence

Required source:

- `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`

Required proof:

- baseline file is true master data, not KPI snapshot data,
- pilot scope is small and explicit,
- official store codes exist,
- official seller/employee codes exist,
- staged rows validate cleanly or have reviewed blockers,
- promotion dry-run evidence is reviewed,
- only approved pilot scope is promoted,
- sanitized evidence is recorded.

### 3. real KPI import smoke evidence

Required source:

- `docs/plans/excel-kpi-import-operator-runbook.md`
- `docs/plans/import-decision-evidence-v1.md`

Required proof:

- pilot KPI file period is known,
- active store scope is known,
- import summary is reviewed,
- data quality summary is reviewed,
- reconciliation is reviewed,
- Go / Conditional Go / No-Go decision is recorded,
- KPI rows are not used as master-data baseline,
- sanitized evidence is recorded.

### 4. pilot user and scope evidence

Required proof:

- HR/Admin pilot operator exists,
- at least one region manager or visual merchandiser pilot user exists if their flow is included,
- at least one store manager pilot user exists,
- pilot users are linked to provider subjects,
- role assignments are scoped to the approved pilot stores or regions,
- action-store assignments are scoped to the approved pilot stores,
- user/store search can find the pilot users and stores in `/admin/auth`,
- negative scope behavior is tested before pilot expansion.

### 5. release and migration evidence

Required proof:

- `npm.cmd run check:release` passes on the pilot commit,
- `npm.cmd run smoke:migration:fresh-db` passes or a written Conditional Go exists if DB schema or migration files changed,
- no tracked generated output or local `.env` file exists,
- current commit hash is recorded in the pilot evidence note.

## Go

Pilot can start only when:

- staging auth evidence is complete,
- true baseline master-data evidence is complete for the pilot scope,
- real KPI import smoke evidence is complete for the pilot scope,
- pilot user and scope evidence is complete,
- release and migration evidence is complete,
- evidence is sanitized,
- known limitations are written down.

## Conditional Go

Pilot can start with restrictions only when:

- all security/auth P0 evidence is complete,
- all data that will be shown to users has clean or reviewed evidence,
- any missing item is outside the pilot path,
- limitation owner and follow-up date are recorded,
- HR/Admin explicitly accepts the restriction.

Examples:

- VM pilot user is not included yet, so VM checklist flow is excluded from the pilot.
- JSON source details are still unavailable, so pilot uses manual Excel import only.
- real production visual design pass is not done, so pilot is operational validation only.

## No-Go

No-Go if staging auth evidence is missing.

No-Go if true baseline master data is missing.

No-Go if KPI import smoke has not produced sanitized evidence.

No-Go if any raw token, password, cookie, TC/national id, or private data appears in evidence.

No-Go if pilot users have wider scope than the approved pilot stores or regions.

No-Go if import data is used to silently create unreviewed live stores or personnel.

No-Go if `npm.cmd run check:release` fails.

No-Go if the operator cannot explain which data is real, staged, promoted, imported, or derived.

## Non-Goals

Do not open production rollout from this gate.

Do not build a JSON/source adapter without a real sample payload or official field list.

Do not redesign UI as part of pilot readiness.

Do not change score math to pass pilot.

Do not manually edit live `ops.*` tables to make evidence look clean.

Do not expand the pilot scope before the first scoped pilot evidence is reviewed.

## Pilot Evidence Note Template

```text
Pilot Readiness Evidence
Date:
Environment:
Commit:
Prepared by:
Executed by:
Reviewed by:
Approved by:
Pilot scope:
Included stores:
Included users/roles:

Staging auth evidence:
Decision: Go / Conditional Go / No-Go
Evidence note:

Master data baseline evidence:
Decision: Go / Conditional Go / No-Go
Batch ids:
Known blockers:

KPI import smoke evidence:
Decision: Go / Conditional Go / No-Go
Import batch ids:
Known data quality notes:

User/scope evidence:
Decision: Go / Conditional Go / No-Go
Known limitations:

Release evidence:
check:release:
fresh DB smoke, if needed:

Final decision: Go / Conditional Go / No-Go
```

## Current Evidence Notes

- `docs/evidence/pilot-readiness/2026-05-01-preflight-no-go.md` records the first pilot preflight as `No-Go` because staging IdP values, true baseline master data, real KPI import smoke evidence, and pilot user/scope evidence are not available yet.

## CODEX DURUST YORUM

The application foundation is healthy, but pilot readiness is not a feeling.

The right move is to keep the codebase calm and force pilot approval through evidence: staging auth, true baseline data, real KPI import smoke, scoped pilot users, and release proof. This avoids two bad outcomes: delaying forever because the project feels large, or opening the pilot too early because local tests pass.

The app is strong enough to prepare for pilot. It is not automatically approved for pilot until this gate has real evidence.

## Next Logical Step

If staging IdP, true baseline files, or real pilot KPI files are available, start filling this gate with evidence.

If they are not available, do not open new product modules. Continue with small guards only when they reduce risk in an existing pilot path.
