# Monthly Ranking Score Source Contract V1

Date: 30 April 2026

Status: `locked_v1`

## Purpose

Define one official place for monthly ranking and monthly score source rules.

This document does not change scoring math. It records which backend source is authoritative so store, personnel, checklist, ranking, and future mobile surfaces do not invent separate explanations.

## Official Evidence Contract

The official closed ranking endpoint is:

```text
GET /reports/leaderboards/closed
```

For monthly ranking, the response must include:

```text
includedSnapshotRuns
```

Rules:

- Only completed daily snapshot runs returned by the backend contract are official evidence.
- Monthly ranking must not infer included days from the frontend snapshot list.
- Frontend screens may use the snapshot list for selection controls, but not as the truth for monthly calculation evidence.
- `includedSnapshotRuns` is the source for the monthly closure evidence panel and later mobile/read-model explanations.

## Personnel Monthly Primary Score

Personnel monthly primary score uses average closed-day total score.

Authoritative source:

```text
rpt.employee_performance_snapshot.score_value
```

Monthly behavior:

- daily rows come only from `includedSnapshotRuns`
- monthly score is `AVG(score_value)` across included closed days with a personnel performance row
- missing performance days are not zero
- monthly official ranking requires `daysWithPerformance >= 3`
- rows below 3 days may show preview context, but official store/Turkey rank stays null

## Personnel Scoring Sources

Personnel profile V1:

| Metric | Source | Weight | Rule |
| --- | --- | ---: | --- |
| `TARGET_ACHIEVEMENT` | `TARGET` | 40 | Uses approved personnel target references. Missing target returns missing reference, not a guessed score. |
| `ATV` | `TURKEY_AVERAGE` | 30 | Uses same-period PowerBI-compatible average of imported personnel KPI facts. |
| `UPT` | `TURKEY_AVERAGE` | 30 | Uses same-period PowerBI-compatible average of imported personnel KPI facts. |

Personnel V1 source map:

```text
TARGET_ACHIEVEMENT: TARGET
ATV: TURKEY_AVERAGE
UPT: TURKEY_AVERAGE
```

Personnel ranking does not include checklist metrics in V1.

## Store Monthly Score

Store monthly score combines operational KPI performance and checklist evidence.

Authoritative sources:

- operational KPI values: `rpt.store_kpi_snapshot`
- checklist evidence: `rpt.store_checklist_snapshot`
- score blend: backend `StoreScoreBlendService`

Store profile V1:

| Metric | Source | Weight | Rule |
| --- | --- | ---: | --- |
| `TARGET_ACHIEVEMENT` | `TARGET` | 40 | Uses store target/actual achievement for the period. |
| `CR` | `TURKEY_AVERAGE` | 20 | Uses same-period PowerBI-compatible weighted total over KPI-import-enabled stores. |
| `ATV` | `TURKEY_AVERAGE` | 15 | Uses same-period PowerBI-compatible average of store ATV facts over KPI-import-enabled stores. |
| `UPT` | `TURKEY_AVERAGE` | 15 | Uses same-period PowerBI-compatible weighted total over KPI-import-enabled stores. |
| `BM_CHECKLIST` | `CHECKLIST_SCORE` | 5 | Uses completed BM checklist monthly visit average when a completed visit exists. |
| `VM_CHECKLIST` | `CHECKLIST_SCORE` | 5 | Reserved for VM checklist; V1 can return the weight to KPI when no completed VM checklist exists. |

Store V1 source map:

```text
TARGET_ACHIEVEMENT: TARGET
CR: TURKEY_AVERAGE
ATV: TURKEY_AVERAGE
UPT: TURKEY_AVERAGE
BM_CHECKLIST: CHECKLIST_SCORE
VM_CHECKLIST: CHECKLIST_SCORE
```

Current blend rule:

```text
missingWeightPolicy: return_missing_weight_to_kpi
```

Meaning:

- Missing BM/VM checklist does not penalize a store.
- If a checklist has no completed visit for the period, its weight returns to KPI performance for that score view.
- If a checklist has completed evidence, it contributes with its configured weight.

## Turkey Average Policy

Turkey average benchmarks are system-calculated from the platform's active in-scope imported KPI facts. Store references use PowerBI-compatible metric-specific behavior over KPI-import-enabled stores: ATV is the average of store ATV facts, while UPT and CR use weighted totals from the underlying base metrics.

PowerBI or source-provided Turkey average summary rows are reconciliation evidence only. The platform should match the PowerBI-visible metric behavior without silently trusting a pre-aggregated source summary row.

This applies to both Excel V1 and future JSON/API source work.

## Cap Policy

For `TARGET` and `TURKEY_AVERAGE` metrics:

- actual ratio remains visible
- scored contribution is capped at `1.2`
- UI language may show `%120+` when the actual result is above the cap
- cap affects score contribution, not the displayed actual performance

## Mini-Rank Policy

Metric mini-ranks are explanatory, not a second score engine.

Monthly personnel mini-ranks use:

```text
AVG(rpt.employee_kpi_snapshot.actual_value)
```

over `includedSnapshotRuns`.

They show how the user performs in a single metric such as UPT or ATV, while the main leaderboard remains ordered by the weighted total score.

## Scope And Exclusions

Included:

- daily/monthly closed ranking
- personnel total score source
- personnel metric benchmark source
- store score source
- checklist score source
- Turkey-average source policy
- cap policy

Excluded:

- new schema
- new API endpoint
- new score formula
- manual benchmark override UI
- region league/tournament scoring
- full mobile BFF aggregation

## CODEX Durust Yorum

This is the right kind of control document. The system already has a scoring engine and ranking endpoint; the risk was explanation drift.

The strongest decision here is that monthly evidence comes from `includedSnapshotRuns`, not from a frontend guess. The second strongest decision is that Turkey average means platform-scoped calculation over imported KPI facts, aligned to the PowerBI-visible reference, while imported summary rows stay reconciliation evidence.

This keeps the product flexible for later tournaments, VM checklist activation, and mobile screens without letting each screen invent its own math.
