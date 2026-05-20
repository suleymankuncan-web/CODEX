# Store Mobile Shell And Checklist V1

## Scope

This slice fixes two store-side mobile usability issues:

- The fixed bottom toolbar active icon could disappear on mobile because the
  active link kept white icon/text color while a later mobile rule reset the
  active background back to a light surface.
- `/store/checklists` could still expose an oversized visit table header on
  small mobile widths because the generic mobile `display: none` rule lost to a
  more specific visit-table selector.

The change keeps route access, API calls, auth/permission behavior, DB state,
business logic, checklist workflow behavior, and submitted values unchanged.

## Sokrates Decision

Claim:

- This is one coherent mobile usability batch because both issues affect the
  store mobile shell/checklist path and share the same CSS/test verification
  family.

Assumptions:

- The right fix is layout/state CSS, not a route, API, auth, or data change.
- The bottom toolbar mobile rules belong to the shared store command shell
  instead of the approvals ledger stylesheet.

Evidence:

- Repo evidence: mobile bottom-nav rules were stored in
  `store-approvals-ledger.css` and overrode the active gradient background with
  a light mobile link background.
- Test evidence: the strengthened checklist mobile test initially caught a
  `store-checklists-table-head` element at roughly 790px wide on a 360px
  viewport.
- Runtime-style evidence: the Playwright assertion now checks the active bottom
  nav item keeps a gradient background and white icon color on mobile.

Counterargument:

- The smallest possible patch would have been a single active-state override in
  the approvals CSS. Moving the shared mobile shell rules into
  `store-command-shell.css` is still better here because it removes the source
  of the override bug and keeps global shell behavior in the shell stylesheet.

Risk:

- LOW-MEDIUM. The change is visible and affects the shared store mobile shell,
  but it is CSS/test-only and reversible with one squash commit revert.

Door:

- Two-way door. No migration, API contract, auth, or business behavior changes.

Stop rule used:

- Stop if fixing the issue required changing checklist workflow state,
  navigation permissions, API responses, or backend behavior. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test checklist-today-surfaces.spec.ts -g "mobile|visual merchandiser sees checklist-only" --workers=1` - passed, 2/2.
- `npx.cmd playwright test checklist-today-surfaces.spec.ts --workers=1` - passed, 12/12.
- `npx.cmd playwright test store-surfaces.spec.ts -g "store shell exposes|visual merchandiser lands|store utility pages|store sidebar transitions|store tasks checklist|store checklist acknowledgement" --workers=1` - passed, 6/6.

## Files Touched

- `admin-web/src/styles/store-command-shell.css`
- `admin-web/src/styles/store-approvals-ledger.css`
- `admin-web/src/styles/store-checklists-command.css`
- `admin-web/e2e/checklist-today-surfaces.spec.ts`

## Remaining Watch

- The region-manager bottom toolbar still has more destinations than a classic
  five-item mobile tab bar, so horizontal nav scrolling remains intentional for
  now. This slice only fixes the active icon contrast and prevents checklist
  content overflow.
