# Live KPI score: reference 70, ceiling 140

Owner decision: 10 September 2026. Contract Impact: changed (live scoring and ranks).

The reference performance earns 70 points; twice the reference earns 140.
For each supported KPI, contribution is `clamp(actual/reference, 0, 2) * 70 * weight/100`.
Weights, reference sources, raw values, eligibility and permissions stay unchanged.
Target achievement uses the approved sales target; Turkey-average KPIs retain their
existing Turkey reference. This does not force the population mean of composite
scores to equal 70. Missing references still produce no score.

Checklist results retain their raw 0–100 values, contributing at the same 70-point
reference scale; missing checklist weights retain the existing redistribution.
GSM retains its existing reference and raw units. Each metric contribution is
bounded, so valid profiles totaling 100% cannot exceed 140 points. Checklist
completion is naturally limited to its existing raw maximum.

Implementation slice: an explicit live-scoring entry point is shared by store
reporting, rankings and personnel leaderboards. Legacy snapshot scoring remains
available and stored closed snapshots are not rewritten. Active live caps
override the old 1.2 ratio policy. Existing API score units (store fraction,
personnel points) remain unchanged.

Region-manager risk counts use 52.5, preserving the former 75% of reference
boundary. Personnel status labels use 59.5 and 52.5 for the equivalent strong
and watch boundaries. The personal score progress display exposes points out of
140 rather than treating the result as a percentage.

Rollback: revert this scoring slice and rebuild the API and web app. Raw facts,
targets and snapshots are untouched; no data migration is required.
