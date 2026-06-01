# Admin Operational UX V2 PR-6 Targets KPI Evidence - 2026-06-01

Scope:

- `/admin/targets`
- `/admin/kpi-config`

Changes:

- Added a target approval decision brief that reads only existing target request,
  target coverage, and assigned action-store scope data.
- Changed the KPI config publish-state metric from a numeric `1` / `0` display
  to an existing localized decision label.
- Added targeted e2e assertions for target decision evidence, mobile overflow,
  approve payload parity, and KPI publish-state readability.

Contract impact:

- API shape: unchanged.
- DB schema: unchanged.
- Auth and permission semantics: unchanged.
- Target approval payload, request month, note handling, and coverage semantics:
  unchanged.
- KPI scoring math, contribution weights, validation, save payload, publish
  payload, and active version semantics: unchanged.

Verification:

- `npm.cmd --prefix admin-web run lint`: pass.
- `npm.cmd --prefix admin-web run build`: pass.
- `npm.cmd --prefix admin-web run test:e2e -- admin-targets.spec.ts admin-targets-surfaces.spec.ts admin-kpi-config.spec.ts kpi-config-surfaces.spec.ts kpi-config-versioning.spec.ts`: pass, 18/18.
- `npm.cmd run test:scripts`: pass, 399/399.
- `git diff --check`: pass.

Visual QA:

- `/admin/targets` visible approval request brief is in the first operational
  viewport without claiming global priority ordering.
- `/admin/targets` mobile width `390px` keeps the decision brief readable with no
  horizontal overflow.
- `/admin/kpi-config` mobile overflow guard remains covered by the existing KPI
  config surface spec.

Rollback:

- Revert this PR. It is frontend-only plus test/evidence updates.
