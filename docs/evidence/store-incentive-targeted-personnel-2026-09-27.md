# Store incentive target-bearing personnel — 27 September 2026

Status: synthetic local verification for PR; not deployment or production-data evidence.

## Scope

- The selected-month personnel list shows personnel with an approved target greater than zero; manager inclusion uses the selected month's store target.
- Closed periods read rows and store target/net/achievement baselines only from immutable final snapshots. A frozen null does not fall back to a current target.
- `İşten ayrıldı` is shown only for an explicit normalized `terminated` status whose termination date is effective on the current Istanbul business date. Unknown statuses remain unknown.
- Sales, returns, net sales, and return-only detail are read-only presentation. Duplicate identities are counted once, while any positive sale keeps that identity out of return-only detail.
- Existing incentive formulas, positive-sales basis, corrections, final totals, payout workflow, targets, assignments, and payroll behavior are unchanged. No eligibility workflow or lab artifact is included.

## Verification

- Backend workspace, snapshot, repository, SQL-shape, and OpenAPI tests: 66/66 passed.
- Frontend movement, sales-display, and workspace model unit tests: 23/23 passed.
- Affected incentive, command, parity, and role Playwright specs: 123/123 passed.
- Focused target/departure/parity Playwright subset: 35/35 passed; this overlaps the affected-spec run.
- Frontend Playwright build, changed-file frontend/backend ESLint, generated OpenAPI check, and `git diff --check`: passed.

Full local E2E, `check:release`, on-prem proof, deployment, and live-data claims are intentionally not made; mandatory GitHub CI remains unchanged.
