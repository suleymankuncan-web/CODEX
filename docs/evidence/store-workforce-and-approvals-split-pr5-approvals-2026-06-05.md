# Store Workforce And Approvals Split PR-5 Approvals Evidence

Date: 2026-06-05

## Scope

- `/store/approvals` is now a request-center/status ledger.
- Target distribution creation remains outside approvals and links to `/store/targets`.
- Returned seller-code/offboarding correction rows link to `/store/workforce` with `requestType` and `requestId`.
- Store manager visual QA uses mocked API responses that match the existing target/workforce request contracts.

## Visual QA

- Desktop screenshot: `docs/evidence/store-workforce-and-approvals-split-pr5-approvals-desktop-2026-06-05.png`
- Mobile screenshot: `docs/evidence/store-workforce-and-approvals-split-pr5-approvals-mobile-2026-06-05.png`

Checks performed:

- Desktop viewport `1440x950`: no horizontal overflow.
- Mobile viewport `390x844`: no horizontal overflow.
- Mobile action links are fully inside the viewport.
- Old approvals workbench/table/grid classes are not present.
- Old creation copy for target, seller-code, and offboarding forms is not visible.

## Behavior Guard

- No API shape changes.
- No DB/schema changes.
- No auth/permission semantic changes.
- No target distribution, seller-code, or offboarding workflow state-machine changes.
- No fake production data added.
