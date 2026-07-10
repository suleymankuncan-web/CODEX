# Current State - Active Handoff

Status: active
Shelf: operating
Use when: resuming work, checking current posture, or choosing the next safe action
Do not use when: reconstructing PR history, selecting a branch, or replacing live verification
Last verified: 2026-07-10

This is the canonical short handoff for the HR Axis / Store Ops workspace. A
cold reader should recover the current decision, external blockers, and next
safe action in under five minutes.

Historical detail is separate:

- former long handoff through PR #913:
  `docs/history/current-state-through-pr-913-2026-07-09.md`;
- operating-truth and plan-execution transition record:
  `docs/history/operating-truth-alignment-plan-execution-2026-07-10.md`.

## Authority And Freshness

Use the freshest verifiable source in this order:

1. The user's newest instruction.
2. Live GitHub, provider, runtime, current branch, and worktree evidence.
3. This handoff and active control documents.
4. Historical plans, evidence, and archives.

Do not infer current merge state, branch ownership, provider status, or pilot
results from a prior SHA or a historical PR note. Verify `origin/main`, the
PR head, required checks, mergeability, and relevant provider/runtime evidence
when the decision needs them.

## Current Product Position

- Controlled staging/internal pilot: `Conditional Go / Continue`.
- Controlled pilot or patron-demo rehearsal: the active product signal source.
- Broad production rollout: `No-Go`.
- Separate mobile app: discovery/planning only; implementation is not active.
- New modules, broad redesign, generic architecture/refactor, and provider/JSON
  integration remain parked unless a real trigger and owner decision reopen one.
- Power BI/Excel remains the current operating data path; JSON integration is
  suspended pending a real provider contract and reconciliation plan.
- Runtime work remains parked unless a factual P0/P1 pilot or demo finding has
  one scoped specification, verification path, and rollback story.

## Current Plan Execution Truth

The owner approved autonomous execution of
`docs/plans/project-analysis-implementation-plan-v1.md` on 2026-07-10. That
approval did not authorize speculative runtime work or broad production.

- PR #917 (A1) made `required-release-gate` the truthful required main-branch
  aggregate and verified the ruleset readback.
- PR #918 (A2) made root release the one canonical full frontend-release owner;
  the frontend child is targeted and reusable, not a duplicate full suite.
- PR #919 (A3) kept all 371 Playwright tests, uses two CI-only workers with
  serial files, and preserves failure-only Playwright artifacts.
- PR #920 (B1) records all five current pilot flows as `blocked_external`; no
  flow was claimed as run and no runtime change was authorized.
- PR #921 (E1) reconciles Visual Merchandiser-only Store routes and starts an
  incremental archive-guard migration register without a bulk archive rewrite.
- PR-D1 adds one bounded Vitest seed for Store My Performance state and Region
  Manager incentive money/correction logic through the existing frontend and
  root release paths. It removes no E2E coverage and does not begin a
  whole-suite migration.

The historical transition record carries PR narrative and proof links. This
section intentionally retains only the current operating consequences.

## Active Evidence Gates

### A3 Release Measurement

PR #919 has two green live proofs: the implementation head and the final
documented head each ran all 371 tests with two workers, while the required
aggregate, targeted frontend child, rehearsal, and Vercel passed. Neither is a
ten-run p95 claim.

The next ten successful root-release PR runs must be measured before claiming
NFR-3. Record a dated p95 outcome at or below 12 minutes, or record the
measured blocker and a no-further-concurrency-change decision without reducing
coverage. Source:
`docs/evidence/performance/2026-07-10-e2e-worker-concurrency-a3.md`.

### B1 Controlled Pilot Evidence

The next fresh pilot work is blocked on safe, approved external inputs:

- current approved authenticated browser sessions for Admin, Region Manager,
  Store Manager, and Store Personnel, with only sanitized evidence retained;
- an assigned store plus explicit mutation/rollback authority for Store Action;
- a current checklist template/visit and completion/acknowledgement authority;
- approved read-only persona sessions and a personnel/profile test subject;
- a confirmed reporting period, package, and role-scoped sessions.

Use `docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md`.
Do not create a runtime PR merely to resolve an absent session, approval, or
test-data input.

## Operating Boundaries

- Preserve business logic, API shape, auth/permission semantics, DB schema,
  scoring/ranking/checklist weights, queue/import behavior, and user workflow
  unless the user explicitly scopes a change.
- Read scope and action scope remain separate; assigned-store action scope
  continues to apply even when an endpoint role requirement is satisfied.
- Store personnel is self-scoped; Store Managers are own/managed-store scoped;
  Region Managers are assigned-region/store scoped.
- Do not invent metrics, rankings, coaching, checklist, target, payout, trend,
  or product copy to make a surface look complete.
- Local checks do not close provider, token, restore, queue, alert, or broad
  production evidence. Never record raw credentials or private user data.

## Review, Release, And Merge Policy

- Local adversarial review, scope-appropriate verification, required GitHub
  checks, deployment checks when applicable, and clean mergeability are
  mandatory.
- GitHub Codex review is disabled by explicit owner direction as of 2026-07-10.
  Do not trigger `@codex review`, request it through another integration, or
  wait for bot reactions/comments.
- GitHub Codex review becomes active again only after a newer explicit owner
  instruction. The other verification requirements remain mandatory.
- When polling is needed, use the canonical 30-second GitHub status loop from
  `discipline.md`; poll required checks, deployment state, and mergeability
  together, then stop once decision evidence is complete.
- Main protection requires the `required-release-gate` aggregate. Its child
  selection is fail-closed; do not replace it with an advisory local selector.

## Workspace Hygiene

The no-delete inventory is
`docs/plans/workspace-hygiene-inventory-2026-07-09.md`.

- Do not delete, drop, apply, move, reset, or rewrite any classified branch,
  worktree, stash, or remote ref without a separately verified owner-approved
  list.
- Squash-merge ancestry alone is not cleanup evidence.
- Known local generated outputs and visual-test artifacts stay excluded unless
  their owning task explicitly includes them.
- Repo Hygiene Guard V1 protects tracked generated folders and local secret
  files. `node_modules`, `dist`, `test-results`, `coverage`, `tmp`, and
  `outputs/` remain ignored local artifacts and do not belong in a PR.

## Now, Next, Park, Stop

Now:

- Keep the truthful release gate and targeted frontend boundary stable.
- Observe A3's next ten successful root-release PR runs; record the dated p95
  decision only after the sample exists.
- Preserve B1's `blocked_external` state until approved pilot inputs exist.

Next:

1. Obtain one safe B1 input bundle and execute only the authorized flow(s).
2. If evidence produces a P0/P1 finding, create one finding-specific spec and
   PR with reproduction, scope, verification, and rollback.
3. If no P0/P1 exists, keep runtime parked and make no speculative code train.
4. Update this handoff only when a current decision, proof state, or next safe
   action materially changes.

Park:

- Separate mobile implementation, new modules, broad production, broad
  redesign, and generic architecture/refactor work.
- Provider/Nebim/JSON implementation without a real source contract and owner
  decision.
- Further frontend unit-test migration or bundle work without its named
  conditional trigger.

Stop:

- A proposed docs/process change crosses into runtime behavior, auth, API, DB,
  scoring, queue, provider, or workflow semantics without explicit scope.
- A pilot action lacks safe session/data/mutation/rollback authority.
- Required checks fail, mergeability is not clean, or the final diff tells more
  than one operating story.
- Cleanup classification is uncertain or an item is dirty/unknown.

## Verification And Control References

For docs/process work, begin with:

```powershell
git diff --check
npm.cmd run test:scripts
npm.cmd run check:affected-verification
```

Documentation Library entry point: `docs/README.md`.

Current control references:

- Project mode and go/no-go board:
  `docs/plans/project-control-board-v1.md`.
- Active decisions: `docs/plans/decision-registry-v1.md`.
- Repeatable runbooks: `docs/plans/runbook-registry-v1.md`.
- Owner-approved, evidence-gated implementation plan:
  `docs/plans/project-analysis-implementation-plan-v1.md`.
- Current practical actions: `docs/plans/active-next-actions.md`.
- Canonical debt counts: `docs/plans/project-debt-ledger.md`.
- Incremental historical-guard ownership:
  `docs/plans/archive-guard-migration-register-v1.md`.
- Controlled pilot blocker record:
  `docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md`.

Debt ledger snapshot remains canonical in `docs/plans/project-debt-ledger.md`:

- Closed active debts: 95
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

Project Debt Ledger Consistency Guard V1 keeps these handoff counts aligned
with the canonical ledger. The ledger, not this handoff, owns the full count
set and closeout rationale.
