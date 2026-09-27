# Assigned-store Checklist planning — 27 September 2026

Status: local PR evidence; not deployment or live-data evidence.

## Contract impact

- Risk class: R5 permission/data-integrity workflow.
- Contract Impact: changed. A Region Manager can read and atomically save one weekly plan across the manager's current directly assigned, active stores without selecting a legacy region. The existing region-specific endpoint remains available.
- The API adds an assigned-store write path and a SHA-256 portfolio revision token. Period history and candidate reads accept the same assigned-store view when `regionId` is omitted.
- Existing `REGION_MANAGER` authentication, direct-store assignment checks, week/date validation, optimistic concurrency, idempotency, audit records, completion records, and regional storage partitions remain in force. There is no migration, checklist-score change, or live-data operation.

## Fail-closed limitation and rollback

- Legacy region partitions are storage boundaries, not new authority. Every changed partition uses one transaction and a stable lock order.
- If a current legacy regional revision contains any store outside the actor's direct active portfolio, the save returns `409` and the whole multi-partition operation rolls back. The UI reports that store responsibility changed and does not misroute this denial into the stale-revision reapply flow.
- This change does not claim that managers with disjoint direct assignments can independently rewrite a shared legacy regional revision. That data-ownership redesign remains out of scope.
- A single revert restores region-selected planning. No data repair is expected because rejected multi-partition writes are atomic.

## Verification

- Backend visit-plan service, scope, repository, controller, DTO, OpenAPI, and schema tests: 9 suites, 62/62 passed.
- Frontend Checklist model unit tests: 13/13 passed.
- Checklist command-canvas Playwright coverage: 43/43 passed across desktop/mobile planning, assignment loss, paging, history, idempotent retry, stale revision, scope denial, accessibility, and overflow.
- Directly impacted existing Checklist consumer specs covered 67 unique scenarios: 65 passed in the initial cross-spec run; two region-gate/fixture assumptions were updated to the assigned-store contract and both passed the focused 2/2 rerun without unhandled API requests.
- Changed backend/frontend ESLint, backend build through OpenAPI generation, frontend Playwright build, frontend OpenAPI generation/check, generated authorization/system-flow contracts (2/2), and `git diff --check`: passed. The existing frontend large-chunk warning remains.
- A precursor synthetic PostgreSQL rehearsal passed multi-partition save, idempotent replay, stale-scope rejection, direct assignment filtering, period history, outsider rejection, and full rollback. It used only rollback-bound synthetic rows; it is prior local runtime evidence, not refreshed current-SHA or production proof.
- Full local E2E, `check:release`, on-prem proof, deployment, and live-provider claims are intentionally not made under the owner-approved exception. Required GitHub CI remains unchanged.
