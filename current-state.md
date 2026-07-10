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

The owner also approved autonomous execution of
`docs/plans/project-wide-audit-remediation-plan-v1.md` on 2026-07-10. Its first
slice is the authorization operating-truth contract: complete route ownership,
preview/runtime drift, and backend-endpoint drift become machine-visible before
any permission behavior changes. DG-1 still blocks authorization behavior;
DG-2, DG-3, and DG-4 still block live DB constraints, verified provider TLS,
and real external error delivery. Broad production remains `No-Go`. PR #927
completed PR-1 without runtime behavior change; its contract covers 54 routes,
33 direct matrix routes, and three preview plus three backend drifts. PR #929 completed PR-3: authorization changes now clear protected frontend cache state before a new shell renders. PR-4 bounded target queues is active; PR/release/merge evidence remains open.

- PR #917 (A1) made `required-release-gate` the truthful required main-branch
  aggregate and verified the ruleset readback.
- PR #918 (A2) made root release the one canonical full frontend-release owner;
  the frontend child is targeted and reusable, not a duplicate full suite.
- PR #919 (A3) kept all 371 Playwright tests, uses two CI-only workers with
  serial files, and preserves failure-only Playwright artifacts.
- The release path keeps one full PR release as the canonical proof. Relevant
  main pushes reuse that proof only when merged PR, base parent, latest green
  gate, completion time, and tree hash agree; every uncertain case falls back
  to the full release.
- PR #920 (B1) established the five-flow blocker record. A later owner
  attestation records successful 5 July checklist approval, Store Action task
  closure, and target submission/editing with no issue; remaining B1 evidence
  stays external and no runtime change is authorized.
- PR #921 (E1) reconciles Visual Merchandiser-only Store routes and starts an
  incremental archive-guard migration register without a bulk archive rewrite.
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

The product owner attested that checklist approval, Store Action task closure,
target submission, and target editing were used successfully on 5 July 2026.
No issue or P0/P1 finding was reported. This is partial positive evidence, not
a protected-session trace or a complete five-flow pass.

Remaining external inputs are:

- sanitized persona/session and negative-scope evidence for the partially
  observed Store Action and checklist flows;
- login, refresh, logout, and recovery evidence for the four pilot personas;
- read-only rankings/personnel-profile positive and negative scope evidence;
- a confirmed reporting period/package plus role-scoped reports and incentive
  totals/export readback.

Use `docs/evidence/pilot-readiness/2026-07-05-owner-attested-mutation-flows.md`
and `docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md`.
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
- PR check wait is active: monitor it while independent next-PR work proceeds
  in a separate worktree; predecessor failures take priority. Never run two full
  release suites concurrently. Use the canonical 30-second GitHub status loop while idle; refresh complete status immediately before merge.
- Main protection requires the `required-release-gate` aggregate. Its child
  selection is fail-closed and requires the branch to be current with main.
  Post-merge exact-tree reuse does not weaken this gate: a missing or mismatched
  proof runs the full release instead.

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
- Complete PR-4 bounded target queues without changing mutations, DB schema, or authorization policy.
- Keep the truthful required gate, exact-tree post-merge proof/fallback, and
  targeted frontend boundary stable.
- Observe A3's next ten successful root-release PR runs; record the dated p95
  decision only after the sample exists.
- Preserve the 5 July owner-attested B1 facts and keep only the remaining
  persona/session, negative-scope, rankings/profile, and reports/incentives
  evidence blocked.

Next:
1. After PR-4 merges, continue the audit order; PR-2 remains blocked on DG-1, so advance only to the next unblocked specified slice.
2. Obtain one safe read-only B1 bundle for a remaining evidence gap; do not
   repeat the successful 5 July mutations solely to improve documentation.
3. If evidence produces a P0/P1 finding, create one finding-specific spec and
   PR with reproduction, scope, verification, and rollback.
4. If no P0/P1 exists, keep runtime parked and make no speculative code train.
5. Update this handoff only when a current decision, proof state, or next safe
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
- Owner-approved project-wide audit remediation plan:
  `docs/plans/project-wide-audit-remediation-plan-v1.md`.
- Source-derived authorization operating truth:
  `docs/architecture/authorization-operating-truth-v1.json`.
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
