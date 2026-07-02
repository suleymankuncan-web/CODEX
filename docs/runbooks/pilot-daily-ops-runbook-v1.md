# Pilot Daily Ops Runbook V1

Status: active
Shelf: pilot readiness
Last verified: 2026-07-02

## Reader And Action

Reader:

- pilot operator,
- product owner,
- support engineer,
- future Codex session preparing a pilot day while external/Nebim data is still pending.

After reading, the operator should know what to check at the start of each pilot day, how to treat import/data-quality signals, when to stop, and what evidence to record without leaking secrets.

## Scope

This runbook closes PR5 of `docs/superpowers/plans/2026-07-02-pilot-readiness-pre-external-data-v1.md`.

It governs the controlled staging/internal pilot operating day before direct Nebim integration exists. It does not approve broad production rollout.

## Boundaries

Allowed:

- run existing smoke, release, import, and route checks,
- inspect accepted/quarantined data quality signals,
- record sanitized evidence,
- classify issues by severity,
- pause, roll back, or park work when proof is missing.

Not allowed:

- implement Nebim or any new provider adapter,
- change DB schema,
- change API shape,
- change auth, role, scope, or assigned-store semantics,
- change KPI, ranking, incentive, target, checklist, or workforce formulas,
- create fake metrics or fake data to make a route look complete,
- paste OTP, passwords, cookies, bearer tokens, provider secrets, database URLs, Redis URLs, or raw private personal data into evidence.

## Daily Start

Run these checks before asking pilot users to validate the app for the day:

1. Confirm frontend staging is reachable: `https://staging.hr-axis.com`.
2. Confirm backend staging health is reachable: `https://api-staging.hr-axis.com/api/health`.
3. Confirm the expected Vercel deploy and Render deploy are the intended release for the day.
4. Confirm `main` contains the last merged pilot-readiness PR.
5. Run or review the latest pilot smoke evidence for Admin, Region Manager, Store Manager, and Store Personnel personas.
6. Check the latest import/data-quality batch state if a new source file was loaded.
7. Check user feedback, support notes, and error reports from the previous pilot session.
8. Decide the day state: `Go`, `Conditional Go`, `No-Go`, or `Parked`.

Evidence note format:

```markdown
## Daily Start - YYYY-MM-DD

- Frontend staging:
- Backend health:
- Vercel deploy:
- Render deploy:
- Latest app commit:
- Persona smoke:
- Import/data-quality state:
- Feedback queue:
- Decision:
- Owner:
```

## Persona Smoke

Minimum daily persona checks:

| Persona | Positive route | Negative/guard check | Evidence |
|---|---|---|---|
| Admin | `/admin/auth`, `/admin/master-data`, `/admin/integrations` | No raw limit/internal API error on core admin pages | sanitized route result |
| Region Manager | `/store/home`, `/store/kpis`, `/store/checklists`, `/store/targets`, `/store/incentives`, `/store/workforce`, `/store/feed`, `/store/reports` | Sees assigned region/store scope only | sanitized route result |
| Store Manager | `/store/home`, `/store/kpis`, `/store/targets`, `/store/incentives` for company store only | No Region Manager approval flow, no hidden store access | sanitized route result |
| Store Personnel | `/store/me` | `/store/checklists` fails closed | sanitized route result |

Preferred local mocked smoke:

```powershell
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
```

If a live staging smoke is performed, use the relevant existing staging runbook and record only route/status evidence. Do not record raw session data.

## Import Day Flow

Use this flow whenever a Power BI/Excel source file is uploaded or a future approved source path produces a batch:

1. Upload or pull source data using the currently approved source path.
2. Confirm a batch was created.
3. Confirm source row count.
4. Confirm accepted row count.
5. Confirm accepted-without-person row count when store-level facts are valid but personnel mapping is missing.
6. Confirm quarantined row count and top quarantine reasons.
7. Confirm store-level KPI, ranking, target, incentive, workforce, and report pages render from accepted rows.
8. Confirm known unmatched personnel rows do not block accepted store-level data.
9. Confirm the monthly report export opens when reports are in scope for the persona.
10. Record sanitized evidence.

Data-quality source documents:

- `docs/contracts/external-source-canonical-data-contract-v1.md`
- `docs/contracts/external-source-data-quality-rules-v1.md`

Import evidence note format:

```markdown
## Import Check - YYYY-MM-DD

- Source system:
- Source batch id:
- Period:
- Source rows:
- Accepted rows:
- Accepted without person:
- Quarantined rows:
- Top quarantine reasons:
- Store-level surfaces checked:
- Blocked surfaces:
- Decision:
```

## Data Quality Triage

Use batch health before debugging individual pages.

| Symptom | First place to check | Continue? | Next action |
|---|---|---:|---|
| Store KPIs missing for many stores | accepted store-level KPI facts for the period | no if broad | inspect store mapping and period parsing |
| Personnel sales missing but store totals present | employee quarantine reasons | yes if visible and scoped | map personnel codes later; do not block store-level pages |
| Rankings show impossible percent or target values | target and KPI accepted facts | no if calculation uses missing/quarantined rows | stop and inspect source facts before UI fixes |
| Incentives blocked by month close/calculation state | close readiness and target source lineage | conditional | verify accepted imported targets and sales source |
| Report export opens but values are blank | accepted materialized facts for the report package | conditional | compare report columns to source facts |
| UI shows UUID/raw technical id | display label fallback or error message path | conditional | file small PR; do not change scope semantics |

## Issue Triage

Classify every pilot issue before opening a fix PR:

| Severity | Meaning | Action |
|---|---|---|
| `P0` | User cannot enter a pilot-critical surface, or privacy/scope is broken | pause pilot validation and fix immediately |
| `P1` | Wrong data, wrong permission, wrong business decision, or blocked critical action | stop affected workflow and fix in isolated PR |
| `P2` | Slow, confusing, broken export/action, overflow, or important copy/error leak | batch if same route/risk class; fix before next broad pilot pass |
| `P3` | Polish or non-blocking copy/alignment | backlog unless it blocks operator confidence |

Fix PR rule:

- one domain per PR,
- one review story per PR,
- no formula changes mixed with UI fixes,
- no auth/scope change mixed with visual polish,
- no provider assumptions without source evidence.

## Stop Rules

Stop pilot validation and do not claim readiness if:

- auth/session login loops recur,
- a persona sees another region, store, or personnel data,
- accepted rows are silently dropped,
- KPI, ranking, incentive, target, checklist, report, or workforce calculations consume quarantined rows,
- accepted/quarantine counts are not explainable,
- checklist completion or task generation breaks,
- reports export invalid files,
- a critical page shows raw secrets, raw tokens, or private personal data,
- a fix would require Nebim/provider implementation, DB migration, API shape change, or formula change outside the approved plan.

## Rollback And Parking

Rollback:

1. Identify the last merged PR that changed the failing behavior.
2. Revert only that app PR when the behavior change is confirmed.
3. Keep accepted prior batches unchanged unless a separate data-corruption decision is made.
4. If the new source path caused the issue, disable or stop that source path and continue with the previous approved source path.
5. Record the rollback decision and sanitized proof.

Park:

- Park external/Nebim integration work until field shape and access method are known.
- Park broad production claims when protected/provider evidence is missing.
- Park P3 visual feedback unless it blocks an operator workflow.
- Park unmatched historical personnel cleanup when accepted store-level data is visible and quarantines are explainable.

## Communication Flow

Daily cadence:

1. Operator posts daily state: `Go`, `Conditional Go`, `No-Go`, or `Parked`.
2. Support owner posts new P0/P1 issues immediately.
3. Product owner decides whether P2 items are same-day fixes or next-day polish.
4. Engineer opens only scoped PRs from classified findings.
5. After merge/deploy, rerun the affected smoke and update the daily evidence note.

Message template:

```markdown
Pilot state: Go / Conditional Go / No-Go / Parked
Date:
Release:
Personas checked:
Data batch:
Open P0/P1:
P2 planned:
Parked external blockers:
Next operator action:
```

## Daily End

At the end of each pilot day:

1. Record final state and open issue list.
2. Confirm no plan-related dirty files remain in the working branch.
3. Confirm no secret-bearing evidence was committed.
4. Record whether the next day starts from the same release or a new deploy.
5. Keep broad production status separate from controlled pilot status.

Daily end evidence:

```markdown
## Daily End - YYYY-MM-DD

- Final pilot state:
- Merged PRs:
- Deploys:
- Smoke rerun:
- Import/data-quality state:
- Open P0/P1:
- P2/P3 backlog:
- External blockers:
- Next day start condition:
```

## Completion Criteria

The pilot day is operationally closed when:

- the daily start and daily end notes are recorded,
- persona route checks are either passed or explicitly blocked,
- data-quality counts are explainable for any imported batch,
- P0/P1 issues have a pause/fix/rollback decision,
- no external provider, formula, auth, DB, or API work was smuggled into pilot evidence,
- the next operator action is explicit.
