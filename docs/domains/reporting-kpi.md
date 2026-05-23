# Reporting And KPI Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer or future agent changing KPI scoring, ranking, store/personnel
  reports, snapshots, score explanation, performance budgets, or reporting
  repository boundaries.

After reading, they should know which score contract and repository boundary
must be preserved before changing reporting behavior.

## Source Documents

Use these first:

- `docs/plans/monthly-ranking-score-source-contract-v1.md`
- `docs/plans/kpi-source-semantics-v1.md`
- `docs/plans/kpi-interpretation-governance-v1.md`
- `docs/plans/kpi-config-editor-governance-preview-v1.md`
- `docs/plans/reporting-repository-risk-review-2026-04-30.md`
- `docs/plans/reporting-repository-boundary-inventory-v1.md`
- `docs/plans/performance-budget-v1.md`
- `docs/evidence/product-progress/2026-05-21-operations-kpi-ranking-readiness-v1.md`

## Active Rules

- Ranking and KPI math are business behavior; do not change them during polish
  or refactor work.
- Closed ranking/monthly evidence comes from backend contracts, not frontend
  inference.
- KPI source labels and score explanations must stay aligned with the scoring
  contract.
- Performance work should start from measured budget evidence, not file size
  anxiety.

## Parked Or High-Risk

- New ranking engine.
- Query/index changes without measured pilot volume or slow-query evidence.
- Repository splits without a concrete reporting/ranking change.
- UI redesign of reporting pages before the user starts the redesign track.

Open those only with a concrete scoring/product decision and targeted backend
plus frontend tests.
