# Sales Target Incentive V1 Fixtures And Locked Decisions

Status: active fixture contract for Sales Target Incentive V1 PR-2 through PR-8.

Reader:

- engineer or agent implementing the incentive calculation, source binding,
  authorization, Store UI, Admin UI, correction, or period-close slices.

Action:

- use these fixtures as the first contract before adding calculation code,
  database tables, API DTOs, UI cards, corrections, or close workflows.

## PR-1 Locked Decisions

### Currency Precision

- All money math must use decimal arithmetic.
- JavaScript floating point arithmetic is forbidden for incentive money.
- Imported/source amounts keep the existing source precision.
- `rawEarnedAmount` stores the exact multiplication result with at least six
  decimal places.
- `payableAmount`, `finalAmount`, `correctionAmount`, and `adjustmentAmount`
  are payable TL amounts with exactly two decimal places.
- Sub-kurus outcomes are truncated toward zero to two decimal places.
- There is no rounding to whole TL, no smoothing, no cap, and no
  business-friendly uplift.

Examples:

| Raw result | Payable amount |
| ---: | ---: |
| `10000.000000` | `10000.00` |
| `1234.567899` | `1234.56` |
| `0.009999` | `0.00` |
| `-12.349999` | `-12.34` |

### Period, Cutoff, And Late Import Policy

- Canonical period key is `YYYY-MM`.
- Canonical timezone is `Europe/Istanbul`.
- A period starts at the first day of the month `00:00:00 Europe/Istanbul`.
- A period ends just before the first day of the next month
  `00:00:00 Europe/Istanbul`.
- Final close cannot run before the period ends.
- Automatic close is eligible to run from the first day of the next month
  `02:00:00 Europe/Istanbul`.
- `closeCutoffAt` is the actual close-run timestamp.
- Projection may use accepted same-period imports available at query time.
- Final close includes only accepted imports with source sales date/period in
  the incentive period and accepted at or before `closeCutoffAt`.
- Upload timestamp never assigns the incentive period.
- Imports accepted after a closed period do not rewrite final snapshots. They
  require explicit admin adjustment or an audited reclose decision.
- Missing or ambiguous source date/period produces `no_source` or `blocked`;
  it must not be inferred from upload time.

### Rule Version Binding

- Initial rule version code: `sales-target-incentive-v1.0.0`.
- Initial manager rate table version: `manager-sales-target-v1.0.0`.
- Initial personnel rate table version: `personnel-sales-target-v1.0.0`.
- Every projection response includes the rule version used for that projection.
- Every final snapshot persists the rule version and rate table version used at
  close.
- Closed snapshots do not recalculate when later rule versions or rate tables
  are introduced.

## Rate Fixtures

### Bracket Boundary Semantics

- Achievement is calculated with exact decimal arithmetic from
  `actual / target * 100`.
- Rate lookup must not round, floor, or truncate the achievement before
  choosing the bracket.
- Rate brackets are lower-bound inclusive and upper-bound exclusive.
- Display labels such as `80% - 84,9%` are not authoritative calculation
  boundaries.
- Example: `89.9600%` and `89.9999%` remain in the `>= 85.0000% and <
  90.0000%` bracket; only `90.0000%` moves to the next bracket.

### Store Manager

Store manager incentive uses store actual net sales only.

| Store achievement | Rate |
| --- | ---: |
| `< 80.0000%` | `0.0000` |
| `>= 80.0000% and < 85.0000%` | `0.0020` |
| `>= 85.0000% and < 90.0000%` | `0.0030` |
| `>= 90.0000% and < 95.0000%` | `0.0040` |
| `>= 95.0000% and < 100.0000%` | `0.0050` |
| `>= 100.0000% and < 110.0000%` | `0.0070` |
| `>= 110.0000%` | `0.0100` |

Confirmed example:

- Store target: `869565.217391`
- Store actual net sales: `1000000.00`
- Store achievement: `115.0000%`
- Rate: `0.0100`
- Raw earned amount: `10000.000000`
- Payable amount: `10000.00`

### Sales Personnel And Assistant Manager

Personnel incentive uses the seller's positive personnel gross sales only and
is gated by store achievement.

| Personal achievement | Rate |
| --- | ---: |
| `< 80.0000%` | `0.0000` |
| `>= 80.0000% and < 85.0000%` | `0.0050` |
| `>= 85.0000% and < 90.0000%` | `0.0050` |
| `>= 90.0000% and < 95.0000%` | `0.0065` |
| `>= 95.0000% and < 100.0000%` | `0.0075` |
| `>= 100.0000% and < 110.0000%` | `0.0150` |
| `>= 110.0000%` | `0.0165` |

Confirmed store-gate failure example:

- Store target: `6000000.00`
- Store actual net sales: `3750000.00`
- Store achievement: `62.5000%`
- Personnel target: `1500000.00`
- Personnel actual positive sales: `2000000.00`
- Personnel achievement: `133.3333%`
- Personal bracket rate before gate: `0.0165`
- Store gate: failed
- Raw earned amount: `0.000000`
- Payable amount: `0.00`

## Visibility And Source Fixtures

| Scenario | Expected state |
| --- | --- |
| Eligible company-store personnel | own `/store/me` projection only |
| `CASHIER` position | no V1 calculation, no API row, no UI/navigation signal |
| Franchise store | no V1 calculation, no API row, no UI/navigation signal |
| Operator store | no V1 calculation, no API row, no UI/navigation signal |
| Store manager | own manager incentive plus eligible personnel in own company store |
| Region manager | assigned company stores only |
| Super admin | all eligible company-store records plus admin controls |

Source binding:

- Manager calculation uses store net sales source rows.
- Personnel calculation uses positive personnel gross sales source rows.
- Negative personnel rows remain reconciliation evidence and do not reduce the
  original seller.
- Returns or exchanges accepted by another store affect that receiving store's
  net sales path, not the original seller's personnel-positive-sales path.

Approved target binding:

- Incentive calculation reads the existing approved target/revision state.
- An approved revision may have been approved by `REGION_MANAGER` or
  `SUPER_ADMIN`.
- Incentive calculation must not require a region-manager-specific approval
  when the target workflow has already approved the revision.

## Blocked And No-Source Fixtures

| Input condition | Expected state |
| --- | --- |
| Missing approved store target | store row `blocked`; close blocked |
| Store target `<= 0` | store row `blocked`; no division; close blocked |
| Missing approved personnel target | person row `blocked` |
| Personnel target `<= 0` | person row `blocked`; no division |
| Missing store sales import | projection `no_source`; close blocked |
| Missing personnel sales import with store source present | person row `no_source` |
| Valid zero store actual with valid target | achievement `0%`, rate `0`, amount `0.00` |
| Negative store net sales | negative achievement, manager rate `0`, personnel gate failed |
| Pending target revision at close | close blocked for the affected store/person |

## Transfer Fixture

V1 final calculation uses the latest approved assignment at period close:

- no worked-day proration,
- no split-period payout,
- no later-current-assignment recalculation after close,
- final close freezes the assignment snapshot used for the period.
