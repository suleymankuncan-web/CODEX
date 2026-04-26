# Competition Format Registry V1 Design

> Status: Superseded on 26 April 2026 by `docs/superpowers/specs/2026-04-26-operational-feed-v1-design.md`.
>
> Reason: the immediate product need is not a second competition/ranking format engine. UPT-style challenges should first be represented as scoped operational feed posts that point to existing profile/ranking surfaces.

## Goal

Introduce a controlled competition format registry so HR/Admin users can plan more than one kind of competition package without turning the current stage package flow into a free-form builder too early.

V1 keeps the existing `league_then_final` package working and adds a first pilot format, `best_upt_store`, at plan/preview level only.

## Problem

The current stage package flow assumes one main structure: league stages followed by a final stage. That is useful, but the product direction is wider:

- region leagues and finals
- store-level challenges
- employee-level challenges
- single-metric contests such as UPT, ATV, CR, or HG%
- composite or total-score competitions
- category-specific contests, such as women's group sales, when the data exists
- long-running or custom-period competitions later

Adding each new format directly into the form would create scattered rules and make future changes risky. A registry gives each format a clear contract before it becomes executable.

## Recommended Approach

Use a code-owned `Competition Format Registry` in V1.

Each format is a typed definition with explicit capabilities:

- what participant type it supports
- which metric mode it uses
- which metrics it needs
- how it ranks participants
- which participant source it accepts
- which period model it uses
- whether it can be executed now
- what HR/Admin should see in preview
- what announcement defaults it carries for future publish behavior

Rejected alternatives:

- Small direct addition to the existing preset code: fastest, but it would make every future format a special case.
- Full database-backed format builder now: powerful, but too heavy before scoring, visibility, permissions, and approval rules are all stable.

## Registry Shape

The registry should be portable to a future database table, but V1 remains code-owned.

Recommended fields:

- `formatCode`
- `formatName`
- `description`
- `participantType`: `store`, `employee`, `region`, or `team`
- `metricMode`: `single`, `composite`, or `total_score`
- `metrics`
- `periodMode`
- `participantSource`
- `rankingDirection`: `higher_is_better`, with future room for `lower_is_better` and `closest_to_target`
- `stageBlueprints`
- `executeAllowed`
- `executeDisabledReason`
- `previewFields`
- `announcementDefaults`

The important rule is separation:

- A format may be selectable and previewable.
- A format is executable only when the matching score provider, participant source, and user-facing behavior are designed and verified.

## V1 Formats

### `league_then_final`

This remains the current executable package format.

Expected behavior:

- participant type: store/team package structure, based on existing implementation
- metric mode: total score
- period model: package stages with configured dates
- participant source: existing team/store template flow
- execute: allowed

### `best_upt_store`

This is the first registry pilot format.

Expected behavior:

- participant type: `store`
- metric mode: `single`
- metric: UPT
- ranking: higher UPT ranks higher
- period model: full competition `startsOn` / `endsOn`
- participant source: existing template/manual store selection path
- stage structure: one ranking stage for the selected period
- execute: disabled in V1

The HR/Admin user can select the format, set the dates, choose the participant template, and inspect a preview. The user cannot execute or publish this format yet.

The disabled state must be visible and intentional. Suggested copy:

> This format can be planned and previewed, but live execution is not enabled yet.

## Preview Requirements

For `best_upt_store`, the plan preview should show:

- format name
- metric: UPT
- date range
- participant template or selected store count
- ranking direction: highest UPT wins
- execution status: preview-only in V1

This lets HR/Admin verify the planned competition without implying that a live leaderboard or notification flow already exists.

## Future Format Extensibility

The registry must support future formats without redesigning the module.

Examples:

- `best_atv_store`: store contest by ATV
- `best_conversion_store`: store contest by CR
- `employee_upt_challenge`: employee contest by UPT
- `region_total_score_league`: region contest by total score
- `women_group_sales_store`: store contest by women's group sales
- `women_group_sales_employee`: employee contest by women's group sales

Category or product-group formats, such as women's group sales, are allowed by the registry model but depend on source data. If the import and score pipeline do not yet expose product-group sales, the format can be documented as a future candidate but must remain non-executable.

Required data for category-specific sales formats:

- product group or category key
- sales amount or quantity
- date
- store id
- employee id when the participant type is employee

## Employee Competition Readiness

The registry includes `employee` as a participant type, but V1 does not build employee scoring or employee-facing ranking.

Future employee formats must handle:

- minimum data-day rules
- visible data-day count
- missing-day behavior
- position or role scope
- store, region, or manual participant scope
- employee-facing active competition and self-rank surfaces

This keeps the contract honest: employee competitions are planned for the model, not silently delivered by the first store-level pilot.

## Publish And Notification Boundary

V1 does not publish `best_upt_store` to active participant screens.

Future publish behavior should support:

- active competition list
- participant-facing metric and date range
- ranking view
- publish announcement note
- notification or inbox event when a competition starts
- winner announcement when closed

Until those pieces are implemented, preview-only formats must not create participant-visible competition state.

## Backend Shape

The backend should expose registry metadata through the existing competition planning surface or a small dedicated read endpoint.

Execution must enforce `executeAllowed` server-side. Frontend disabling is not enough.

The existing executable package path should continue to work for `league_then_final`. Any non-executable format should return a controlled validation error if execution is attempted.

## Frontend Shape

The stage package planning UI should show a controlled format selector rather than a free-form builder.

For each selected format, the UI should derive:

- required inputs
- preview rows
- disabled execute messaging
- future announcement defaults where useful

The UI must avoid implying that preview-only formats are live competitions.

## Test Strategy

Backend tests:

- registry exposes both `league_then_final` and `best_upt_store`
- `league_then_final` remains executable
- `best_upt_store` execution is rejected with a controlled message
- unknown format codes are rejected

Frontend tests:

- format selector shows both formats
- `best_upt_store` preview shows UPT, date range, participant count, and preview-only status
- execute action is hidden or disabled for preview-only formats
- existing league-then-final Playwright flow still passes

Release checks remain the gate:

- backend `check:release`
- frontend `check:release`

## Non-Goals

- No database-backed format builder in V1.
- No user-facing active competition page for `best_upt_store` in V1.
- No live leaderboard for `best_upt_store` in V1.
- No notification or push behavior in V1.
- No category-specific sales format execution until source data and score providers exist.
- No employee competition execution until employee scoring and employee-facing ranking are designed.
