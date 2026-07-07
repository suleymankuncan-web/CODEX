# Store KPIs GSM Reference + Region Header Polish Evidence

Date: 2026-07-07

Finding IDs:
- PRA-20260707-04: Store KPIs GSM approval actual value can render while score reference/source shows `Veri yok`.
- PRA-20260707-11: Store KPIs region overview header was visually oversized relative to the date/scope controls.

Scope:
- Store KPIs only.
- No KPI formula, role/scope, ranking, checklist, target, incentive, DB mutation, or provider behavior changed.

Root Cause:
- Live Store KPI scoring already separates GSM scoring from GSM display reference: scoring stays target/achievement based, while the display reference is the Turkey average.
- The benchmark lookup used exact metric-code keys. If imported/configured GSM aliases differ by canonical/legacy spelling, the visible reference can be lost even when GSM actual and Turkey-average rows exist.
- The existing Store KPI Playwright fixture masked this because GSM carried a filled target/reference value instead of the real "actual exists, target missing, Turkey benchmark exists" shape.
- Region overview header already had a supporting icon in code, but the block retained a larger hero-like visual rhythm.

Read-Only Evidence:
- Published KPI config includes canonical `gsm_approval` with legacy aliases.
- May/June store-level GSM imported rows exist in the database and include non-demo monthly store actuals.
- No SQL mutation was performed for this finding.

Fix:
- Backend benchmark lookup now normalizes GSM canonical/legacy aliases before returning the display benchmark.
- Frontend KPI score-profile matching now normalizes GSM canonical/legacy aliases consistently.
- Store KPI e2e fixture now covers GSM with actual `%40`, no target, Turkey benchmark `%56,2`, and score contribution `2`.
- Region overview header was compacted into a smaller command strip with a centered lucide icon.

Verification:
- `npm.cmd --prefix backend\nestjs test -- reporting.service.kpi-benchmark-scoring --runInBand`
- `npm.cmd --prefix backend\nestjs test -- reporting-store-kpi-read reporting.service.kpi-benchmark-scoring --runInBand`
- `npm.cmd --prefix backend\nestjs run test -- --runInBand`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-kpis-contracts.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --check`

Residual Risk:
- This slice does not address other parked Store surface polish notes for Store Me, Rankings, Checklist, Incentives, or Reports.
- Closed snapshot KPI report rows still do not carry benchmark metadata; this finding only hardens live Store KPI highlights and the current visible Store KPI command surface.
