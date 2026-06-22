# Controlled Pilot Preflight Checklist V1

Status: active
Shelf: pilot
Last verified: 2026-06-22

## Reader And Action

Reader:

- owner preparing the next HR Axis controlled pilot session,
- pilot moderator checking whether a scoped session can start,
- future agent deciding what is parked and what must be verified before touching code.

After reading, the operator should be able to answer:

- can the next controlled pilot session start,
- which parked items must stay parked,
- which data, persona, route, and deploy checks are mandatory,
- which issue is a blocker, conditional-go item, or backlog item.

This checklist does not approve broad production rollout. It is only for the
controlled staging/internal pilot.

## Current Boundary

Controlled pilot mode remains the active path.

Allowed:

- use the current Excel/Power BI import path,
- use pilot persona accounts and app DB role/scope assignments,
- test scoped staging flows with sanitized evidence,
- fix concrete P0/P1 pilot blockers with small PRs,
- batch same-surface P2 friction only when the risk and verification story match.

Parked for now:

- Nebim integration and live Nebim source adapter work,
- JSON/API source adapter work,
- broad production rollout,
- broad UI redesign workstreams not tied to a specific pilot blocker,
- new modules or V2 product ideas without feature intake,
- cashier incentive formula,
- mutable workforce/turnover source-of-truth work until real source data exists.

Not allowed:

- direct Supabase client access to `ops.*`,
- manual live `ops.*` edits to make evidence look clean,
- widening pilot scope to public or broad production,
- changing score math, incentive formula, auth, or role/scope semantics without a
  separate decision,
- recording raw tokens, cookies, passwords, provider subjects, full JWTs,
  database secrets, national-id values, or private user data in evidence.

## How To Use This Checklist

Run this checklist:

- before the first pilot day,
- before a new pilot invite wave,
- after any backend, frontend, migration, auth, scope, or import change,
- after a provider deploy if the target pilot flow depends on that provider,
- before declaring that a pilot blocker is closed.

Use these outcomes:

| Outcome | Meaning | Next action |
| --- | --- | --- |
| Ready | Evidence is fresh enough for the scoped pilot session. | Start or continue the session and log feedback. |
| Conditional Go | Known gap exists but does not affect the target session. | Start only the scoped flow and record the condition. |
| No-Go | A target flow, auth boundary, deploy, or data path is unsafe or unclear. | Pause pilot and fix the blocker first. |
| Parked | Item is intentionally not active. | Do not start implementation until the trigger exists. |

## 1. Decision Boundary

- [ ] Controlled staging/internal pilot is still the target.
- [ ] Broad production remains `No-Go`.
- [ ] Nebim integration is not part of the current work.
- [ ] JSON/API source adapter work remains parked.
- [ ] No new module or V2 flow is being smuggled into the pilot.
- [ ] The target pilot persona, route, and workflow are named before testing.
- [ ] The latest merged commit or deployed version is known.

No-Go if any boundary is unclear.

## 2. Release And Deploy Hygiene

- [ ] Main branch is aligned with the latest merged PRs.
- [ ] Local worktree used for the check is clean or unrelated changes are
  explicitly ignored.
- [ ] Required checks for the latest relevant PR passed.
- [ ] Frontend deploy is live after frontend changes.
- [ ] Backend deploy is live after backend/API/import/migration changes.
- [ ] Migration checks do not show checksum mismatch.
- [ ] OpenAPI/types checks were rerun after API shape changes.
- [ ] No timer polling, 30-second route refresh, or full-page refresh was added.

No-Go if staging is running an older backend for a backend-dependent pilot flow.

## 3. Persona, Auth, And Scope

- [ ] Admin pilot account can sign in and reach admin support surfaces.
- [ ] Region manager pilot account can sign in and sees only assigned
  region/store scope.
- [ ] Store manager pilot account can sign in and sees only assigned store
  operational scope.
- [ ] Store personnel pilot account can sign in and sees only own allowed
  personnel surface.
- [ ] Refresh keeps the user in the protected shell without visible login
  fallback.
- [ ] Role/scope changes have fresh evidence; old evidence is not reused after
  assignment edits.
- [ ] One low-role privacy check proves no global detail leak.

No-Go if any user can see or act outside assigned scope.

## 4. Data And Import Readiness

- [ ] Power BI/Excel remains the active pilot import path.
- [ ] GSM approval upload path is visible to the expected admin/operator role.
- [ ] Latest intended KPI/import file can be parsed or a known import limitation
  is recorded.
- [ ] Failed or unmatched import rows are understood and do not block the target
  pilot flow.
- [ ] Imported historical targets can satisfy historical calculation/readiness
  where the pilot depends on prior months.
- [ ] Store/personnel identity mismatches are classified as known data quality,
  not hidden product correctness.
- [ ] Import retry/re-upload behavior is understood before asking pilot users to
  rely on the data.
- [ ] No fake store/personnel rows are added to make the pilot look complete.

Conditional Go is acceptable only when the missing data is outside the target
workflow being tested.

## 5. Store Surface Walkthrough

Check the target persona first, then one adjacent persona if the workflow
crosses roles.

- [ ] `/store` home opens with useful summary data and no debug/internal copy.
- [ ] `/store/rankings` fits store names and KPI columns; GSM, BM, and VM
  headers do not overflow; no unused action flow appears.
- [ ] `/store/kpis` shows store and region KPI values, including GSM where
  expected.
- [ ] `/store/checklists` supports the expected visit/checklist flow; cancelled
  or incomplete drafts do not mark visit date or completion.
- [ ] Checklist result/detail surfaces are readable and do not block primary
  actions.
- [ ] `/store/targets` reconciles metrics with visible approved, pending, or
  missing target state for the selected period.
- [ ] `/store/incentives` shows only company-store incentive surfaces; bayi and
  isletme stores see no incentive UI.
- [ ] Incentives show historical sales/targets when imported data exists for
  prior periods.
- [ ] Region manager incentive review allows store check and personnel
  correction only when the period is closed/finalized as designed.
- [ ] `/store/workforce` fits the store list on the target device; status is
  understandable as missing, complete, or over norm.
- [ ] Store request/task/approval/report/settings routes do not blank, 500, or
  show obsolete internal copy.

No-Go if the target route cannot be operated by the target persona.

## 6. Admin And Operator Walkthrough

- [ ] `/admin/integrations` shows the active upload/import route.
- [ ] Import batch detail explains blocked, failed, retryable, and completed
  states without requiring DB access.
- [ ] `/admin/master-data` shows region/store/personnel assignment state clearly.
- [ ] Pilot region manager accounts exist and are connected to assigned stores.
- [ ] `/admin/targets` reflects approved, pending, and missing target state for
  the selected period.
- [ ] `/admin/incentives` shows package state and region manager corrections
  after submission.
- [ ] Admin can distinguish system-calculated values from manual corrections.
- [ ] Admin support route, data quality route, or equivalent support surface is
  ready for triage if the pilot gets stuck.

No-Go if the operator cannot explain or recover the target pilot issue without
unsafe database edits.

## 7. Parked Items Register

Keep these out of the pilot execution loop unless their trigger happens.

| Parked item | Why parked | Unpark trigger |
| --- | --- | --- |
| Nebim integration | Source details, access model, field mapping, cadence, and identity semantics are not locked. | Real Nebim access contract, sample payload, field list, cadence, auth model, and reconciliation plan. |
| JSON/API source adapter | Excel/Power BI is the active pilot source. | Official provider contract and source-agnostic import plan. |
| Broad production rollout | Provider, Redis, recovery, incident, and owner acceptance requirements remain outside controlled pilot. | Production owner accepts or proves the remaining production posture. |
| Broad UI redesign | Pilot needs concrete blocker fixes, not generic redesign churn. | User starts a scoped page/surface redesign track. |
| New modules and V2 ideas | They need feature intake and source-of-truth decisions. | Feature intake names user, scope, source, write boundary, rollback, and verification. |
| Cashier incentive formula | Business rule is not supplied. | Owner provides formula, visibility, and test examples. |
| Workforce turnover source | Historical ayrilik/turnover source is not available yet. | Real source data and ownership decision exist. |

## 8. Pilot Feedback Intake

For each pilot finding, record:

- date,
- persona,
- route or workflow,
- period/store if relevant,
- observed behavior,
- expected behavior,
- severity: `P0 stop`, `P1 pilot blocker`, `P2 pilot friction`, or `P3 backlog`,
- decision impact: `continue`, `conditional`, `pause`, or `rollback`,
- sanitized screenshot or evidence reference if available,
- owner and next action.

Classification:

- `P0 stop`: privacy leak, wrong scope/action, unsafe auth, or target workflow
  cannot proceed.
- `P1 pilot blocker`: target persona cannot complete a required pilot workflow.
- `P2 pilot friction`: confusing, slow, or ugly enough to hurt pilot quality but
  not enough to stop the target workflow.
- `P3 backlog`: useful improvement outside the current pilot session.

## 9. Go / Conditional Go / No-Go

Ready:

- target persona can sign in,
- target route works on staging,
- data needed for the target flow is present or explicitly not required,
- latest backend/frontend deploys match the tested commit,
- no P0/P1 issue is open for the target session.

Conditional Go:

- a known data gap exists but the target flow does not depend on it,
- UI friction is P2 and the operator can still complete the workflow,
- failed import rows are known identity-mapping gaps and do not block the target
  evidence.

No-Go:

- auth or scope is wrong,
- target route 500s, blanks, or loops to login,
- backend/frontend deploy mismatch blocks the target flow,
- migration checksum or release gate is red,
- import failure blocks the target period or flow,
- incentive/target/checklist math changes without a locked rule,
- unsafe manual database edits would be needed to continue.

## 10. First Pilot Day Quick Path

1. Open the control board and confirm controlled pilot mode.
2. Confirm Nebim and JSON source work are still parked.
3. Confirm latest frontend and backend deploys.
4. Log in as admin, region manager, store manager, and store personnel.
5. Walk the target store surfaces for the selected pilot period.
6. Walk the admin/operator support surfaces for the same period.
7. Record known data gaps before the session starts.
8. Start the session only if the target flow is Ready or explicitly
   Conditional Go.
9. Record feedback in the controlled pilot feedback log.
10. Fix P0/P1 findings before expanding the pilot path.
