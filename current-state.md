# Current State - Active Handoff

Status: active
Shelf: operating
Use when: resuming work, checking current posture, or choosing the next safe action
Do not use when: reconstructing PR history, selecting a branch, or replacing live verification
Last verified: 2026-09-01

This is the canonical short handoff for the HR Axis / Store Ops workspace. A cold reader should recover the current decision, external blockers, and next safe action in under five minutes.

Historical detail is separate in `docs/history/current-state-through-pr-913-2026-07-09.md`
and `docs/history/operating-truth-alignment-plan-execution-2026-07-10.md`.

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

- Frontend ownership is Cloudflare Workers Static Assets. `staging.hr-axis.com` serves the exact merged-main Worker artifact; TLS, deep-link/security-header probes and the real Store Manager cookie-session smoke passed on 2026-07-29. Vercel is retired from the active frontend path.
- Controlled staging/internal pilot: `Conditional Go / Continue`.
- Controlled pilot or patron-demo rehearsal: the active product signal source.
- Broad production rollout: `No-Go`.
- Separate mobile app: discovery/planning only; implementation is not active.
- New modules, broad redesign, generic architecture/refactor, and provider/JSON runtime integration remain parked. The owner-approved on-prem synthetic preparation and the contract-only company daily KPI pull specification are bounded local exceptions, without live-provider, production, secret, or company-data authority.
- Power BI/Excel remains the current operating data path; the product owner approved the documented source semantics in `docs/contracts/company-daily-kpi-pull-contract-v1.md` on 31 August 2026 and the storage/normalization boundary in `docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md` on 1 September 2026. The network-free pure adapter is present, and the active bounded implementation slice adds typed daily component storage plus an atomic replacement repository without projecting into canonical KPI scoring.
  Live connector mapping, scheduler, Docker runtime activation, canonical KPI projection, and Excel replacement remain suspended. The observed private evidence and provider-native configuration remain outside Git.
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
The 2026-08-08 `docs/plans/on-premise-private-container-deployment-plan-v1.md`
authorizes only repository/synthetic ONP-0..5 preparation. ONP-0, ONP-1 and
ONP-2 merged as PR #1044, #1046 and #1047. ONP-3A merged as PR #1048; its
provider-neutral cookie-session, CSRF recovery and strict-local internal JWKS
contract does not activate Keycloak or alter hosted Clerk. ONP-3B is active on
`codex/on-prem-keycloak-runtime-v1` from exact ONP-3A merge SHA
`b691510b7891b5f251e0708b3105e50db192f7d3`: it is limited to production-shaped
Keycloak topology, five synthetic personas, deterministic database binding and
fresh-Linux proof. Existing Clerk users are not migrated, hosted Clerk remains
the rollback path, and real company SMTP remains an external IT gate.
Workstation/company-server install, company firewall/DNS/TLS activation, real
users/data/Nebim/photos, paid services, provider retirement, and production
remain unauthorized external gates.
The conditional ONP-4B SeaweedFS 4.43 slice now has repository static and
synthetic runtime evidence for private scoped access, version/object-lock
integrity, signed reads, deletion denial, restart, and labelled snapshot/restore.
This evidence is not production engine acceptance: the proof backup is a
same-host rehearsal, real photos/AI remain disabled, hosted R2 remains the
rollback path, and company capacity, separate backup failure domain,
RPO/RTO/restore drill, secret provisioning, and owner/IT activation gates stay
open.
DG-3 verify-full is locked and proven on Render API after CA installation, health verification, and 13/14 smoke with zero failures; rotation/review and single-operator rollback are documented, next review 2026-10-11. DG-4 Sentry Developer is owner-selected with Render/Cloudflare env boundaries configured; API, worker, and frontend staging receipts are verified, merged PR #941 carries the frontend CSP ingest-origin fix, and merged PR #942 records the sanitized staging receipts. Production activation remains gated.
Broad production remains `No-Go`; the detailed PR narrative, route changes,
release proof, and DG1/DG2/REM history live in the linked historical records.
Current consequences are the active release, pilot, database, and on-prem
gates below; no successful read authorizes an unrelated runtime change.

Report Viewer checklist ownership is the active `REGION_MANAGER` role plus active direct store assignments. Assigning the role identifies the Bölge Müdürü; it does not grant company- or region-wide store access, and the account's visible portfolio comes only from Admin Auth “Mağaza erişimi” assignments. Legacy region identifiers remain persistence details for the existing weekly-plan mutation contract and are not an authorization source. Report Viewer history reads are bounded/retryable, Playwright build reuse requires an exact source/environment/dist receipt, and test-only frontend scripts avoid image proof while root package changes retain the full root release gate.
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

- Owner-locked routing is Sol/Medium integration, default bounded normal-speed Luna Max execution and read-only High review; substantive planning stays with Sol/root and reasoning never exceeds High. It applies automatically under root `AGENTS.md` and `discipline.md`.
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
- Automatic GitHub Actions begins with bounded exact-SHA `github-source-preflight`
  before expensive image/offline runtime jobs; those jobs remain final evidence,
  not a blind diagnostic loop. Manual image/offline dispatch still requires the
  full local proof wrapper and owner-published status before dispatch.

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
- Handoff correction (2026-08-16): the ONP-5 offline-package/rehearsal closure and the mandatory local-proof gate are now merged through PR #1084 at merge commit `50c3cd74f321dae42ec8988cb6fdcf37eebfea3c` (source `120de56eb9ffee91c43ca623f677dee10dccdf41`). Before any expensive hosted image/offline proof job, the repository now requires a fresh local receipt/status bound to the exact SHA, tree, Docker identity, pinned Node image, and archive tests. The local merged-tree evidence is green: archived Linux `test:onprem:offline` 145 tests / 144 pass / 1 expected `iptables-translate` skip / 0 fail; fresh migration/storage smoke 70/70 migrations succeeded with provider-neutral and rollback checks; SeaweedFS 4.41 synthetic runtime proof passed with exact receipt identity. These are synthetic/local gates, not production activation or independent disaster-recovery evidence.
- Repository/synthetic ONP-3B merged as PR #1050 at `f03ee302596eb4338b75d9dc4bef3e027d50f365`. ONP-4A provider-neutral storage and ONP-4B SeaweedFS synthetic runtime implementation are now present on merged `main`; hosted R2 remains the rollback path, and no local engine or real photo is active in production.
- The conditional ONP-4B SeaweedFS 4.43 overlay is now documented with its exact digest/license, private internal data-network topology, file-backed distinct bucket-scoped credentials, and synthetic runtime proof. This is a reversible evidence slice only; the same-host backup volume is not production DR, and real photos, visual AI, company-server activation, and hosted rollback retirement remain No-Go.
- The owner-approved photo-evidence train is complete through logical PR-8A, squash-merged as PR #1028 (`ce1df5c67fd61fc5b9692ad3b54d6dc2c02cb801`). PR #1025 delivered VM reference management; PR #1026 delivered retention/reconciliation and usage controls; PR #1028 locked Qwen `qwen3.7-plus-2026-05-26`, non-thinking, strict structured output, no tools or second model, and Region Manager final authority. On 30 July 2026 the owner replaced the conservative six-gate/personal-data posture with a lean store-photo-only pilot: intended inputs are store, shelf, fixture, display, and product photographs; PR-8B uses a 20-pair synthetic technical smoke and PR-10 a 30-50 comparison controlled pilot. Private storage, image validation plus decode/re-encode and metadata stripping, exact-model/budget/kill-switch controls, manual fallback, advisory-only AI, and zero official-score/KPI/ranking/target/incentive effects remain mandatory. A dedicated antivirus service, 100-150 pair blind benchmark, two independent labelers, and expanded provider legal/subprocessor dossier are deferred unless scope, threat evidence, personal-data intent, automated scoring, or production breadth changes. All VM grants and runtime flags remain disabled by default; no broad-production authority exists. See `docs/plans/qwen-store-photo-lean-pilot-decision-v1.md` and the existing photo/VM execution specs.
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
1. Keep ONP-4A/4B and ONP-5 behind their external gates: clean Ubuntu-host rehearsal, owner trust distribution, separate backup failure domain, accepted RPO/RTO and recurring restore drill, secret provisioning/rotation, host firewall/DNS/TLS ownership, and owner/IT activation. The local migration/storage, SeaweedFS synthetic, and source-free offline contract gates are green; they do not authorize real users, SMTP, photos, company-server access, or production cutover.
2. Logical PR-8B merged as PR #1036 at `01fdd8292e9963c1a8d4c91388f27dfe93459faf`. Logical PR-9 merged as PR #1037 at `a1e7708948e8fb0da0a550dcfbe5a732f8441fb5`: the exact-cohort BullMQ path writes only isolated `shadow` ledger rows, reads private canonical media, retries within fixed bounds and has no controller, UI, auth or official product sink. Logical PR-10 is active on `codex/qwen-pr10-advisory-pilot`: it adds default-off exact-cohort real VM photo intake, mutually exclusive `advisory` enqueue, a Region Manager-only advisory review surface scoped by the intersection of current region-role and action-store assignments, immutable first-review semantics, aggregate-only 30-50-pair receipt tooling, and a provider-neutral Qwen/Luna same-corpus evaluation protocol. AI output remains advisory and cannot update checklist outcomes, Store Actions, KPIs, rankings, targets or incentives. Staging execution, provider calls and gate activation remain separately controlled by the runbook.
3. Keep retention cleanup disabled and do not execute a purge until a separately approved staging run window and exact sanitized manifest exist.
4. Treat real controlled-pilot feedback as the primary product signal; only evidence-backed P0/P1 findings open unrelated runtime work.
5. Keep ORG/ASSIGN correction, DG1-C contraction, Qwen product runtime activation, automated AI scoring, and broad production behind their recorded gates. Controlled store-photo staging use follows the lean pilot decision and remains feature-gated/advisory.
Park:
- Separate mobile implementation, new modules, broad production, broad redesign, and generic architecture/refactor work.
- Provider/Nebim/JSON runtime implementation without the approved source contract's remaining field, identity, authentication, privacy, retry, and synthetic-adapter gates.
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
