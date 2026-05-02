# Daily Closure Ranking Strategy

## Purpose

Define the product and data rules for closed daily/monthly personnel ranking before implementation starts.

This strategy turns live KPI/performance data into trustworthy historical ranking surfaces.

## Product Goal

Users should be able to answer:

- where was I ranked on a selected closed day?
- where am I ranked this month based on closed days so far?
- why is my rank there?
- which KPI metrics are strong or weak compared with my store and Turkey-wide peers?

The core product promise is not only "show a score"; it is "explain the score and rank clearly enough that a person knows what to improve."

## First Audience

Phase 1 focuses on:

- `STORE_PERSONNEL`
- `STORE_MANAGER`

### Store Personnel

Personnel can see:

- own daily closed rank
- own month-to-date closed rank
- store rank
- Turkey-wide rank
- KPI-level mini ranks
- data coverage such as `25/27 days`

### Store Manager

Store managers can see:

- closed daily personnel ranking for their assigned store
- month-to-date closed personnel ranking for their assigned store
- each personnel row's Turkey-wide rank summary
- data coverage and eligibility state for each person

### Later Audiences

Later phases can add:

- `REGION_MANAGER`
- `SUPER_ADMIN`
- executive views

Region ranking is intentionally not part of the first ranking phase because the user wants future region leagues, tournaments, and challenges. That should become a separate `challenge / league / tournament` domain instead of being hidden inside a plain ranking read model.

## Time Model

The feature supports two time modes:

### Daily

The user selects a closed day.

Behavior:

- if the day is closed, show the frozen daily rank
- if the day is not closed, show a clear not-closed state
- if the person has no performance row for that day, show no-data for that person

Daily ranking never treats missing data as zero score.

### Monthly

The user selects a month.

Monthly ranking is calculated from closed days within that month so far.

Behavior:

- the month does not need to be fully closed
- today is excluded until its daily closure completes
- each newly closed day joins the month-to-date calculation
- monthly ranking is based on reliable closed data, not mutable live state

Example:

- April has 27 closed days so far
- a person has performance rows on 25 of those days
- display coverage as `25/27 days`

## Ranking Scope

Phase 1 ranking scopes:

- store rank
- Turkey-wide rank

Not included in Phase 1:

- region rank
- league rank
- tournament rank
- challenge rank

Reason:

- store and Turkey-wide ranking are direct performance surfaces
- region leagues/tournaments need season, grouping, scoring, eligibility, challenge rules, and reward semantics

## Primary Ranking Score

Primary leaderboard order uses the current weighted total score.

This score is the personnel's main performance score.

Rules:

- daily rank uses that day's closed weighted total score
- monthly rank uses an aggregate of closed daily weighted total score
- higher score ranks better
- ties should have deterministic handling during implementation

Recommended monthly aggregate:

- primary sort: average closed-day total score
- secondary display: total sales and other totals where useful

Reason:

- average score is fairer when people have different numbers of valid performance days
- total values still matter, but they should not silently punish people for missing data, leave, assignment gaps, or import gaps

## KPI-Level Mini Ranking

The detail view should show mini ranks for important KPI metrics in addition to the primary weighted score.

Examples:

- UPT store rank
- UPT Turkey rank
- ATV store rank
- ATV Turkey rank
- target achievement store rank
- target achievement Turkey rank
- net sales store rank
- net sales Turkey rank

Purpose:

- explain why a person is ranked where they are
- show strengths and weaknesses
- help store managers coach personnel

Example interpretation:

- total score is good
- UPT rank is strong
- ATV rank is weak
- next action is basket-size coaching

## Eligibility Rules

### Daily Eligibility

A person is included in a selected daily ranking only if:

- the selected day is closed
- the person has a closed performance row for that day

If no row exists:

- do not rank the person
- do not treat missing data as zero
- show "no performance data for this date" in the UI

### Monthly Eligibility

A person is officially included in monthly ranking only when:

- `daysWithPerformance >= 3`

If a person has fewer than 3 closed performance days:

- show the person's own preview card if possible
- do not assign official monthly store/Turkey rank
- show how many more closed performance days are needed

Example:

- `0/27 days`: no closed performance data
- `2/27 days`: preview only, 1 more day needed for official ranking
- `25/27 days`: eligible for official monthly ranking

## Data Coverage

Every monthly ranking row should expose data coverage.

Recommended fields:

- `closedDaysInPeriod`
- `daysWithPerformance`
- `minimumRequiredDays`
- `isEligibleForRanking`

Recommended UI labels:

- `25/27 days`
- `eligible for monthly ranking`
- `2/27 days, 1 more day needed`

Future enhancement:

- `workedDays`
- `missingDataDays`
- `workedButNoPerformanceDataDays`

These require shift/timekeeping or HR attendance integration and should not be guessed in Phase 1.

## Missing Data Rules

Missing performance data is not zero performance.

Reasons a person may have no row:

- day off
- store assignment gap
- new hire
- import delay
- source system missing row
- person not eligible for that metric

Rules:

- do not punish missing rows by assigning zero score
- do not include missing rows in monthly averages
- expose coverage so users understand confidence
- later, add data-quality diagnostics if needed

## Data Ownership

Closed ranking should read from closed/snapshot-oriented data, not mutable live rows.

Expected ownership:

- `ops`: operational source state and assignments
- `stg`: imported raw/source data
- `rpt`: closed daily/monthly ranking read models and immutable historical views
- `audit`: closure run and recompute events

Closed ranking should not overwrite historical truth silently.

If recomputation is needed:

- create an explicit rerun/recompute event
- preserve audit trail
- explain why historical output changed

## Permission And Scope Rules

### Store Personnel

Can read:

- own closed daily/monthly performance
- own store rank
- own Turkey rank
- own KPI mini ranks

Cannot read:

- other personnel detail rows
- other store personnel lists

### Store Manager

Can read:

- closed personnel ranking for assigned action stores
- personnel rows for their assigned store
- Turkey rank summary for personnel in their store

Cannot read:

- unmanaged store personnel lists
- cross-store details unless scope allows it in a later phase

### Region/Admin Later

Do not build first-phase backend behavior around region tournament needs.

Record those needs separately under future challenge/league/tournament work.

## UI Surface

Expected first surfaces:

- `/store/me`
- `/store/rankings`
- store manager ranking view inside store shell

Controls:

- mode switch: daily / monthly
- date picker for daily
- month picker for monthly
- store/Turkey rank cards
- KPI mini-rank detail section
- coverage label
- empty/not-closed/no-data states

## Empty And Edge States

Required states:

- selected day is not closed
- selected day has no performance row for the user
- selected month has no closed days
- selected month has fewer than 3 user performance days
- user has no assigned/current store
- store manager has no assigned action store
- ranking exists but KPI mini-rank is missing for a metric

## Future Challenge / League Direction

The user wants future region leagues and tournaments such as Marmara vs Karadeniz.

This is a separate future module, not plain regional ranking.

Future concepts:

- league season
- region/team grouping
- challenge period
- tournament rounds
- eligibility rules
- scoring model
- rewards/badges
- store-size/personnel-count normalization

This strategy should not block that future. It should provide stable closed performance facts that a future challenge module can consume.

## Implementation Shape

Implementation should probably be split into:

1. backend closed daily ranking read model
2. backend month-to-date closed ranking aggregation
3. KPI mini-rank calculation
4. scope-safe store manager/personnel API contracts
5. frontend daily/monthly controls and states
6. tests and release check

This document does not authorize immediate code changes by itself. The next step is an implementation plan.

## Verification Expectations

Minimum verification when implemented:

- daily closed rank works for a selected closed date
- unclosed date returns not-closed state
- missing daily row does not rank the person
- monthly rank uses closed days only
- monthly rank excludes today until closure completes
- monthly rank requires at least 3 performance days for official ranking
- monthly preview works for 1-2 days
- coverage displays as `daysWithPerformance / closedDaysInPeriod`
- store manager cannot read an unassigned store
- store personnel cannot read another person's detail
- release check passes

## Current Decision

Agreed decisions:

- first audience: `STORE_PERSONNEL + STORE_MANAGER`
- first time modes: daily + monthly
- date navigation: users can select historical closed days/months
- ranking scopes: store + Turkey-wide
- primary score: current weighted total score
- KPI mini-ranks: store + Turkey-wide per metric
- monthly calculation: month-to-date from closed days only
- monthly eligibility: minimum 3 closed performance days
- missing data: excluded, not zero
- coverage: show `daysWithPerformance / closedDaysInPeriod`
- region leagues/tournaments: future separate module
