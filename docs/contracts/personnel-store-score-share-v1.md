# Personnel Store Score Allocation

Owner-requested, 10 September 2026. Additive read-only analysis (R3); existing
store/personnel scoring, rankings, eligibility and access remain unchanged.

The personnel table's `Mağaza Skor Etkisi` distributes the displayed store score
in proportion to each sales employee's net sales multiplied by personnel KPI
score. A 95-point store and a 43/95 share gives 43 allocated points. This is not
the counterfactual score change if that employee were removed.

The server computes shares over the full store population before filters and
pagination. Store managers remain excluded by existing eligibility. Negative
net sales or scores receive zero weight; a zero pool or missing sales/scoring
inputs makes allocation unavailable. Positive-weight personnel metrics must all
have score contributions. Summary visibility omits the share field along with
metric details. No raw allocation inputs are added to public responses.

The frontend multiplies the share by the selected store's displayed score for
the same day/month/range. Search and pagination must not change a person's share.
Shared checklist/GSM outcomes are part of the distributed store score, not
claimed as individually measured achievements. Independently rounded displayed
amounts may differ slightly from the store total.

Risk: users could mistake allocation for causal impact, or missing/partial data
for zero. Mitigation: visible explanatory copy, nullable results, full-store
denominators and privacy tests. Rollback removes the optional response field and
column without migrations or changes to stored scores.

Acceptance: weighted example, zero/missing/negative inputs, separate stores,
summary masking, pagination stability, day/range consistency and local browser
checks. Backend/frontend targeted tests, lint/build and generated API checks.
