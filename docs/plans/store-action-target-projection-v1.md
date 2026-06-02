# Store Action Target Projection V1

Status: decision locked, implementation pending
Shelf: Store Action

## Reader And Action

Reader:

- an engineer or future agent adding KPI-derived Store Action behavior,
  target-achievement task generation, projection calendar support, Store Tasks
  UI, region-manager rollups, or action-effect reporting.

After reading, they should know when target-achievement projection work may
produce a Store Action task, what data it must use, how the store manager
closes it, and how the system reads the before/after outcome.

## Decision

`TARGET_ACHIEVEMENT` Store Action tasks are generated from **month-end target
projection risk**, not from raw daily target drift.

V1 rule:

```text
Do not create KPI Store Action tasks from raw daily KPI values.
For TARGET_ACHIEVEMENT, create task candidates only when the projection
calendar is ready, the weighted projection confidence gate has passed, and the
month-end achievement projection falls below the action threshold.
```

This means:

- Monthly store/personnel target remains the fixed target source.
- Daily sales data updates the projection signal.
- The task trigger is the month-end projection, not one weak day.
- `ATV` and `UPT` remain warning/coaching signals in V1; they do not create
  Store Action tasks.
- `CR` may use the same projection/trend family later, but is not the first V1
  implementation target.
- `BM_CHECKLIST` and `VM_CHECKLIST` do not create target-projection tasks; low
  checklist findings use the separate checklist remediation decision.

## Source Boundary

Approved V1 product source:

```text
TARGET_ACHIEVEMENT month-end projection risk
```

Allowed first contract path:

```text
sourceType: kpi_exception
reasonType: target_projection_risk
```

Future cleaner contract, if introduced by a separate API/schema PR:

```text
sourceType: target_projection
```

Do not implement this by reinterpreting target distribution approvals, missing
target setup, stale target references, or target coverage rows. Those remain
target-domain workflow/state problems, not target-projection action tasks.

## Projection Calendar

Projection uses a weighted sales-potential calendar. It must not use plain
calendar-day progress such as "day 10 equals one third of the month".

The system can generate weekday/weekend structure automatically from dates, but
business-specific selling days must be supplied by a calendar config or import.

Calendar day examples:

| Day Type | Example Weight Meaning |
| --- | --- |
| Monday/Tuesday | lower weekday potential |
| Friday | higher weekday potential |
| Saturday/Sunday | weekend sales potential |
| official holiday | country holiday potential |
| eve/arife | company-specific high potential |
| campaign day | company-specific high potential |
| closed store day | zero potential |

Task generation requires:

```text
projectionCalendarStatus = ready
```

If the calendar is not ready:

- Store/me, Store KPIs, or Store Tasks may show a low-confidence projection
  signal.
- Automatic Store Action task creation must stay disabled.
- UI copy must be honest that the projection calendar is not ready.

## Weighted Progress And Confidence Gate

Each day receives a sales-potential weight. The monthly total is the sum of
all day weights.

Example:

```text
May total weight = 38.3
Day weight unit = monthly target / 38.3
```

The weighted progress gate is not store sales progress. It is the amount of
the month's sales-potential calendar that has elapsed.

V1 confidence rule:

```text
Do not create a Store Action task until at least 40% of the month's weighted
sales potential has elapsed on the calendar.
```

Meaning:

- This does not wait for the store to sell 40% of its target.
- It waits until enough weighted selling opportunity has happened to trust the
  projection enough for an operational task.
- The exact calendar day can vary by month because weekends, holidays, arife,
  campaigns, and closed days change the elapsed weighted potential.

## Projection Bands

After the confidence gate passes:

| Month-End Projection | Product State | Store Action Behavior |
| --- | --- | --- |
| `>= 95%` | On target rhythm | no task |
| `90% - 95%` | Watching | signal only |
| `80% - 90%` | Task candidate | normal priority |
| `< 80%` | Critical projection | high priority |

The projection signal can update daily from the first day of the month. The
task gate only controls when automatic Store Action task creation may begin.

## Remaining Calendar Potential

The first 40% and remaining 60% of a month can have very different commercial
character. The task language and priority must account for remaining calendar
potential.

V1 read model should classify the remaining period:

| Remaining Potential | Product Meaning | Copy Direction |
| --- | --- | --- |
| high | strong sales opportunity remains | opportunity-focused action |
| normal | normal recovery window | standard projection action |
| low | recovery window is narrow | risk-focused action |

Examples:

```text
Projection is below target, but the remaining period includes high-potential
holiday and weekend days. Focus the action plan on the upcoming sales window.
```

```text
Projection is below target and remaining sales potential is limited. Recovery
window is narrowing.
```

This does not change score math. It makes the task explanation fairer.

## Duplicate And Lifecycle Rules

For one store, one month, and one target-projection source:

- only one active Store Action task may exist,
- daily projection updates must not create duplicate tasks,
- an active task may show the latest projection evidence,
- closing a task does not mean the target is fixed,
- closing a task means the store manager reported an intervention.

If the same month remains weak after the task closes, do not automatically open
another V1 task for the same source. Show the closed action and current
projection together instead.

## Store Manager Resolution

The store manager resolves a target-projection task by reporting the action
taken, not by proving the target has been reached.

Allowed V1 actions:

- inspect baseline projection evidence,
- update status to `in_progress` or `blocked`,
- close with a required resolution note,
- cancel with a required reason when the task is invalid.

Closure meaning:

```text
The store manager reported an intervention against the projection risk.
```

Closure does not mean:

```text
The target problem is solved.
```

Example resolution note:

```text
Weekend staffing was reinforced and daily target follow-up was added to team
briefings.
```

## Action Effect Reading

Task closure is not a success metric. Effect is measured by comparing baseline
projection, post-action projection, and final month-end achievement.

Capture or derive:

- baseline projection rate,
- baseline projected amount,
- baseline captured date,
- task closed date,
- resolution note,
- post-action projection rate,
- post-action measured date,
- final achievement rate,
- final delta.

Use cautious language because the system does not prove causality.

During the month:

| State | Allowed Language |
| --- | --- |
| projection improved | `Projeksiyon iyilesti` |
| projection returned to safe band | `Hedef ritmine dondu` |
| no meaningful change | `Anlamli degisim yok` |
| projection worsened | `Projeksiyon geriledi` |
| insufficient data | `Olcum icin veri yetersiz` |

After month close:

| Result | Allowed Language |
| --- | --- |
| final achievement over target | `Hedef asildi` |
| final achievement at target | `Hedefe ulasildi` |
| final improved but missed target | `Toparlanma saglandi, hedef kacti` |
| final missed without meaningful recovery | `Hedef kacti` |
| final worse than baseline projection | `Kapanis projeksiyonun altinda kaldi` |
| missing final data | `Sonuc olculemedi` |

Do not use after month close:

```text
Risk devam ediyor
```

Risk is a forward-looking period-in-progress concept. After the month closes,
the product should speak in result language.

Do not claim:

```text
This action increased sales.
```

Use:

```text
Action sonrasi projeksiyon degisimi
```

## Region Manager View

Region managers should not receive a noisy list of every projection signal.
They need a compact rollup.

Useful V1 rollup:

- stores below 90% projection,
- stores below 80% critical projection,
- stores with action reported,
- stores with action reported but final result missed,
- stores with high remaining calendar potential,
- stores with narrow recovery window.

Region manager copy should distinguish:

```text
Store reported action
```

from:

```text
Target recovered
```

No region-manager approval or verification is included in V1.

## Non-Goals

V1 does not include:

- task creation before projection calendar is ready,
- task creation from raw daily KPI values,
- task creation from ATV or UPT,
- automatic target approval or target revision behavior,
- target distribution workflow changes,
- region-manager approval/verification,
- photo/file evidence,
- AI-written coaching recommendations,
- claims that an action caused sales improvement,
- generic workflow engine or generic rules engine.

## Implementation Guardrails

Before runtime code changes, an implementation PR must define:

- projection calendar source and ready status,
- weighted day model and remaining-potential classification,
- target source for store and personnel monthly targets,
- daily sales source,
- projection source reference shape,
- duplicate active task key,
- action-scope behavior for store managers,
- region-manager read-scope behavior,
- OpenAPI/generated client impact,
- audit event names,
- rollback story.

Stop if any of these require product decisions not recorded here:

- store-specific vs company-wide day weights,
- arife/holiday/campaign calendar source ownership,
- personnel-level target projection task ownership,
- CR projection promotion,
- region-manager verification workflow.

## Verification Expectations

The first implementation PR must include targeted coverage for:

- no task when projection calendar is not ready,
- no task before weighted 40% confidence gate,
- no task when projection is at least 90%,
- normal-priority task when projection is 80% to 90%,
- high-priority task when projection is below 80%,
- no duplicate active task for the same store/month/source,
- task closure requires resolution note,
- closed task does not claim the target was fixed,
- after-month-close copy uses result language, not risk language,
- existing KPI exception and checklist remediation boundaries are unchanged.
