# Master Data Store Labels Slice

## Purpose

Record the first Project Progress Plan V1 Phase 3 operator-surface coherence
slice. The change improves `/admin/master-data` store master-data option labels
without changing submitted values, backend contracts, permissions, or database
behavior.

## Sokrates Decision

Claim:

- Store type and status controls were exposing raw enum-style labels on an
  operator screen.

Assumptions:

- Operators should see human-readable labels while the underlying form values
  remain unchanged.
- Existing integration/master-data E2E coverage can verify the labels without a
  broad UI redesign.

Evidence:

- `adminMasterData.storeType.*` and `adminMasterData.storeStatus.*`
  localization entries displayed `company`, `operator`, `active`, and similar
  raw values.
- `MasterDataBootstrapPage` already binds select options to stable values such
  as `company`, `franchise`, `active`, and `closed`.
- `integration-surfaces.spec.ts` already opens `/admin/master-data` and checks
  the store master-data controls.

Counterargument:

- Raw values are technically accurate. That is not enough for an operator
  surface, especially in the Turkish-first admin UI.

Risk:

- LOW. Only labels and targeted Playwright assertions changed.

Door:

- Two-way door. Labels can be refined without migration or API impact.

Decision:

- Replace raw store type/status option labels with operator-readable Turkish
  and English labels.
- Keep option values unchanged.
- Add targeted Playwright assertions for Turkish store type and status labels.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npx.cmd playwright test integration-surfaces.spec.ts -g "store master controls" --workers=1`
- `git diff --check -- admin-web/src/features/localization/messages/admin-master-data.ts admin-web/e2e/integration-surfaces.spec.ts`

## Result

- `/admin/master-data` now shows store type/status choices as readable operator
  labels while preserving the submitted enum values.
