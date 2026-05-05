# Controlled Pilot Scope

Date: 5 Mayis 2026

Decision source:

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`

Decision basis:

- Pilot status is `Conditional Go` for controlled staging/internal validation.
- This scope does not authorize broad production rollout.

## Pilot Goal

Validate that store-facing performance and ranking workflows are understandable and technically stable with real staging auth, accepted temporary master data, and March 2026 Power BI KPI materialization.

This pilot is for operational confidence, not final UI polish or final master-data automation.

## Pilot Mode

Mode: controlled staging pilot.

Allowed environment:

- `https://staging.hr-axis.com`
- `https://api-staging.hr-axis.com/api`

Allowed data:

- March 2026 monthly Power BI KPI snapshot.
- Accepted temporary staging master-data baseline.

Data disclaimer:

- March 2026 is historical validation data.
- Current target distribution should not be interpreted as live operational target workflow for this historical month.

## Included Users

### Admin / Support User

Purpose:

- Verify admin-side integration, support, and troubleshooting surfaces.
- Confirm data exists and pages open after deploys.

Allowed:

- Admin/integration checks.
- Store-facing sanity checks.
- Ranking privileged view checks.

Restriction:

- Admin behavior should not be used to judge low-role visibility. Low-role evidence must use the non-`SUPER_ADMIN` user.

### Bursa Marka Park Store Manager User

Account:

- `suleymankuncan@lufian.com.tr`

Role:

- `STORE_MANAGER`

Bound store:

- `Bursa Marka Park Avm`

Allowed:

- Store-facing pages.
- Store KPI highlights.
- Store manager ranking behavior.
- Managed-store personnel detail view.

Expected:

- Global rankings show Top 100 summary rows.
- Global metric details are hidden.
- Managed-store personnel details are visible.

## Included Pages

### Store Shell

Routes:

- `/store`
- `/store/me`
- `/store/kpis`
- `/store/approvals`

Expected result:

- Pages open in authenticated Clerk session.
- No 45-second auto-refresh regression.
- Data loads after backend warm-up or deploy delay.

### Rankings

Route:

- `/store/rankings`

Expected result for low-role store manager:

- Global store/personnel rankings are Top 100 and summary-only.
- Current store appears.
- Bursa Marka Park can be found by search.
- Own managed-store personnel appear with detailed metrics.
- No demo rows are visible.

Expected result for privileged admin:

- Full/detail rankings are visible.
- Bursa Marka Park appears with detail metrics.
- Demo rows are not visible.

### Store KPI Highlights

Route:

- `/store/kpis`

Expected result:

- Bursa Marka Park March 2026 KPI highlights load.
- Score is visible.
- Metrics include `TARGET_ACHIEVEMENT`, `CR`, `ATV`, `UPT`, `BM_CHECKLIST`, `VM_CHECKLIST`.
- Missing BM/VM checklist contribution is not presented as completed checklist performance.

### Performance Surface

Route:

- `/store/me`

Expected result:

- Store/personnel performance context loads.
- March 2026 KPI values are understandable.
- Benchmark/target language does not mislead users into thinking historical target distribution was operated live.

## Excluded From This Pilot

These are intentionally excluded unless separately approved and smoke-tested:

- Broad production rollout.
- Direct Supabase client access to `ops.*` tables.
- `STORE_PERSONNEL` user pilot.
- Region manager operational pilot.
- VM checklist pilot.
- Live target distribution for historical March data.
- JSON/API source adapter.
- Final premium retail UI redesign.
- Write/mutation action smoke beyond already tested read/action-scope guards.
- Payroll, HRIS, or final source-of-truth master-data automation.

## Daily Pilot Smoke Checklist

Run this after each staging deploy during pilot:

- Open `/store`.
- Open `/store/me`.
- Open `/store/kpis`.
- Open `/store/approvals`.
- Open `/store/rankings`.
- Confirm no 45-second refresh loop.
- Confirm Bursa Marka Park appears in rankings.
- Confirm low-role ranking remains summary/top100.
- Confirm managed-store personnel details remain visible to the store manager.
- Confirm `/store/kpis` still shows score and March 2026 metrics.

## Feedback To Collect

Collect feedback in these buckets:

- Data trust: names, store match, personnel match, KPI values.
- Ranking trust: rank, Top 100 behavior, hidden details, own-store personnel visibility.
- KPI explanation: target/benchmark language, missing checklist explanation, score clarity.
- Navigation: page findability, loading states, deploy/warm-up behavior.
- UI direction: what feels too technical, too crowded, or off-brand.
- Operational blockers: anything that prevents a store manager from using the page.

## Pause Criteria

Pause pilot if any of these occur:

- A low-role user sees global metric details.
- A low-role user can act on unassigned stores.
- Store manager cannot see own managed-store personnel details.
- Bursa Marka Park disappears from rankings or KPI highlights.
- Demo rows appear in live ranking.
- 45-second refresh loop returns.
- Data appears attached to the wrong store or employee.
- User confusion is caused by target/benchmark wording and cannot be explained in-session.

## Rollback / Support Posture

Rollback posture:

- Keep pilot limited to staging and explicit users.
- If a serious visibility issue appears, remove pilot user access or pause Clerk login before expanding.
- If data issue appears, stop using the affected import batch for pilot decisions until reviewed.

Support posture:

- Keep one privileged support user available.
- Keep one low-role store manager user available.
- Record screenshots or route names for any issue, but do not record raw tokens, cookies, passwords, provider subjects, or full JWTs.

## Success Criteria

Controlled pilot can be considered successful if:

- Store manager can open the included pages without refresh loop.
- Bursa Marka Park data is visible and understandable.
- Low-role rankings remain summary/top100.
- Managed-store personnel details are visible only in the manager's own store context.
- No demo or wrong-store data appears.
- Product owner can explain to pilot users what is historical March data and what is future operational workflow.
- Feedback is mostly about polish/workflow improvements, not broken trust, wrong data, or unsafe visibility.

## Next Decision After Pilot

After controlled pilot feedback, choose one:

- `Go forward`: expand to more pilot users or one additional role after new role smoke.
- `Pause`: keep staging closed while fixing data, wording, or visibility issues.
- `Rollback`: remove pilot access if scope/data safety fails.

Recommended next expansion only after this pilot:

- Add one `STORE_PERSONNEL` test user and smoke the employee-facing visibility path.
- Add one region-manager user only if regional filtering and detail visibility are included in the pilot scope.
