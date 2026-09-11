# HR Axis Calendar — approved standard

Status: locked by product owner, 10 September 2026.

The owner approved the KPI calendar and requested the same calendar throughout
the project. All date and reporting-period pickers use this shared surface.

## Canonical implementation

- `admin-web/src/components/ui/calendar.tsx`: shadcn / React DayPicker primitive.
- `admin-web/src/components/ui/calendar.css`: approved visual tokens and native
  button reset. Geist Variable, white surface, 36px cells, compact typography.
- `admin-web/src/components/ui/calendar-picker.tsx`: single date, inclusive range,
  month selection, shared popover with 12px screen margins, and Apply/clear actions.
- `admin-web/src/components/ui/calendar-input.tsx`: native form adapter used by
  `Input` for date, month and datetime-local values. Native validation, keyboard
  entry, refs, form submission and change events stay intact; calendar selection
  preserves the time portion of datetime-local values.
- Feature period pickers are adapters only. They retain URL, period formatting,
  callbacks and permissions, and must not define a second calendar design.

## Locked visual and interaction rules

1. White background; unselected days have no gray tile fill.
2. Geist Variable; month/year dropdowns; Monday-first TR/EN localization.
3. Inclusive ranges have a continuous pale blue band `#edf4ff`. Endpoints use
   `#cfe0fb` and readable ink `#254d88`. Do not use solid dark endpoint fills.
4. After a completed range, the first click starts a new range and the second
   finishes it. The same date may be selected twice for a single-day range.
5. All twelve months and all dates are available in reporting filters, including
   months/days without data. Keep the selected period and show the feature's
   honest empty state; do not silently substitute the latest available data.
6. Year bounds and existing server range-size limits may remain. Explicit form
   constraints (such as a hire date not later than today) remain business rules;
   they are not data-availability filters and must not be removed for styling.
7. Apply commits the draft; dismiss/Escape cancels it. Month-only reports keep
   month semantics. A calendar appearance change does not grant a report daily
   or range aggregation it does not support.
8. Existing scheduling/event workspaces retain their visit records, week actions,
   status indicators and data semantics. Their date-filter controls use this
   standard; a planner is not replaced by a date picker.

New non-incentive pages must reuse the shared components. Do not add native
calendar popups, new month-button grids or another date-picker dependency.
The KPI workspace migrates in the immediately following KPI presentation slice,
which also owns its range-query state. The Primler workspace remains parked with
its own unmerged product change set. Visual changes to this standard require a
new explicit owner design request, not per-page restyling.

## Verification and rollback

The calendar-standard script test guards implementation ownership and native
input routing. Browser contracts cover inclusive range replacement, month
selection, empty dates, mobile margins and real form change/validation behavior.
Review desktop and mobile screenshots when modifying the shared surface.

This standard is a UI contract; it does not change API/auth/DB/scoring contracts.
Rollback the shared surface and feature adapters together, preserving unrelated
KPI range aggregation and approved demo data.
