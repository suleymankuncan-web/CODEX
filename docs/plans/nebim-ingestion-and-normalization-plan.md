# Nebim Ingestion And Normalization Plan

## Purpose
Turn the Nebim V3 KPI feed into a stable live-performance model without over-preserving noisy intraday history.

## Confirmed Source Reality
- Nebim data will be pulled every `30 minutes`
- first pull target: `10:30`
- last pull target: `00:00`
- the feed should be treated as the latest current state, not as additive deltas
- returns and refunds must reduce the current sales truth
- seller code is the canonical personnel matching key

Example:
- `14:00` pull shows personnel net sales `30000`
- `14:30` pull shows personnel net sales `25000`
- the live system must now treat `25000` as the truth

## Core Modeling Decision
Use three layers:

1. `source batch metadata`
- one record per Nebim pull
- lightweight trace only

Poll cadence should stay config-driven per integration source:
- `poll_enabled`
- `poll_interval_minutes`
- `poll_window_start_local`
- `poll_window_end_local`
- `poll_timezone`

2. `current live state`
- latest valid value per personnel / store / KPI / period
- overwritten by the newest accepted pull

3. `daily closed snapshot`
- persisted end-of-day state for historical reporting
- used to reconstruct day / week / month filtered rankings and averages

Integration source foundation:
- source registration should stay source-agnostic
- each source can declare:
  - `source_system` such as `nebim_v3` or `power_bi`
  - `state_model` such as `latest_state` or `closed_period`

## What We Will Not Do
- do not store every intraday KPI row forever
- do not treat each pull as a permanent reporting snapshot
- do not add raw values together across pulls
- do not score blank-personnel rows as personnel performance

## Lightweight Trace Requirement
Even though we do not keep full intraday history, every accepted live row should still retain:
- `last_synced_at`
- `source_batch_id`
- `source_payload_hash`

This is the minimum debugging trail.

## Personnel Matching Rule
- each personnel record is matched by seller code
- seller code maps to a single personnel identity inside this platform
- personnel performance then rolls into store performance

Important:
- blank personnel rows from Nebim are ignored for personnel scoring
- store totals should not be inferred from these blank rows alone

## KPI Responsibility Rules

### Personnel-scoped KPIs
- `TARGET_ACHIEVEMENT`
- `ATV`
- `UPT`

### Store-scoped KPIs
- `CR`
- `BM_CHECKLIST`
- `VM_CHECKLIST`
- store aggregate score

Rule:
- `CR` is store-only
- it does not belong to personnel scoring

## Derived Metric Rules

### Target Achievement
Not provided by Nebim directly.

It will be computed inside this platform from:
- assigned target
- current net sales

Formula direction:
- `target achievement = current net sales / assigned target`

### Net Sales Truth
- live net sales must already reflect refunds / returns
- if refunds reduce a personnel's value, score and ranking must also drop

## Live Ranking Rule
- intraday leaderboard always uses the latest accepted live state
- if a new pull arrives, the ranking updates immediately

Examples:
- `13:00` view shows current truth at `13:00`
- `15:00` view shows the updated truth at `15:00`

## Historical Ranking Rule
When the user filters:
- day
- week
- month

The system should use persisted closed periods, not the current live table.

This means:
- day view = that day's closed snapshot
- week view = weekly aggregation over daily closed snapshots
- month view = monthly aggregation over daily closed snapshots

## Current State Update Rule
For intraday imports:
- overwrite live personnel/store KPI state with the latest accepted pull
- do not keep duplicate live rows for the same effective period

This is the chosen trade-off:
- simpler live state
- lower storage cost
- acceptable loss of intraday replay
- enough debugging retained through sync metadata

## Open Rule Kept Flexible
`ranking eligibility`

This is intentionally not fixed yet.

Keep it config-driven for later options such as:
- minimum net sales threshold
- minimum ticket count
- minimum active-days threshold
- segment-specific ranking rules

For now:
- do not hard-code ranking eligibility
- keep the model ready for later configuration

## Implementation Sequence

### Phase A. Ingestion Envelope
- create/import batch record for each Nebim pull
- store sync metadata
- apply idempotent acceptance rules
- base envelope fields:
  - `source_batch_id`
  - `source_payload_hash`
  - `source_captured_at`
  - `source_window_started_at`
  - `source_window_ended_at`

### Phase B. Live KPI State
- normalize seller-code keyed personnel KPI state
- normalize store KPI state
- make returns/refunds overwrite the current truth correctly
- allow source-facing KPI identity through `kpiCode` / `sourceMetricId`
- upsert the latest live KPI state instead of appending duplicate intraday rows
- source-specific import normalization should accept:
  - already-canonical KPI rows
  - Nebim/Power BI shaped metric columns such as `ATV`, `UPT`, `CR`, `NET_SALES`

### Phase C. Derived Metrics
- compute `TARGET_ACHIEVEMENT` from target allocation + current net sales
- keep `CR` out of personnel score

### Phase D. Daily Closure
- persist end-of-day closed snapshot
- use it for historical filters and rankings

### Phase E. Ranking Rules
- add config-driven eligibility later

## Guardrails
- seller code mapping must be treated as durable identity mapping
- returns must lower live performance, not create a separate additive event
- live ranking and historical ranking must not read from the same persistence layer blindly
- personnel persona and manager persona stay separate even when both read performance
