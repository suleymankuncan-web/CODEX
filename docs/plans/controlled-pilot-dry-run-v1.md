# Controlled Pilot Dry Run V1

Date: 2026-05-23

## Purpose

Run a full controlled-pilot rehearsal without adding a new product module,
changing UI behavior, changing authorization semantics, or widening rollout
scope.

The goal is to answer one practical question:

Can the current HR Axis / Store Ops system support the next internal controlled
pilot pass with the existing roles, Store Action loop, data-quality signals,
and operating evidence?

## Sokrates Decision

Claim:

- The next useful work is not another refactor or redesign. It is an end-to-end
  pilot rehearsal that proves the current system posture and names remaining
  blockers honestly.

Assumptions:

- Controlled pilot remains the target posture.
- Broad production remains `No-Go`.
- The active pilot roles are `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`,
  `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`.
- Existing live protected persona evidence is valid unless a new deploy/config
  change invalidates it.
- Secret-bearing checks can run only when secure local inputs are available.

Repo evidence:

- `docs/plans/pilot-scenario-pack-v1.md` defines the active pilot roles and
  scenario map.
- `docs/evidence/pilot-evidence-operating-matrix-v1.md` classifies local,
  public staging, protected staging, provider, blocked, and outdated evidence.
- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md` and
  `docs/evidence/system-flow/clerk-region-manager-live-evidence-2026-05-23.md`
  close the active protected persona matrix for controlled pilot.
- `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`
  keeps controlled pilot at `Conditional Go` and broad production at `No-Go`.
- Store Action V1B list/create/status/close/cancel coverage is already present
  and guarded by local tests.

Counterargument:

- A dry run can give false confidence if tokenless checks are counted as
  protected auth proof or if old evidence is treated as fresh after a deploy.

Risk:

- LOW for docs-only planning and public staging smokes.
- MEDIUM for live staging reads and local browser smokes.
- HIGH for raw tokens, DB writes, provider panel changes, restore targets, or
  any mutation used only to make evidence look green.

Door:

- Two-way-door for plan/evidence updates.
- Near-one-way-door for secret leakage, provider changes, broad rollout
  declarations, or staging data mutations.

Stop rule:

- Stop or mark blocked if a step needs raw tokens in docs/chat, a provider
  dashboard decision, direct DB mutation, production data, a failing health
  check, or a behavior change outside this plan.

## Guardrails

Do not change:

- product/business logic,
- API response shape,
- auth/permission semantics,
- DB schema or migrations,
- provider configuration,
- Redis/BullMQ behavior,
- KPI/ranking/checklist scoring,
- import lifecycle,
- global CSS or broad UI design,
- user-facing workflow semantics.

Do not record:

- raw bearer tokens,
- Clerk cookies,
- passwords,
- authorization codes,
- provider subjects,
- full JWT payloads,
- database URLs,
- Redis URLs,
- webhook URLs,
- private personal data.

## Execution Plan

1. Verify local workspace and current branch state.
2. Run public staging smokes:
   - deployed readiness,
   - alert routing,
   - backend readiness load.
3. Run local pilot gates:
   - root script contracts,
   - pilot stabilization gate,
   - Store Action targeted Playwright coverage when available through the
     existing e2e setup.
4. Reconcile protected persona evidence:
   - use current 2026-05-23 persona evidence if no new runtime deploy/config
     invalidated it,
   - rerun only if secure local token/browser inputs are available,
   - otherwise name the rerun as blocked, not failed.
5. Review Store Action dry-run posture:
   - list/create/status/close/cancel coverage,
   - assigned-store action-scope proof,
   - report-viewer read-only visibility,
   - store-personnel command absence.
6. Review data freshness and operations signals:
   - import/readiness,
   - snapshot/reporting,
   - Redis/queue,
   - alert routing,
   - backend health.
7. Run a project-wide bug-hunt scan focused on pilot blockers.
8. Record the outcome as `Go`, `Conditional Go`, `Pause`, or `No-Go` for the
   controlled pilot; keep broad production separate.

## Verification Ladder

Minimum:

- `git diff --check`
- `npm.cmd run test:scripts`

Public staging:

- `npm.cmd run smoke:deployed-readiness`
- `npm.cmd run smoke:alert-routing`
- `npm.cmd run smoke:backend-readiness-load`

Local pilot:

- `npm.cmd run check:pilot-stabilization`

Frontend/Store Action, if changed or if the e2e setup is available:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts`

Protected staging:

- Rerun protected persona/token smoke only with secure local tokens or browser
  sessions. Skipped protected checks are not failures, but they are not new
  proof.

## Done Criteria

- Public staging status is refreshed.
- Local pilot gates are refreshed or blockers are named.
- Protected persona evidence posture is reconciled.
- Store Action and data-quality pilot risks are named.
- Any discovered low-risk bug is either fixed with tests or parked with a
  decision note.
- The final evidence note states the controlled-pilot decision and broad
  production decision separately.
