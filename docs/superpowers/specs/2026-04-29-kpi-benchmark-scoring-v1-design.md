# KPI Benchmark Scoring V1 Design

Date: 29 April 2026

Status: `approved_for_planning`

## Goal

Define how uploaded store and personnel KPI values become fair, explainable scores.

The import layer answers:

> What happened?

The scoring layer answers:

> Was that result good, weak, or exceptional compared with the right reference?

V1 keeps those responsibilities separate so Excel/JSON import can stay factual while scoring rules can evolve through versioned configuration.

## Locked Product Decisions

- Store target achievement is scored against the store's own target.
- Store `CR`, `ATV`, and `UPT` are scored against the same-period Turkey average.
- Personnel target achievement is scored against an approved personnel target.
- Personnel `ATV` and `UPT` are scored against the same-period Turkey personnel average.
- Checklist scores are not benchmarked against Turkey average.
- Higher value is better for the active V1 performance metrics:
  - target achievement
  - `CR`
  - `ATV`
  - `UPT`
  - checklist score
- Benchmark scoring uses a V1 cap of `120%`.
- The actual uncapped ratio must always be stored and shown.
- The capped ratio is used only for score contribution.
- Cap ratio must be configurable later.
- Missing targets or benchmarks must not produce fake scores.
- Store and personnel historical snapshots must remain anchored to the scoring config version used when they were produced.

## Current State

Existing foundations:

- KPI data is imported into normalized metrics rather than being scored directly from raw file rows.
- Store canonical metrics already include `NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`, `ATV`, `UPT`, `CR`, and `TARGET_ACHIEVEMENT`.
- Store `ATV`, `UPT`, and `CR` are derived from base totals:
  - `ATV = total sales amount / total invoice count`
  - `UPT = total item count / total invoice count`
  - `CR = total invoice count / total FF * 100`
- Personnel Excel import treats positive sales as personnel gross sales.
- Personnel negative sales rows are not deducted from personnel performance; they are evidence for store net/reconciliation.
- KPI config versioning exists as the correct place to anchor changing rules.
- Checklist visit scoring has a separate design and will feed monthly store score as a small component.

Existing gap:

- The project needs an explicit scoring contract for "how does the system know what is high or low?"
- Benchmark ratios, caps, missing reference behavior, and user-facing explanations need to be made first-class.

## Scoring Philosophy

Raw KPI values are not self-explanatory.

Example:

```text
UPT = 3.50
```

This is good only if the relevant benchmark is lower than `3.50`. If the same-period Turkey average is `3.00`, the result is strong. If the average is `4.00`, it is weak.

Therefore every scored metric needs:

- a metric code
- a direction
- a benchmark source
- a weight
- an optional cap
- a missing-reference policy

## Metric Direction

V1 active metrics are `HIGHER_IS_BETTER`.

Config shape should support future directions:

```text
HIGHER_IS_BETTER
LOWER_IS_BETTER
TARGET_BAND
```

V1 only activates `HIGHER_IS_BETTER`.

Future examples:

- Return rate may be `LOWER_IS_BETTER`.
- Stock health may become `TARGET_BAND`.

## Benchmark Sources

### Store Metrics

| Metric | Benchmark source |
| --- | --- |
| `TARGET_ACHIEVEMENT` | Store's own target |
| `CR` | Same-period Turkey store average |
| `ATV` | Same-period Turkey store average |
| `UPT` | Same-period Turkey store average |
| `BM_CHECKLIST` | Checklist score, no Turkey benchmark |
| `VM_CHECKLIST` | Future checklist score, no Turkey benchmark |

### Personnel Metrics

| Metric | Benchmark source |
| --- | --- |
| `TARGET_ACHIEVEMENT` | Approved personnel target |
| `ATV` | Same-period Turkey personnel average |
| `UPT` | Same-period Turkey personnel average |

Personnel target flow:

1. Store manager enters personnel target.
2. Region manager approves the target.
3. HR admin can see missing, draft, or unapproved targets.
4. Only approved targets can score personnel target achievement.

## Same-Period Rule

Benchmarks must be calculated for the same period as the uploaded/evaluated KPI window.

Examples:

```text
1 March upload:
  benchmark = Turkey average for 1 March

1-4 March upload:
  benchmark = Turkey average for 1-4 March

March monthly snapshot:
  benchmark = Turkey average for 1-31 March
```

The system must not compare a single day against a full-month average unless the business explicitly chooses that later.

## Ratio Metrics Must Use Weighted Totals

Ratio metrics must not be averaged by averaging daily ratios.

Correct formulas:

```text
ATV = total sales amount / total invoice count
UPT = total item count / total invoice count
CR = total invoice count / total FF * 100
```

Example:

```text
1 March UPT = 3.11
2 March UPT = 2.33
```

The two-day UPT is not `(3.11 + 2.33) / 2`.

It must be:

```text
total item count across both days / total invoice count across both days
```

## Benchmark Ratio Formula

For `HIGHER_IS_BETTER` metrics:

```text
actualRatio = entityMetricValue / benchmarkMetricValue
scoredRatio = min(actualRatio, capRatio)
scoreContribution = metricWeight * scoredRatio
```

Example:

```text
Turkey UPT average = 3.00
Store UPT = 3.30

actualRatio = 3.30 / 3.00 = 1.10
scoredRatio = 1.10
scoreContribution = metricWeight * 1.10
```

Cap example:

```text
Turkey UPT average = 3.00
Store UPT = 4.44

actualRatio = 1.48
scoredRatio = 1.20
isCapped = true
scoreContribution = metricWeight * 1.20
```

## Target Achievement Formula

Store target achievement uses store net sales:

```text
actualRatio = storeNetSales / storeTarget
scoredRatio = min(actualRatio, capRatio)
scoreContribution = metricWeight * scoredRatio
```

Personnel target achievement uses personnel positive gross sales and only approved targets:

```text
actualRatio = personnelGrossSales / approvedPersonnelTarget
scoredRatio = min(actualRatio, capRatio)
scoreContribution = metricWeight * scoredRatio
```

If the target is missing or not approved, the metric becomes `missing_reference`.

## Score Scale

V1 treats the score as a performance index, not a hard `0-100` ceiling.

Because capped ratios can go up to `120%`, a metric can contribute up to `120%` of its nominal weight.

Example:

```text
UPT weight = 15
UPT scoredRatio = 1.20
UPT contribution = 18
```

This is intentional: above-benchmark performance is rewarded, but only up to the configured cap.

If a UI surface needs a progress bar, it can visually cap the bar at `100%` while still showing the actual performance index and `120%+` cap explanation.

## Cap Rule

V1 cap:

```text
capRatio = 1.20
```

Meaning:

- The real performance ratio remains visible.
- Score contribution is calculated at a maximum of `120%`.
- Strong performance is still recognized.
- One extreme metric cannot dominate the full score.

Required output fields for each scored metric:

```text
actualValue
benchmarkValue
actualRatio
scoredRatio
capRatio
isCapped
scoreContribution
weight
```

Display rule:

```text
Actual ratio: 148%
Score contribution: calculated with 120% cap
Short badge: 120%+
```

Do not display only `120%` when the real ratio is higher. That hides the user's real success and creates distrust.

## Missing Reference Policy

The system must not invent scores when required references are missing.

Missing examples:

- store target missing
- approved personnel target missing
- Turkey benchmark cannot be calculated because denominator is zero
- enough source data is not available for that period
- checklist was not completed for a period where checklist is optional

V1 behavior:

- Mark metric as `missing_reference`.
- Do not calculate a score contribution for that metric.
- Expose missing reason in the API/UI.
- Use coverage/confidence metadata so users understand whether a score is complete or partial.

Checklist exception:

- If BM checklist is not completed in the month, the store is not penalized in V1.
- UI should show `bu donem skora dahil edilmedi`.
- Remaining KPI components are normalized for that period.

## Store Score V1

The current business decision for BM checklist integration:

```text
KPI performance = 95%
BM checklist = 5%
```

Future VM checklist direction:

```text
KPI performance = 90%
BM checklist = 5%
VM checklist = 5%
```

V1 must not let an inactive VM checklist silently reduce store score. VM is future capacity, not active scoring debt.

Recommended V1 store KPI component structure:

```text
TARGET_ACHIEVEMENT
CR
ATV
UPT
```

The inner KPI metric weights can stay config-managed. The outer monthly store score layer applies the active checklist blend.

BM checklist contribution:

```text
bmChecklistRatio = monthlyBmChecklistScore / 100
bmChecklistContribution = bmChecklistWeight * bmChecklistRatio
```

Checklist contribution is not benchmarked against Turkey average and does not receive the `120%` benchmark cap.

## Personnel Score V1

Personnel V1 uses:

```text
TARGET_ACHIEVEMENT
ATV
UPT
```

Rules:

- Target achievement requires an approved personnel target.
- `ATV` and `UPT` use same-period Turkey personnel averages.
- Personnel sales uses positive gross sales.
- Negative return/exchange rows are not deducted from personnel score.
- If target is missing/unapproved, target achievement must be marked missing rather than fabricated.

## User-Facing Explanation

Every score surface should be able to answer:

- What was my value?
- What was the Turkey average or target?
- What was my ratio?
- Was the ratio capped for scoring?
- Which metric contributed how many points?
- Which metric is missing and why?

Example copy:

```text
UPT: 4.44
Turkey average: 3.00
Performance: 148%
Score limit: 120%+
```

Detailed explanation:

```text
This metric is 148% of the same-period Turkey average. Score contribution is calculated with the 120% cap.
```

## Data Flow

```text
Excel/JSON import
  -> staging evidence
  -> normalized KPI facts
  -> same-period benchmark calculation
  -> scoring config version resolution
  -> metric-level score contributions
  -> store/personnel snapshot
  -> UI explanation
```

## Backend Component Boundaries

Implementation should keep these responsibilities separate:

- Import service: parse and normalize incoming files/data.
- KPI metric repository: store and read normalized KPI facts.
- Benchmark calculator: calculate same-period Turkey averages using correct weighted formulas.
- Scoring engine: apply direction, benchmark ratio, cap, and weights.
- Snapshot service: persist scored outputs and anchor config version.
- API DTO layer: expose score breakdown, missing references, and cap metadata.

Do not put score formulas in the frontend.

## Config Contract Needs

The KPI config payload should eventually include per metric:

```text
metricCode
weight
direction
benchmarkSource
capRatio
missingReferencePolicy
activeFrom
activeTo
```

V1 can use the existing config surface if the implementation is kept backward-compatible, but the behavior above should become explicit in contracts/tests.

## Error And Edge Cases

### Benchmark denominator is zero

If Turkey benchmark denominator is zero:

- metric becomes `missing_reference`
- no contribution is calculated
- reason: `benchmark_denominator_zero`

### Entity denominator is zero

If entity denominator is zero:

- the metric value may be absent or zero depending on the metric
- score contribution must not pretend precision
- reason should explain the missing denominator

### Benchmark missing

If no same-period benchmark can be calculated:

- metric becomes `missing_reference`
- user-facing score is partial

### Extreme high value

If actual ratio exceeds cap:

- keep actual ratio
- set `isCapped = true`
- score with cap ratio
- show `120%+` or explanatory text

### Re-upload

Same source/period/scope/metric re-upload must update/replace the same facts and must not double-count.

## Audit And Lineage

Every scored snapshot should be traceable to:

- source import batch
- period start/end
- normalized metric facts
- benchmark values used
- KPI config version
- score calculation timestamp
- missing reference reasons
- cap metadata

This is required for later HR/admin questions such as:

> Why did this store receive this score in March?

## Out Of Scope

V1 does not implement:

- region-specific benchmarks
- store-type-specific benchmarks
- percentile scoring
- manual benchmark override UI
- anti-gaming/anomaly workflow
- return-rate scoring
- target-band metrics
- VM checklist scoring until VM checklist is active
- changing historical scores when rules change

## Testing Plan

Unit tests should cover:

- `HIGHER_IS_BETTER` ratio scoring
- `120%` cap behavior
- actual ratio preserved when capped
- score contribution uses capped ratio
- missing benchmark produces `missing_reference`
- missing approved personnel target does not fabricate score
- store target achievement uses store target
- personnel target achievement uses approved personnel target
- checklist missing does not penalize V1 store score

Integration tests should cover:

- one-day upload uses one-day Turkey benchmark
- multi-day upload uses same multi-day Turkey benchmark
- `ATV`, `UPT`, and `CR` use weighted totals, not averaged ratios
- re-upload does not double count
- snapshot anchors KPI config version

Frontend/API tests should cover:

- capped metric displays real ratio plus cap explanation
- missing reference displays reason
- score breakdown shows contribution by metric
- checklist missing displays `bu donem skora dahil edilmedi`

## CODEX Durust Yorum

This is the right moment to define the scoring contract. The project already has enough import, KPI, snapshot, and config foundation to support this cleanly, but the score engine must not be allowed to become an invisible formula hidden across services.

The key risk is not PostgreSQL or NestJS. The key risk is business trust: users must believe the score. That requires showing the reference, cap, missing data, and contribution details.

The V1 design is intentionally conservative:

- Turkey-average benchmark keeps the first model understandable.
- `120%` cap prevents one extreme metric from distorting rankings.
- Actual ratios remain visible, so high performers are not hidden.
- Missing references are explicit, not silently treated as zero.
- Checklist remains a small monthly component.

This is a solid base. Later we can add region/store-type benchmarks, percentile models, or special campaign scoring without rebuilding the whole platform.

## Next Step

After this design is reviewed, create an implementation plan for:

1. Benchmark scoring contract and tests.
2. Same-period Turkey benchmark calculation.
3. Metric-level cap/missing-reference output.
4. Personnel target approval scoring hook.
5. Store monthly checklist blend hook.
