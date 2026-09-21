# Current State - Active Handoff

Status: active
Shelf: operating
Last verified: 2026-09-21
Use when: recovering current scope, blockers and next action
Do not use when: inferring live deployment or selecting a branch from old PR notes

## Now

- Controlled staging/internal pilot: `Conditional Go / Continue`.
- Broad production rollout: `No-Go`.
- Separate mobile app: discovery/planning only; implementation is not active.
- Process work: bounded task-based reading and progressive skills replace blanket
  manual loading. Verification, data integrity and activation gates are unchanged.
- Ranking monthly HG is merged in PR #1167 (`2db36bd1`), verified from GitHub/main
  on 18 September. Selected-day sales use whole monthly targets; published admin
  HG weight applies directly. Other KPI scales and closed snapshots are preserved.
  [Contract and rollback](docs/plans/rankings-monthly-achievement-v1.md).
  Deployment of this change is not established by that merge evidence.
- Ranking daily-facts Redis cache is opt-in/default-off; company names, permissions,
  targets and scoring stay fresh. Hosted activation is unverified.
  [Measurement](docs/evidence/performance/2026-09-16-rankings-cache.md).
- Checklist PDF/comments and account-only manager resolution are on merged main
  through #1165. LUFIAN heading, document-date regional manager, handwritten store
  manager, retained historical template/score and mobile session-dismissal fixes
  remain. The earlier closed #1118 is historical, not an active prohibition.
- Hosted Clerk and private Keycloak share the approved login shell; their auth
  behavior stays separate. [Login contract](docs/plans/keycloak-login-studio-v1.md).

## Next

Refresh branch/worktree, relevant PR head/checks and runtime evidence for the user's
next task. Do not infer live PASS from merged code. Address observed product issues
within their scope; the historic multi-PR plans do not authorize unrelated work.
Cloudflare Workers Static Assets owns the active frontend; Vercel is retired there.
Read [AGENTS.md](AGENTS.md#reading-map) for task-specific execution requirements.

## Active Evidence Gates

- Broad rollout still needs the relevant independent provider, recovery, queue,
  alert and real-user evidence. Historical pilot receipts are dated observations.
  [Pilot blockers](docs/evidence/pilot-readiness/2026-07-10-controlled-pilot-b1-external-blockers.md).
- On-prem: owner-approved on-prem synthetic preparation is scoped by
  [the ONP plan](docs/plans/on-premise-private-container-deployment-plan-v1.md).
  Clean-host rehearsal, trust distribution, separate backup failure domain,
  accepted RPO/RTO and restore drills, secret provisioning, firewall/DNS/TLS and
  owner/IT activation remain deployment-specific gates. Synthetic evidence is not
  broad-production permission; hosted rollback paths remain available.
- The private-server schedule and canonical KPI projection described above are active only for the approved company deployment.
  Its narrowly approved daily feeds and immutable sanitized archives are governed
  by [company mode](docs/contracts/onprem-company-data-mode-v1.md). No PR here
  redeploys that server. Credentials, mappings and private receipts remain outside Git.
- Reusable live connector mapping, hosted scheduling, and Excel replacement remain suspended.
  Approved sources: [daily pull](docs/contracts/company-daily-kpi-pull-contract-v1.md),
  [storage](docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md),
  [connector readiness](docs/contracts/company-daily-kpi-connector-readiness-evidence-v1.md).
  Approval defines a contract; it does not supply a live readiness evidence instance.
- ORG/ASSIGN correction has no authorized winners/manifests; DG1-C contraction
  waits for the provider usage window. TARGET-only DB-C5 staging proof does not
  authorize production or other data families.
- Qwen store-photo pilot stays exact-cohort, default-off and advisory-only with
  regional-manager authority. No official score/KPI/ranking/target/incentive effects.
  [Lean pilot boundary](docs/plans/qwen-store-photo-lean-pilot-decision-v1.md).

## Park

Broad redesign, generic architecture/refactor, new modules, reusable provider
connectors, automatic AI scoring and mobile implementation wait for a concrete
new user scope or their recorded gates. Read/action scope remain separate; manager
directories use active roles and direct assignments, not inferred legacy regions.

## Stop

Stop on missing action authority, unknown/destructive scope, protected dirty work,
unexplained failures, changed contracts or missing required proof. No fabricated
metrics, private data in Git, gate bypass or independent-review claim for self-review.
Root-only execution and owner-disabled GitHub Codex review remain in force.

## References And Hygiene

Documentation Library entry point: [docs/README.md](docs/README.md).
Project mode and go/no-go board: [control board](docs/plans/project-control-board-v1.md).
[Decisions](docs/plans/decision-registry-v1.md) · [Runbooks](docs/plans/runbook-registry-v1.md).
[Evidence-gated plan](docs/plans/project-analysis-implementation-plan-v1.md).
Execution: [discipline.md](discipline.md); release recovery uses `--resume` without
reducing coverage; idle polling is 55-60 seconds. Detailed historical narration is
in [the pre-budget archive](docs/history/current-state-before-context-budget-2026-09-18.md),
retrieved only for a concrete dependency, never as current authorization.
Repo Hygiene Guard V1: `outputs/` and generated artifacts remain ignored.
[No-delete inventory](docs/plans/workspace-hygiene-inventory-2026-07-09.md) still applies.

Debt ledger snapshot remains canonical in `docs/plans/project-debt-ledger.md`:
- Closed active debts: 95
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0
Project Debt Ledger Consistency Guard V1 checks these against the ledger.
