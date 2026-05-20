# Import Detail Panel Readability V1

## Scope

This slice improves panel-copy readability on the admin import batch detail
route:

- `/admin/integrations/:batchId`

The change keeps API calls, response shapes, import state transitions, mapping
approval behavior, auth/permission behavior, DB state, data calculation, route
targets, panel structure, and visible copy unchanged.

## Sokrates Decision

Claim:

- After the mapping-context PR, browser review still showed a concrete V1 gap:
  import detail panel copy was too low-emphasis on light panels because the
  shared `.panel-copy` default is inherited from shell/sidebar styling.

Assumptions:

- The fix should stay scoped to import detail instead of changing global
  `.panel-copy` behavior across unrelated pages.
- Existing surface tokens are enough; no new palette, design system, or broad
  layout change is needed.

Evidence:

- Mobile browser review of `/admin/integrations/batch-kpi-lineage-ui-1` showed
  dense operational copy that was readable but visually underweighted.
- `shell.css` gives `.panel-copy` a light sidebar-oriented color, while import
  detail uses light surface panels.
- `--surface-muted` already exists as the intended muted text token for light
  panels.

Counterargument:

- A global `.panel-copy` correction may eventually be warranted, but that would
  widen the blast radius beyond this route. This PR keeps the first fix local
  and reversible.

Risk:

- LOW-MEDIUM. The slice is CSS/accessibility/readability only and scoped to one
  page wrapper, but it changes visible text contrast.

Door:

- Two-way door. The wrapper class and scoped rule can be adjusted or reverted
  without API, auth, DB, provider, or migration work.

Stop rule used:

- Stop if improving readability required global redesign, layout restructuring,
  copy changes, import API behavior, auth/permission changes, or data
  transformation. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test integration-surfaces.spec.ts -g "admin import batch detail" --workers=1` - passed, 2/2.

Browser check:

- Local preview at `http://127.0.0.1:4181`.
- `/admin/integrations/batch-kpi-lineage-ui-1` on desktop `1366x900` and
  mobile `390x900`:
  - panel copy color was `rgb(90, 101, 95)`.
  - panel copy line-height was `25.92px`.
  - horizontal overflow was false.
  - console errors were empty.
  - screenshots were written under
    `admin-web/test-results/uiux-import-detail-readability-v1/`.

## Files Touched

- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/src/styles/admin-support.css`
- `admin-web/e2e/integration-surfaces.spec.ts`

## Next Candidate

Do not keep polishing import detail unless a new concrete browser or pilot gap
appears. The next UI/UX V1 candidate should be auth catalog/audit read-only
surfaces or reports detail pages, chosen by a fresh route-level browser pass.
