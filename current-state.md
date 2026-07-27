# Current State - Active Handoff

Status: active
Shelf: operating
Use when: resuming work, checking current posture, or choosing the next safe action
Do not use when: reconstructing PR history, selecting a branch, or replacing live verification
Last verified: 2026-07-27

This is the canonical short handoff for the HR Axis / Store Ops workspace. A cold reader should recover the current decision, external blockers, and next
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
- Runtime work remains parked except for the owner-opened DG1-DG2 remediation
  train; any other runtime line still requires a factual P0/P1 finding or a
  newer explicit owner decision.

## Current Plan Execution Truth

The owner approved autonomous execution of
`docs/plans/project-analysis-implementation-plan-v1.md` on 2026-07-10. That
approval did not authorize speculative runtime work or broad production.

The owner also approved autonomous execution of
`docs/plans/project-wide-audit-remediation-plan-v1.md` on 2026-07-10. Its first
slice is the authorization operating-truth contract: complete route ownership,
preview/runtime drift, and backend-endpoint drift become machine-visible before
any permission behavior changes. DG-1 and the real-data-preserving DG-2 policy
are locked in `docs/plans/dg1-dg2-locked-decisions-implementation-plan-v1.md`:
execute the company-read/no-action Report Viewer allowlist, incentive closure,
read-only production Session, honest Norm Kadro projection reversal, and safe
verify-full preflight in order. Constraints still require live evidence.
DG-3 verify-full is locked and proven on Render API after CA installation, health verification, and 13/14 smoke with zero failures; rotation/review and single-operator rollback are documented, next review 2026-10-11. DG-4 Sentry Developer is owner-selected with Render/Vercel env boundaries configured; API, worker, and frontend staging receipts are verified, merged PR #941 carries the frontend CSP ingest-origin fix, and merged PR #942 records the sanitized staging receipts. Production activation remains gated.
Broad production remains `No-Go`. PR #927
completed PR-1 without runtime behavior change; its contract covers 54 routes,
33 direct matrix routes, and three preview plus three backend drifts. PR #929
completed PR-3: authorization changes now clear protected frontend cache state
before a new shell renders. PR #930 completed PR-4: target and request-center
reads are bounded without mutation, DB, or authorization-policy changes. PR
#931 completed PR-5: business-date defaults and calendar arithmetic now use Europe/Istanbul while timestamp instants remain UTC. PR #932 completed PR-6: Store Feed, Store Reports, and Admin Incentives now own typed TR/EN chrome while source and technical data remain unchanged. PR #933 completed PR-7: Master Data selection is keyboard-owned, protected shells have localized skip links, and two bounded axe seeds guard critical WCAG 2 A/AA violations. PR #934 completed PR-8 with transitive called-wrapper system-flow evidence. PR #935 delivered the read-only database invariant preflight; live staging evidence and invariant decisions remain DG-2-gated. PR #936 delivered validated pool, polling, timeout, and TLS configuration; PR #939 closed provider-CA verify-full staging proof plus rotation/rollback ownership. PR #943 completed DG1-A: Report Viewer backend reads are bounded by role-specific company scope with cross-company, empty-scope, and mixed-role tests; frontend exposure remains the DG1-B gate.
PR #944 completed DG1-B. PR #948 completed DG1-D: non-development Admin Session is read-only while the local diagnostics editor remains development-only.
PR #949 completed DG2-A and PR #950 completed DG2-B. The approved DG2-C read-only
staging receipt records 70 invariant check hits and an overall DB-CONSTRAINTS
No-Go without repair or mutation. PR #952 merged REM-1A; PR #953 merged one owner-confirmed REM-1B run with stable 70 family hits, 72 source records, nine buckets, and unresolved distinct-person count. All REM-2 owner decisions are locked, including restore and concurrency safety; implementation, row evidence, staging mutation, and constraints remain separately gated. DG1-C retirement remains usage-gated.
- PR #917 (A1) made `required-release-gate` the truthful required main-branch aggregate and verified the ruleset readback.
- PR #918 (A2) made root release the one canonical full frontend-release owner; the reusable frontend-targeted workflow remains manual and is not a duplicate required child.
- PR #919 (A3) kept all 371 Playwright tests, uses two CI-only workers with
  serial files, and preserves failure-only Playwright artifacts.
- The release path keeps one full PR release as the canonical proof. Relevant
  main pushes reuse that proof only when merged PR, base parent, latest green
  gate, completion time, and tree hash agree; every uncertain case falls back
  to the full release.
- PR #920 (B1) established the five-flow blocker record. A later owner
  attestation records successful 5 July checklist approval, Store Action task
  closure, and target submission/editing with no issue. PRs #971-#975 add live
  Admin, Region Manager, Store Manager, Store Personnel, Report Viewer, Moi
  ranking/profile, June report/export, and incentive-readback evidence. No P0/P1
  finding or runtime change is authorized by those successful reads.
- PR #921 (E1) reconciles Visual Merchandiser-only Store routes and starts an
  incremental archive-guard migration register without a bulk archive rewrite.
The historical transition record carries PR narrative and proof links. This
section intentionally retains only the current operating consequences.

## Active Evidence Gates

### A3 Release Measurement

PR #919's A3 observation is closed from ten successful root-release jobs. The
nearest-rank p95 is `13.23` minutes. The canonical release DAG now preserves
the complete suite while separating native CI proof jobs and offering exact-
input local `--resume`; volatile audits rerun and every uncertain identity
falls back fresh. Keep all 371 tests and two CI workers; runner-minutes above
110% of baseline require an owner decision. Source: `docs/evidence/performance/
2026-07-10-e2e-worker-concurrency-a3.md`.

### B1 Controlled Pilot Evidence

The product owner attested that checklist approval, Store Action task closure,
target submission, and target editing were used successfully on 5 July 2026.
No issue or P0/P1 finding was reported. Current 12-13 July live staging smokes
prove protected landing, cookie-session readback, browser-storage boundaries,
CSRF rejection, and logout for Admin, Region Manager, Store Manager, Store
Personnel, and Report Viewer. Moi ranking/profile scope and June Report Viewer
package/export plus Super Admin incentive readback also pass.

Optional follow-up evidence is:
- account-recovery evidence if recovery becomes a pilot requirement;
- fresh live cross-person rankings/profile denial remains optional and requires
  an approved negative subject; current Moi session plus row-scope contracts pass;

PR #977 reconciled all 16 June non-projected incentive rows read-only: 13 are
`blocked`, three are `no_source`, every bucket is `owner_input_required`, and
the decision is `no_runtime_change`; no correction or business value was written.

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

- Repo-local Codex routing is Medium execution, XHigh planning, and read-only High diagnosis/R4-R5 review; see root `AGENTS.md` and `.codex/config.toml`.
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
  release suites concurrently. Use the canonical 55-60 second GitHub status loop while idle; refresh complete status immediately before merge. A concrete late-stage retry may use exact-input `check:release -- --resume`; coverage remains unchanged.
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
- The owner-approved photo-evidence train is active. PR #1020 locked the product/provider gates and PR #1021 merged the provider-neutral schema foundation. PR-3 is the synthetic-only private-media storage slice: two distinct private R2 Standard EU buckets, separate bucket-scoped credentials, verified recovery before `ready`, 8 GiB / 750k Class A / 7.5m Class B application ceilings, 30-day `locked/` safety window, daily schedulable reconciliation/restore/cleanup, RPO 0 and manual RTO <=24h. Runtime remains disabled by default and no real photo, provider credential, paid activation or broad production authority exists. See `docs/plans/checklist-photo-media-storage-provider-decision-v1.md`.
- DG1-C runtime removal is `blocked_external`; PR #945 merged the static classification, but the owner-approved provider usage window is missing. No runtime branch is active; create one fresh from `main` only after the window clears. Do not remove either incentive GET contract; preserve Region Manager commands and the Super Admin bypass; see `docs/evidence/sales-target-incentive-v1-dg1-c-consumer-classification-2026-07-11.md`.
- Merged REM-1B evidence explains the stable 70 hits without mutation. All REM-2 owner decisions are locked: domain lifecycles, fresh encrypted backup/verified restore, affected-writer pause, one correction runner, row locks, and old-value predicates. Row-level winners/classifications and history-preserving writers remain unresolved. `D-STAGING-MUTATION` remains unavailable for the blocked ORG/ASSIGN families. `D-CONSTRAINT-WINDOW` is locked only for eligible TARGET DB-C5 as `bounded_5s_add_30s_validate_no_pause_fail_closed`; this does not make the other families eligible or change the overall broad DB-CONSTRAINTS No-Go.
- PR #955 merged the repository-only REM-2B V2 implementation at `b9112aa34b9ef75615caa74588169a571017726c`: ordinary targets use JSON parity, pilot imports use approved-reference parity, KPI uses the month-final effective manager portfolio, Norm Kadro and assignment region use lifecycle-aware history, support remains secondary, and inclusive primary ranges require a later successor start. V1 SQL/spec/evidence remain immutable.
- The first post-#955 attempt stopped before receipt because CA path was passed instead of PEM; PR #956's attempt stopped before connection on Windows `EINVAL`. Both SHA markers remain consumed. PR #957 merged the reviewed Windows wrapper; PR #958 merged its valid verify-full, repeatable-read/read-only V2 receipt: `TARGET-02=0`, `ORG-02=3`, `ASSIGN-01=4`, and `ORG-04=7142`. The large ORG-04 total is failed authority resolution, not permission to infer managers or bulk-edit period rows.
- PR #959 merged REM-2C at `9de5e68cf62cd15eda45f2c3e1d935ff54fb9e25`; its one-shot verify-full, repeatable-read/read-only staging receipt is valid. `7149` V2 check hits deduplicate to `832` authority units: ORG-04 has 739 role-not-effective, 59 multi-manager, 28 portfolio-not-effective, and one never-configured unit; ORG-02 has three and ASSIGN-01 two units with the rotation/lifecycle source absent. No winner or correction manifest is authorized.
- The locked `D-TARGET-DUPLICATE=reject_app_and_db` decision has application-boundary enforcement for new requests and edited approvals: duplicate employees fail before repository writes. Existing pilot-import rows and API shape remain unchanged. PR #966 plus its exact-SHA staging receipt now close the database half for ordinary TARGET requests; production remains excluded.
- PR #962 merged REM-7 at `84fa69311575dcaa1aa01548853c76f0f083e4ce`. Its one-shot staging receipt is valid: verify-full, certificate-verified, `REPEATABLE READ READ ONLY`, rollback, empty stderr, and strict digest validation. TARGET-02 reconciles from V1 `54` to active `0` and is `eligible_zero`; ORG-02 is `3` hits/`3` authority units, ORG-04 is `7142` hits/`827` units, and ASSIGN-01 is `4` hits/`2` units, all `blocked`. No mutation or DDL occurred.
- PR #964 merged REM-8 TARGET preparation at `b60776c033528438118322b8b09652f16909f78d`. Its exact-SHA REM-8A staging receipt is verify-full, repeatable-read/read-only, TARGET-clean, PostgreSQL 17, and free of long transactions or conflicting locks; the exact-SHA REM-8B restore rehearsed 5,001 synthetic rows with expected `23514`/`55P03`, 20/20 writers, validation, rollback, and cleanup. Staging has 61 live TARGET rows versus the 5,000-row conservative envelope, so the reviewed decision is `rem_8c_not_required`; no staging DDL occurred.
- PR #965 merged the exact-SHA REM-8 evidence at `3ab884f6ed922f5339d6a8890d7d4d69590710b8`. PR #966 then merged the TARGET-only DB-C5 repository implementation at `d76d56f741b832b5d39eede8364f333e12a0e341`. Its exact-merged-SHA one-shot staging apply completed successfully: migration 060 applied exactly once, the duplicate-employee CHECK is validated, the immutable function/checksum are exact, active TARGET V2 hits remain zero, verify-full passed, and the dedicated postflight was read-only. The sanitized receipt is `docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.json`. Production was not accessed. DB-C5 remains distinct from the separately authorized TREF application-history implementation.
- PR #978 makes browser-cookie sessions re-read application-account status on every protected request: inactive, missing, or role-empty accounts fail `401`, while role/action assignments remain DB-fresh and Clerk is not called per request. TREF-1 locks `completed_snapshot`, `whole_month_latest_approved`, and `explicit_rerun_only` semantics plus explicit removals, initial-only pilot import, and responsibility-only manager changes. The separately authorized TREF implementation now uses append-only successors, exact bases/removals, current primary-store authority, rotation-aware revision basis, completed-snapshot closure, typed conflicts, and initial/exact-replay-only pilot import. It adds no migration and accesses no staging or production data.
- The owner-approved Command Canvas P1-P7 cutover is complete through squash-merged PR #997 (`40d2617e`). The final route uses the real role-scoped Command surfaces, weekly/full-period planning, Living Store Record, canonical workflow overlays and migrated deep links; legacy checklist DOM, dormant chunk owners and orphan flow CSS/tests are removed. Final-head checks, Post-Merge Verification, backend/Docker rehearsal, Vercel deployment and the controlled public staging readiness smoke are green. On 15 July 2026 the product owner explicitly waived physical iOS Safari/Android Chrome evidence as a merge gate and accepted that residual mobile/auth risk for ordinary controlled-pilot observation. Those checks were not performed and are not reported as PASS; see `docs/evidence/checklist-command-cutover-v2/README.md`.
- The 15 July checklist interaction regression closeout keeps the Store shell navigable on desktop and mobile, routes Region Manager and Visual Merchandiser execution actions directly into their authorized checklist session, replaces blocking browser close prompts with accessible in-product confirmation, and preserves repeated same-store planning on different dates while rejecting same-day duplicates. Report Viewer remains read-only and server authorization remains authoritative.
- The Store Incentives and Store Targets Command Canvas cutover is complete through merged PRs #1000 (`29708806`), #1001 (`a3641112`), #1002 (`d3058420`), #1003 (`0e72caf2`), #1004 (`35aeb870`), and #1005 (`5f8ce5ad`). Closeout PR #1006 is verified at source head `a37adef7`; read its squash SHA from fresh `origin/main` after merge rather than predicting it here.
- Incentives and Targets desktop/mobile prototype parity, legacy removal, and protected staging reads pass for Region Manager, Report Viewer, and Store Manager with zero browser mutation requests. Report Viewer remains company-scoped/read-only, Store Manager remains own-store scoped, and broad production remains `No-Go`; see `docs/evidence/store-command-canvas-parity/2026-07-16-controlled-pilot-read-gate.md`.
- The seven-PR operational-surfaces cutover is merged through PR #1013. Closeout PR #1014 remains open while its repaired head is recertified. Owner-observed KPI, Talep Merkezi and Görevler geometry differences invalidated the first visual PASS assumption. The local repair now gives KPI Özetleri, Talep Merkezi, Norm Kadro and Görevler one shared compact four-cell decision rail, fixed desktop geometry, content-sized page rows, and before/after rectangle assertions at 1440x900, 1024x768, 390x844 and 320x844. Local parity, role and accessibility suites pass; final CI, deployment and protected staging read evidence remain required before merge. See `docs/evidence/store-operational-surfaces-command-canvas/parity-gap-audit-2026-07-17.md`.
Next:
1. Re-green PR #1014 on the repaired head, deploy that exact head, repeat the protected four-route staging read with zero mutations, then merge only if mergeability and all required checks are clean.
2. Treat real controlled-pilot feedback as the primary product signal; only evidence-backed P0/P1 findings open runtime work.
3. Keep ORG/ASSIGN correction and DG1-C contraction parked behind their recorded historical-authority and provider-usage gates. TREF has no hidden follow-up writer; real use remains subject to its runtime authorization, snapshot, and exact-base checks.
4. Keep broad production `No-Go`; never infer historical winners or treat an approved specification as implementation authority.
Park:
- Separate mobile implementation, new modules, broad production, broad redesign, and generic architecture/refactor work.
- Provider/Nebim/JSON implementation without a real source contract and owner decision.
- Further frontend unit-test migration or bundle work without its named conditional trigger.

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

- Project mode and go/no-go board: `docs/plans/project-control-board-v1.md`.
- Active decisions: `docs/plans/decision-registry-v1.md`.
- Repeatable runbooks: `docs/plans/runbook-registry-v1.md`.
- Owner-approved, evidence-gated implementation plan: `docs/plans/project-analysis-implementation-plan-v1.md`.
- Audit source and locked DG1-DG2 execution: `docs/plans/project-wide-audit-remediation-plan-v1.md`
  and `docs/plans/dg1-dg2-locked-decisions-implementation-plan-v1.md`.
- Post-DG2 staging remediation and constraint re-entry: `docs/plans/post-dg2-staging-remediation-and-constraint-reentry-plan-v1.md`.
- Source-derived authorization operating truth: `docs/architecture/authorization-operating-truth-v1.json`.
- Current practical actions: `docs/plans/active-next-actions.md`.
- Canonical debt counts: `docs/plans/project-debt-ledger.md`.
- Incremental historical-guard ownership: `docs/plans/archive-guard-migration-register-v1.md`.
- Controlled pilot blocker record: `docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md`.

Debt ledger snapshot remains canonical in `docs/plans/project-debt-ledger.md`:

- Closed active debts: 95
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

Project Debt Ledger Consistency Guard V1 keeps these handoff counts aligned
with the canonical ledger. The ledger, not this handoff, owns the full count
set and closeout rationale.
