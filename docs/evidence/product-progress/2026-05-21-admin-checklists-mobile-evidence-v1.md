# Admin Checklists Mobile Evidence V1

Date: 2026-05-21

## Sokrates Decision

Claim:

- `/admin/checklists` should get mobile-width evidence before any further UI
  or template-editor polish, because the screen is an important operator form
  and behavior changes would be risky without a concrete gap.

Evidence:

- Repo evidence: the UI/UX V1 route inventory scores `/admin/checklists` as
  usable but notes the template editor is behavior-sensitive.
- Repo evidence: existing Playwright coverage verifies localization and BM/VM
  draft separation, but it did not assert mobile boundedness for the editor,
  status strip, item settings grid, and template type switch.

Counterargument:

- A test-only slice does not improve the visual design. That is acceptable
  because no browser or pilot evidence currently proves a visual defect.

Risk:

- LOW. This slice adds targeted Playwright coverage and a handoff note only.

Door:

- Two-way door. The guard can be tightened or replaced if a future concrete
  checklist template issue requires visual or interaction changes.

Decision:

- Add mobile-width boundedness coverage for `/admin/checklists`, including the
  editor shell, status strip, item settings, and BM/VM template switch.
- Do not change checklist template behavior, API calls, auth, permissions, DB,
  CSS, copy, layout, publishing, saving, or draft state semantics.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --workers=1`
  - Result: 20 passed, 0 failed.
- `npm.cmd --prefix admin-web audit --omit=dev`

Result:

- Passed locally.

## Follow-Up

- Park `/admin/checklists` visual changes unless this guard, browser review, or
  pilot feedback reveals a concrete issue.
