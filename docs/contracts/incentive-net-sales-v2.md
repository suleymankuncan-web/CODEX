# Incentive net sales V2

Current projections and newly closed periods use `sales-target-incentive-v2.0.0`.
The manager/personnel rate tables, exact bracket boundaries, 80% store gate,
position/ownership eligibility and truncation to cents retain their V1 rules.

Personnel achievement and payable base use signed attributed net sales. A
same-store return reduces the original seller's net and the receiving store's
net. A cross-store return reduces only the receiving store's net; neither the
original seller nor the receiving personnel is debited. Store totals can
therefore be lower than the sum of personnel totals. Managers use store net.
Negative actuals remain visible and use the existing zero-rate bracket.

Daily personnel inputs require completed company-scoped import lineage,
successful V2 component facts agreeing with the rounded canonical amount, and
resolved original-store attribution. Mixed unverified daily rows produce no
payable source. Daily facts take precedence over monthly snapshots. Monthly
personnel inputs require explicit `personnel_net_sales` evidence: a historical
pilot batch name or `personnel_gross_sales` alone is insufficient. The shared
returns/coverage read contract supplies missing-day reporting in the next slice.

The internal current projection column is `personnel_net_sales_amount`.
The V1 gross column and immutable historical snapshots remain intact. Closed
reads retain the stored calculation version, signed actual and payment; Excel
exports those frozen values. Existing participation exclusions, reasons and
company approval/seal versions continue to bind the same frozen snapshots.
Pre-close adjustments under another rule are not applied to a V2 projection;
historical adjustment records and final-snapshot adjustments remain intact.

The existing API field `actualPositiveSales` remains for compatibility and
carries the calculation's actual sales amount, signed net for V2. Consumers
must use the calculation version when interpreting historical snapshots.
The shared read/UI slices will supply clearer net-sales labels and return detail.

Migration 097 adds the current net column, preserves all 14 V1 rate brackets
under V2, and permits signed final actuals only for a V2 parent snapshot.
It does not rewrite closed periods, deploy a worker or repair production data.
