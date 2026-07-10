# Europe/Istanbul Business Date Contract V1

Status: approved
Shelf: active plan
Author: Codex
Owner: Product owner
Approved through: owner-approved `project-wide-audit-remediation-plan-v1.md`
Date: 2026-07-10
Review: local adversarial review; GitHub Codex review is owner-disabled
Target pull request: PR-5
Change type: frontend pure logic and regression evidence

## 1. Problem

Four audited frontend defaults derive a calendar date by slicing a UTC ISO
timestamp. Between 00:00 and 02:59 in Europe/Istanbul, that selects the prior
business day and can also select the prior month or year. The checklist page
also freezes its default date at module evaluation, so a later mount after
midnight can reuse yesterday's value from a long-lived tab.

Affected callers:

- Integration upload date and month defaults;
- competition draft start/end dates and generated date code;
- checklist-template effective date defaults;
- Store Approvals month, hire-date, and termination-date defaults.

UTC remains correct for timestamp instants such as audit/event timestamps. This
change is limited to date-only and month-only business calendar values.

## 2. Goals

- Introduce one named Europe/Istanbul business-calendar helper.
- Return deterministic `YYYY-MM-DD` and `YYYY-MM` values independent of the
  browser or test runner timezone.
- Perform date-only calendar arithmetic without converting the resulting date
  back through the host timezone.
- Compute defaults at component initialization or user action time.
- Preserve every API field name and date/month payload format.

## 3. Non-goals

- No backend, database, authorization, route, or API schema change.
- No conversion of UTC timestamp instants to local timestamps.
- No locale-library migration and no general rewrite of date formatting.
- No change to competition duration, checklist publishing, integration upload,
  target distribution, seller-code, or offboarding mutation semantics.
- No stored-data migration.

## 4. Contract

The shared helper owns the constant `Europe/Istanbul` and exposes pure functions
that accept an optional `Date` for deterministic tests:

```ts
type BusinessDateParts = {
  year: number
  month: number
  day: number
}

getBusinessDateParts(now?: Date): BusinessDateParts
getBusinessDateInputValue(now?: Date): string // YYYY-MM-DD
getBusinessMonthInputValue(now?: Date): string // YYYY-MM
addCalendarDaysToDateInput(value: string, days: number): string // YYYY-MM-DD
```

`getBusinessDateParts` MUST use `Intl.DateTimeFormat` with the named timezone
and `formatToParts`; correctness must not depend on locale-specific string
layout. `addCalendarDaysToDateInput` MUST validate a real date-only input and
use UTC only as an arithmetic container for its numeric year/month/day parts.
It does not represent an instant.

Invalid dates or non-integer offsets MUST fail explicitly rather than silently
normalizing into another date.

## 5. Caller Rules

### Integration defaults

The reducer initializer computes one business date at page initialization.
`powerBiPeriodMonth`, `powerBiPeriodStart`, and `powerBiPeriodEnd` derive from
that same captured instant so midnight cannot split the three fields.

### Competition draft

The draft builder runs when the create action executes. `startsOn` is the
current Istanbul business date, `endsOn` is exactly 14 calendar days after the
date-only start, and the generated code uses the same start value.

### Checklist template defaults

No module-level `today` constant is allowed. Both template drafts receive the
same Istanbul business date when component state initializes.

### Store Approvals defaults

Page-state creation captures one instant. Request month and date inputs derive
from that instant. Existing reset actions that create a new seller-code or
offboarding draft compute their date when the reset occurs, so a tab held open
across Istanbul midnight receives the new business date.

## 6. Acceptance Criteria

- At `2026-06-30T21:30:00.000Z` (2026-07-01 00:30 Istanbul), date is
  `2026-07-01` and month is `2026-07`.
- At the Istanbul new-year boundary, date and month advance to the new year.
- Competition end date crosses month/year boundaries without host-timezone
  drift and remains 14 calendar days after start.
- Integration, competition, checklist, and Store Approvals caller tests prove
  their defaults use the shared helper contract.
- A long-open Store Approvals state reset across midnight uses the new date.
- Turkish and English display formatting tests remain green; payload values are
  locale-independent.
- No audited caller contains `new Date().toISOString().slice(...)` for a
  business date default.
- Existing API payload fields remain `YYYY-MM-DD` or `YYYY-MM` exactly as before.

## 7. Verification

- Focused Vitest for the helper and four migrated caller families.
- Frontend lint and production build.
- Relevant integration, competition, checklist, and Store Approvals browser
  regression tests.
- Root script guards and one canonical release check.

## 8. Rollback

Revert helper adoption and caller tests together. No database or stored-data
rollback is required. If rollback restores UTC slicing, record the known
00:00-02:59 Europe/Istanbul correctness regression explicitly.
