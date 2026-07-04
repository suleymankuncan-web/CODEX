# Store Me Performance Badge System V1

Status: locked
Owner surface: `/store/me`
Primary use: `Performans Kartı Oluştur` external share card
Related contract: `docs/prototypes/hr-axis-performance-share-card-v1.md`

## Purpose

This contract defines who can receive performance badges, where badges can
appear, when they are calculated, which badge wins when multiple badges are
eligible, and which data sources are allowed.

Badges are motivational UI signals. They are not incentive, payroll, promotion,
disciplinary, or official HR reward decisions.

## Scope

### In Scope

- Store Me performance share card.
- Future Store Me profile badge preview if implemented.
- Monthly personnel performance periods.
- Official KPI/ranking data already used by Store Me.
- Company store personnel and any Store Me profile with an official individual
  performance score and Turkey ranking.

### Out Of Scope

- Incentive/bonus entitlement.
- Salary or payroll logic.
- Checklist task generation.
- Store-level awards.
- Region-manager operational badges.
- Admin manual badge assignment.
- Badges based on engagement, login frequency, or app usage.
- Fake badges for missing data.

## Visibility

| Surface | V1 Behavior |
| --- | --- |
| Store Me share card | Shows exactly one main badge when eligible. |
| Store Me page | May show the same resolved badge later, but not required in V1. |
| Rankings page | No badge display in V1. |
| Store Home | No badge display in V1. |
| Admin pages | No badge assignment UI in V1. |

The share card must never show more than one main badge.

## Eligibility Gate

A profile is badge-eligible only when all conditions are true:

1. Selected period exists.
2. Performance score exists.
3. Turkey rank exists.
4. Turkey ranking population exists.
5. Employee display name exists.
6. Store name exists.
7. KPI/ranking source is not marked as missing, pending normalization, or
   unreliable for the selected period.

If any required value is missing, return `null` badge. Do not fallback to a
weaker badge just to fill the card.

## Period And Timing

Badges are resolved for the selected Store Me period.

| Period State | Badge Behavior |
| --- | --- |
| Closed monthly snapshot | Preferred source. Badge can be considered final for that period. |
| Live current month | Badge may be shown only if the page already trusts the live ranking data. UI should avoid language like "final". |
| Partial or missing data | No badge unless the specific badge rule can be proven from trusted data. |

V1 default recommendation:

- Use closed monthly data for external sharing when available.
- If only live data exists, allow preview only with current period language.
- Do not imply an official end-of-month award before the month is closed.

## Badge Resolution Contract

Resolver name suggestion:

```ts
resolveStoreMePerformanceBadge(input): PerformanceBadge | null
```

Resolver input must include:

- `periodKey`
- `score`
- `turkeyRank`
- `turkeyPopulation`
- `storeRank`
- `storePopulation`
- `regionRank`
- `regionPopulation`
- `targetAchievementPercent`
- `previousPeriodScore`
- `previousPeriodTurkeyRank`
- `currentPeriodDataQuality`

Resolver output:

```ts
type PerformanceBadge = {
  code: PerformanceBadgeCode
  label: string
  icon: PerformanceBadgeIcon
  tone: 'gold' | 'plum' | 'cyan' | 'mint' | 'neutral'
  reason: string
}
```

The `reason` is for internal/debug/evidence use only. It must not appear on the
external share card.

## Priority Order

If multiple badges are eligible, choose the first eligible badge in this order:

1. `TURKEY_1`
2. `TOP_1_PERCENT`
3. `STORE_LEADER`
4. `REGION_TOP_3`
5. `RISING_STAR`
6. `TARGET_ABOVE`
7. `CONSISTENT_PERFORMER`

No secondary badge is shown on the V1 share card.

## Badge Rules

### 1. `TURKEY_1`

Label:

```text
TÜRKİYE 1.'Sİ
```

Icon direction:

- trophy / crown-like achievement icon

Eligibility:

- `turkeyRank === 1`
- `turkeyPopulation >= 30`
- score exists

Notes:

- This is the highest-priority badge.
- It wins over every other badge.
- If `turkeyPopulation < 30`, do not show this badge in V1 because the ranking
  pool is too small for a national badge.

### 2. `TOP_1_PERCENT`

Label:

```text
İLK %1
```

Icon direction:

- medal / spark achievement icon

Eligibility:

- `turkeyRank > 1`
- `turkeyPopulation >= 100`
- percentile is `<= 1`

Percentile formula:

```text
ceil((turkeyRank / turkeyPopulation) * 100)
```

Examples:

- `#5 / 842` => `İlk %1`
- `#9 / 842` => `İlk %2`, not eligible for this badge

### 3. `STORE_LEADER`

Label:

```text
MAĞAZA LİDERİ
```

Icon direction:

- small crown / store-leader icon

Eligibility:

- `storeRank === 1`
- `storePopulation >= 2`
- score exists

Notes:

- If the employee is the only ranked person in the store, do not show
  `MAĞAZA LİDERİ`; single-person pools do not create a leadership badge in V1.
- If the employee is also `TURKEY_1` or `TOP_1_PERCENT`, the higher-priority
  national badge wins.

### 4. `REGION_TOP_3`

Label:

```text
BÖLGE İLK 3
```

Icon direction:

- medal / podium icon

Eligibility:

- `regionRank` is `1`, `2`, or `3`
- `regionPopulation >= 10`
- score exists

Notes:

- This badge is available even though the share card does not show region
  ranking as a separate field.
- It loses to `STORE_LEADER` if both are eligible.

### 5. `RISING_STAR`

Label:

```text
AYIN YÜKSELENİ
```

Icon direction:

- trending-up / spark icon

Eligibility:

- Previous period Turkey rank exists.
- Current Turkey rank exists.
- Current rank is better than previous rank by at least `20` positions, or
  by at least `15%` of the previous rank, whichever is easier to satisfy.
- Current score is not lower than previous score.
- Current score is at least `60`.

Formula:

```text
rankImprovement = previousPeriodTurkeyRank - turkeyRank
relativeImprovement = rankImprovement / previousPeriodTurkeyRank
eligible when rankImprovement >= 20 OR relativeImprovement >= 0.15
```

Notes:

- This badge should not reward score decline.
- If previous period rank is missing, this badge is not eligible.

### 6. `TARGET_ABOVE`

Label:

```text
HEDEF ÜSTÜ
```

Icon direction:

- target / check icon

Eligibility:

- `targetAchievementPercent >= 100`
- target data is trusted
- score exists

Notes:

- This badge is lower priority than ranking badges.
- Do not show target amount or revenue on the share card.
- The badge can be shown even though the actual target amount is hidden.

### 7. `CONSISTENT_PERFORMER`

Label:

```text
İSTİKRARLI PERFORMANS
```

Icon direction:

- shield-check / steady rhythm icon

Eligibility:

- At least 3 consecutive monthly periods exist.
- Score is `>= 70` in each of the last 3 periods.
- Current period score exists.
- No data-quality warning in those 3 periods.

Notes:

- This is the lowest-priority badge.
- Use only when the data can prove consistency.

## Percentile Display

The share card can show percentile independently of the selected badge.

Display:

```text
İlk %{percentile}
```

Formula:

```text
percentile = max(1, ceil((turkeyRank / turkeyPopulation) * 100))
```

Rules:

- If rank or population is missing, hide percentile.
- If population is `0`, hide percentile.
- Never show `İlk %0`.

## Tie And Equal Score Rules

Badge resolver must use the official ranking order returned by the backend.

Do not recalculate ranking tie-breakers in the frontend.

If two people have the same score and backend gives both the same rank:

- Respect the backend rank.
- If both have `storeRank === 1`, both may be eligible for `MAĞAZA LİDERİ`.
- Do not invent a secondary tie-breaker in the share card.

## Data Quality Rules

Do not award a badge from:

- missing KPI data
- missing ranking data
- pending normalization
- unmatched employee mapping
- placeholder/demo-only row
- stale period that is not the selected period
- frontend mock data

If a value is not present in the backend/view model, the frontend must not infer
it from visible labels.

## Copy Rules

All visible labels must be Turkish with correct characters:

- `TÜRKİYE 1.'Sİ`
- `İLK %1`
- `MAĞAZA LİDERİ`
- `BÖLGE İLK 3`
- `AYIN YÜKSELENİ`
- `HEDEF ÜSTÜ`
- `İSTİKRARLI PERFORMANS`

No mojibake is acceptable.

## Privacy Rules

Badges can be shared externally only with non-sensitive performance context.

Never expose:

- revenue
- sales amount
- target amount
- remaining target
- incentive/bonus
- salary
- employee code
- UUID/internal ID
- admin notes

## Example Outcomes

| Input | Badge |
| --- | --- |
| Turkey rank `1 / 842` | `TÜRKİYE 1.'Sİ` |
| Turkey rank `5 / 842`, store rank `1 / 4` | `İLK %1` |
| Turkey rank `24 / 842`, store rank `1 / 4` | `MAĞAZA LİDERİ` |
| Region rank `2 / 78`, store rank `3 / 7` | `BÖLGE İLK 3` |
| Previous Turkey rank `95`, current Turkey rank `60`, score did not fall | `AYIN YÜKSELENİ` |
| Target achievement `136%`, no stronger badge | `HEDEF ÜSTÜ` |
| Last 3 scores `74`, `76`, `72`, no stronger badge | `İSTİKRARLI PERFORMANS` |
| Missing Turkey rank | no badge |
| Store population `1`, store rank `1` | no `MAĞAZA LİDERİ` badge |

## Implementation Acceptance

Before production rollout:

- Unit-test the resolver with all badge examples above.
- Add long-name card screenshot coverage from the share-card contract.
- Verify Turkish labels render correctly.
- Verify only one badge appears on the share card.
- Verify missing data returns no badge.
- Verify frontend does not recalculate rank.
- Verify share card does not expose sensitive data.

## Stop Conditions

Stop implementation and ask for product decision if:

- Badge logic requires a backend rank field that does not exist.
- Current data cannot distinguish closed month from live month.
- Store manager versus personnel eligibility becomes ambiguous.
- Business wants multiple badges visible on the share card.
- Badge result is expected to affect incentives, payroll, or HR decisions.
