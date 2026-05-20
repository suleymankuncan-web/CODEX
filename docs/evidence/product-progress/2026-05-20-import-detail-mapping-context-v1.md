# Import Detail Mapping Context V1

## Scope

This slice improves the admin import batch detail route:

- `/admin/integrations/:batchId`

The change keeps API calls, response shapes, import state transitions, mapping
approval behavior, auth/permission behavior, DB state, data calculation, route
targets, and visible layout unchanged.

## Sokrates Decision

Claim:

- The import detail page is large and evidence-heavy, but it did not need a
  broad visual redesign for this pass. The clearest small V1 gap was repeated
  mapping controls whose accessible names did not identify which external ID
  they controlled.

Assumptions:

- Adding the external ID to input, select, and approve button accessible names
  improves keyboard and screen-reader confidence without changing operator
  behavior.
- Keeping visible labels and button text unchanged avoids adding density to an
  already dense operational page.

Evidence:

- `integration-surfaces.spec.ts` already covers the import batch detail flow,
  KPI lineage evidence, mapping controls, and mapping approval success copy.
- Browser review showed the page renders on desktop and mobile without
  horizontal overflow or console errors.
- The same mapping component can appear for multiple external rows, so generic
  names such as "search internal store candidates" and "approve mapping" are
  weaker than row-specific names.

Counterargument:

- The mobile screenshot also shows some dense, low-emphasis panel copy. That
  may deserve a separate readability pass, but mixing it into this PR would
  widen the review story from accessible control context into visual styling.

Risk:

- LOW. The slice is presentation/accessibility only, localized, and covered by
  the existing import detail Playwright path.

Door:

- Two-way door. Accessible labels can be adjusted or reverted without migration,
  provider configuration, or API work.

Stop rule used:

- Stop if the improvement required import API, auth, permission, mapping
  mutation, data transformation, or CSS/layout behavior changes. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test integration-surfaces.spec.ts -g "admin import batch detail" --workers=1` - passed, 2/2.

Browser check:

- Local preview at `http://127.0.0.1:4180`.
- `/admin/integrations/batch-kpi-lineage-ui-1` on desktop `1366x900` and
  mobile `390x900`:
  - heading rendered.
  - horizontal overflow was false.
  - mapping search input exposed the external ID in its accessible name.
  - mapping select exposed the external ID in its accessible name.
  - mapping approval button exposed the external ID in its accessible name.
  - console errors were empty.

## Files Touched

- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/src/features/localization/messages/import-batch-detail.ts`
- `admin-web/e2e/integration-surfaces.spec.ts`

## Next Candidate

Do not continue expanding import detail in the same story. If browser review is
the next priority, isolate a separate import detail readability pass for the
low-emphasis panel copy. Otherwise move to the next route-inventory candidate:
auth catalog/audit read-only surfaces or reports detail pages, depending on
which concrete browser gap is found first.
