# Individual incentive final approval — 10 September 2026

Risk: R5, root implementation and self-review. Local authorized feature; no PR, production rollout or actual approval/permission assignment requested.

## Plan and contract impact

Add an opt-in boolean to the individual company-scoped REPORT_VIEWER assignment, default false. Expose Prim Onayı in identity role assignment and selected-user permissions. Derive INCENTIVE_FINAL_APPROVAL in the server session only from that assignment, never global role permissions. Add scoped Store final-approval read/write endpoints reusing the submitted region package transaction and existing final status. Existing admin endpoints retain their policy. Match the viewed package and submission version under lock; require a different submitter and reject missing/expired permission, other companies, wrong states and duplicate/stale submissions. UI exposes pending packages and a confirmation dialog only for eligible viewers.

Preserve KPI math, payout math, regional submission, competition parked work and unrelated dirty changes. Verification: permission and workflow negative tests, migration rollback/reapply on isolated PostgreSQL, relevant/full backend tests, generated API, frontend lint/build/unit and focused browser contracts. Runtime smoke is local evidence only.

Rollback: restore only this task's file changes from C:/Users/suley/.codex/tmp/incentive-final-approval-20260910 and apply migration 079 rollback after reverting the dependent runtime. Dropping the column removes individual grants; package approval history remains intact. No user is granted permission automatically.

## Evidence

Implemented: migration 079 adds the default-false individual grant. Identity create-role and current-user role controls expose it. Session permission scopes derive INCENTIVE_FINAL_APPROVAL only from eligible active REPORT_VIEWER assignments; global role grants explicitly exclude it. New GET/POST /api/store/incentives/final-approval preserve existing admin endpoints and payout calculations. Approval rechecks and holds the live assignment under a shared row lock after acquiring the package lock. This serializes grant revocation, rejects own submissions, stale versions, out-of-scope packages and repeat approval. Both grant changes and final decisions have audit events.

- Backend full run exercised 359 suites / 2,581 tests. Six failures were the newly additive assignment field in existing expectations and the two new audit events missing from the catalog. These were corrected; final targeted run passed 9 suites / 52 tests, including all previously failing suites, new HTTP authorization/validation tests, locked transition tests and the OpenAPI contract. Backend lint and build passed on final implementation.
- Frontend lint/build passed; 45 unit files / 216 tests passed. Browser evidence: 12 existing incentive contracts passed, plus final 16 identity and approval cases passed (28 distinct scenarios across runs). Tests cover individual grant/revoke persistence, role-change reset, ordinary viewer exclusion, revoked permission failure, exact submission payload and 1440/390 px layouts. The server-controlled checkbox test waits for persisted state after click.
- Generated OpenAPI types are current (`api:check`). Shared shadcn Checkbox/Field/Dialog/Card/Button components used; no new calendar or KPI design.
- Disposable PostgreSQL database proved migration defaults, rollback/reapply, grant creation/revocation, no global permission inheritance, company isolation, wrong-scope/self/stale denials, two concurrent final approvals producing one transition and one audit, and a queued approval denied after concurrent grant revocation. Scripts: C:/Users/suley/.codex/tmp/verify-prim-approval.cjs and verify-prim-approval-queued.cjs. The disposable database was removed after proof.
- Migration 079 was applied to the local Docker database through MigrationService; API rebuilt/restarted. Live smoke: admin role-assignment list 200 with the new field on all 20 assignments; normal Report Viewer workspace 200; ungranted final-approval endpoint 403. Automatic grants: zero. No actual business package was approved.

Root self-review covered role/company separation, revocation, shared transaction locks, scoped reads, audit, generated API, loading/error states and principal/period changes in the dialog. No independent review, production rollout, full release or offline proof is claimed. Earlier unrelated script-guard debts remain outside this task.

Use: Identity → select user → Report Viewer assignment → Rol yetkileri → Prim Onayı. New role assignment supports the same opt-in checkbox. The authorized user then uses Store → Primler → Prim Onayı → Final onay ver after regional submission.
