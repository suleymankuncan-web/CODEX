# Master Data Personnel Row Context V1

## Purpose

Record the first Integration Dashboard / Master Data Product Readiness V1 slice
after the Store Rankings table-context work. This slice improves repeated
personnel master-data row controls with row-specific accessible names and
mobile boundedness evidence. It does not change personnel update payloads,
store/personnel master data API calls, auth, permissions, DB state, import
lifecycle, promotion semantics, CSS behavior, or user workflow semantics.

## Sokrates Triage

Claim:

- The personnel master-data table repeats several edit controls per row, but
  the controls either used generic names such as `First name` or had no
  accessible name. Operators and assistive technology need row-specific control
  context on dense management tables.

Assumptions:

- Adding localized `aria-label` values changes accessibility semantics only.
- The row's existing `displayName` is the safest stable label for identifying
  the personnel record without changing visible copy or update behavior.
- A 390px mobile boundedness assertion is appropriate because this surface is a
  dense operational editor.

Repo evidence:

- `MasterDataBootstrapPage.tsx` already gives store master-data controls
  row-specific labels such as `{storeName} store type`.
- Personnel first/last/seller/date controls were generic, while store,
  position, employment status, and employment type selects had no row-specific
  accessible label.
- `integration-surfaces.spec.ts` already owns Integration/Master Data route
  coverage, including previous store master-data label assertions.

Counterargument:

- This does not reduce the large page file or redesign the table. That is
  intentional: the concrete gap is repeated-control context, not layout
  architecture.

Risk:

- LOW/MEDIUM. The production code change is limited to ARIA labels and a pure
  display-name helper. The only likely breakage would be tests that depended on
  generic accessible names.

Door:

- Two-way door. Labels and the helper can be adjusted or reverted without
  touching payloads, data, auth, DB, or import/promotion behavior.

Stop rules applied:

- No API request/response shape changes.
- No store/personnel save, promotion, import retry, mapping, or bootstrap
  lifecycle behavior changes.
- No auth/permission/DB changes.
- No CSS or visual layout change.

## What Changed

- Personnel first name, last name, seller code, store, position, employment
  status, employment type, hire date, and assignment-start controls now expose
  row-specific localized labels, for example `Ada Yilmaz first name`.
- `integration-surfaces.spec.ts` now mocks the personnel master-data read
  surface, asserts the row-specific labels, and verifies the personnel tab does
  not create page-level horizontal overflow at a 390px mobile viewport.

## Verification

Local gate for the PR:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts --workers=1
git diff --check
```

Result:

- `npm.cmd --prefix admin-web run lint` passed after installing local
  `admin-web` dependencies in the isolated worktree.
- `npm.cmd --prefix admin-web run build` passed.
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts --workers=1`
  passed: 11/11.
- `git diff --check` passed with only Windows line-ending warnings.

## Next Product Readiness Target

After this Master Data slice merges cleanly, reassess whether the Integration /
Master Data family has another concrete V1 gap. If not, keep Stage Builder /
Competition parked unless fresh audit evidence shows a higher-value safe slice.
