# Incentives list and drawer redesign — 10 September 2026

## Decision and flow

Owner requested rebuilding `/store/incentives` for Region Manager and Report Viewer using the current Checklist/KPI surface. R2 frontend data binding; root implementation and self-review. Existing company-scoped admin Store parity is retained.

Read the regional approval flow plan, workspace read service and contract, regional mutation owner, submission readiness model, and individual final-approval implementation. The existing sequence remains: period close → store review and optional reasoned correction → regional package submission → final approval by an eligible different approver. Projection-only periods cannot be reviewed or corrected; submitted/approved package locks and server capabilities remain authoritative.

Design: compact list and management surface, Azure header matching Checklist, white/blue metric filters for Region Manager, one flat store list with row dividers, and a shadcn Sheet for store/personnel details. Report Viewer has a regional-manager directory plus All Stores. Regional selection filters both stores and final-approval packages. All Stores retains every package returned by the authorized final-approval endpoint. The shared month calendar is reused without changing its selection semantics. Narrow screens stack the directory and render store rows as readable records without horizontal page scroll.

Preserved: real workspace reads, exact review/correction/void/submission/final-approval payloads, money calculation and rate sources, role/scope restrictions, mandatory correction reasons, final-approval confirmation, keyboard focus restoration, error rollback, and unavailable-data states. No backend, API, schema, grant, payout, or production-data changes. Sidebar identity uses the existing region ID because the workspace supplies manager display names, not manager user IDs; identically named people are not merged.

Implementation boundaries: scaffold, manager directory, flat store table, store detail Sheet, existing correction/audit Sheets and submission dialog. Replaced the old accordion hierarchy and purple styles. Native tab logic now uses shadcn Tabs. Changing period or principal resets open UI context; stale/loading submission controls stay disabled while the dialog can still be dismissed.

Rollback: restore only this task's changes from `C:/Users/suley/.codex/tmp/incentive-redesign-20260910` and remove its new directory/store-drawer files. Preserve earlier individual approval and other dirty workspace work.

## Verification

- Frontend lint and production build passed. The build uses the existing Playwright environment wrapper; its production bundling step also validates TypeScript.
- 34 incentive workflow, directory, final-approval and responsive scenarios passed. These include exact mutation payloads, successful correction readback, failure rollback, readonly zero-mutation behavior, closed-period restrictions, filtering, 320/390/1024/1440 layouts, nested Sheets and focus restoration.
- The existing projection suite passed eight data/error/period/rollback scenarios. Its eight accessibility checks initially found low contrast in the header eyebrow and period label; both were corrected. All eight then passed, together with the single-production-owner closeout check. Total: 51 distinct passing browser scenarios across these runs.
- Desktop and narrow-screen screenshots reviewed for list and detail geometry. Historical prototype-coordinate assertions were replaced with the owner's newly requested list/directory/Sheet anatomy and viewport/focus checks; old prototype evidence remains historical.
- Actual local Docker views checked on 5181 (Region Manager) and 5183 (admin sharing Report Viewer). The regional list contains ten existing demo stores; Atlas details contain six personnel. September incentive sales/rates are unavailable in the existing dataset, so amounts honestly show unavailable values. No synthetic incentive values or real approval mutations were added for visual proof.
- Other smoke references were updated only for the new titles and drawer controls. Provider-authenticated smoke was not run. This is local evidence, not a complete release gate, independent review, PR merge, or deployment.
- After the final submit-dialog dismissal safeguard, the build and targeted lint passed again, and all four affected submission scenarios passed. Final diff whitespace check passed; local role containers remained running and the API healthy.

PR handoff: owner asked whether accumulated work should enter the PR process after this page. Recommended pausing new features and separating calculation fixes, role/final-approval work, and UI changes according to dependencies. No commit, push, or PR has been created by this redesign task.
