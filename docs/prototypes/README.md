# Prototype Shelf

Status: active
Shelf: prototypes

## Reader And Action

Reader:

- a future agent, engineer, product owner, or UI reviewer continuing the login
  and page-level visual pilot work.

After reading, they should know which prototype files are active references,
what can be reused, and what must stay out of production UI until explicitly
implemented and verified.

## Current Active References

- `docs/prototypes/plum-glacier-token-set-v1.md` is the active Plum Glacier
  token vocabulary for login and future page-level UI pilot work.
- `docs/prototypes/login-pilot-v3.html` is the current login visual reference
  after the Lufian login simplification and Clerk spacing pass.
- `docs/prototypes/assets/hr-axis-06-assets.md` describes the raster logo
  assets used by the prototype pages.
- `docs/prototypes/store-workforce-prototype-v1.html` is the locked Store
  workforce / Norm Kadro visual contract for the Store workforce split.
- `docs/prototypes/store-workforce-full-ledger-prototype.tsx` is the
  locked production-bound React prototype for the next Region Manager
  `/store/workforce` Norm Kadro full-ledger translation. It supersedes the
  older standalone workforce HTML contract for the upcoming production
  implementation pass.
- `docs/prototypes/store-approvals-request-center-v1.html` is the locked Store
  approvals / Talep Merkezi visual contract for the approvals cleanup.
- `docs/prototypes/store-home-store-manager-standard-v1.html` is the locked
  Store Home dashboard visual contract for the Store Manager persona.
- `docs/prototypes/store-home-region-manager-standard-v1.html` is the locked
  Store Home dashboard visual contract for the Region Manager persona.
- `docs/prototypes/store-checklist-result-modal-v1.html` is the locked and
  implemented checklist result modal visual contract for Store Manager
  acknowledgement and Region Manager review contexts.
- `docs/prototypes/store-checklists-region-manager-v1.html` is the draft
  Region Manager `/store/checklists` page prototype for the store-first
  checklist operation view. It is not locked until explicitly approved.
- `docs/prototypes/store-checklists-region-manager-command-v2.html` is the
  draft Region Manager `/store/checklists` command-deck prototype that uses the
  `/store/kpis` Store Manager rhythm while preserving the checklist operation
  flow. It is not locked until explicitly approved.
- `docs/prototypes/store-incentives-region-manager-v1.html` is the draft Region
  Manager incentives page prototype. It is not locked until explicitly approved.
- `docs/prototypes/store-incentives-region-manager-command-v2.html` is the
  locked Region Manager `/store/incentives` premium command-center prototype
  and the canonical Store/Admin operational surface reference for compact
  premium density, metric cards, period filters, store review toggles,
  accordion/table rhythm, right drawer, and package-submit dialog.
- `admin-web/src/prototypes/store-feed-region-composer-v1.tsx` is the locked
  production-bound React prototype for `/store/feed`. It defines the Region
  Manager composer command surface, the same read-only feed surface for Store
  Manager and other store roles, pinned-post ordering, inline edit, pin/unpin,
  archive/undo affordance, and compact feed card rhythm. It has no read/seen
  tracking in v1.

## Locked Prototype Contracts

These files are not loose inspiration. When their matching production surface is
implemented, layout, palette, density, status tones, row rhythm, modal/drawer
model, labels, and interaction flow must match unless a documented production
constraint requires a deviation.

Important production boundary:

- Standalone HTML files in this shelf are visual contracts, not production
  runtime contracts. They may lock the target rhythm, but they do not prove that
  the same rhythm can be copy-pasted into the app.
- A prototype that the user expects to see "birebir" in production must be
  accepted as a React/shadcn slice inside the HR Axis app shell or as a shared
  Admin/Store primitive contract. HTML-only acceptance is a concept acceptance,
  not a production-bound parity acceptance.
- If an HTML visual contract is promoted, the first implementation step is to
  move its typography, spacing, token, button, badge, table/list, drawer, and
  route-shell rhythm into shared primitives. Page-local near-match conversion is
  not enough to claim parity.

| Prototype | Surface | SHA-256 |
| --- | --- | --- |
| `docs/prototypes/store-workforce-prototype-v1.html` | `/store/workforce` | `93390D1705B9DFEC74E3ACF084320FC91B1F31580E45C6FE8A26B479EDCD031F` |
| `docs/prototypes/store-approvals-request-center-v1.html` | `/store/approvals` request center | `F122E2A80F1E9AFFDCCF2942F6E3F609942409527047B5452B50874E8AE2CABD` |
| `docs/prototypes/store-home-store-manager-standard-v1.html` | `/store/home` Store Manager dashboard | `B36442A7244FCF4FE85954E4F08C88E2A3684055DD03D854F3C54DA629022E37` |
| `docs/prototypes/store-home-region-manager-standard-v1.html` | `/store/home` Region Manager dashboard | `DF4E1583D39588FFA2B150937DAC3556983A59F781960C8DC986ED396B4A1E81` |
| `docs/prototypes/store-checklist-result-modal-v1.html` | `/store/checklists` result modal | `110EAD19449A59EBB1C84666FC4F66AC9067DEAF7CCF1BF8990917BDFD2DC8B9` |
| `docs/prototypes/store-incentives-region-manager-command-v2.html` | `/store/incentives` Region Manager command center and Store/Admin surface standard reference | `B18107107BB91332179F00A93166ECF04038CA6E6878E14DFE8DD2FBECA5BF87` |
| `docs/prototypes/store-workforce-full-ledger-prototype.tsx` | `/store/workforce` Region Manager Norm Kadro full-ledger production-bound prototype | `DBA61AB355FC25B564612873ECAF0C7A927C9D10CAB7D5F148395BE57767CEC3` |
| `admin-web/src/prototypes/store-feed-region-composer-v1.tsx` | `/store/feed` Region Manager composer and read-only store-role feed surface | `145040F4C55444465861059D7DFD5A8EF619865C56AECD1B07224C561EBC64F6` |

## Prototype Implementation Evidence

When a locked prototype is promoted into a production route, the PR evidence
must stay short but complete. Record:

- approved prototype path, source screenshot, or spec reference,
- route, persona, role visibility, and scope matrix,
- real data source for every visible metric, status, row, and action,
- for Store/Admin command surfaces, prototype labels, statuses, toolbar
  controls, drawer copy, and confirmation copy carried into production,
- loading, empty, error, access, and partial-data states,
- desktop and mobile screenshot comparison against the locked prototype,
- intentional production deviations with reasons,
- fake data, demo rows, and prototype-only helper cleanup.

Prototype evidence belongs in the PR or `docs/evidence/*`. This README remains
the prototype shelf and hash registry; it is not a second product-experience
policy.

## Supporting References

- `docs/prototypes/login-pilot-v1.html` and
  `docs/prototypes/login-pilot-v2.html` are historical login exploration
  snapshots. Keep them as context; do not treat them as the current target.
- `docs/prototypes/hr-axis-logo-preview.html` and
  `docs/prototypes/logo-review/` are logo review references for the HR Axis 06
  concept.

## Boundary

These files are references, not a global app theme rewrite.

- Do not apply Plum Glacier globally unless the user explicitly starts that
  track.
- Do not mix the old cream/teal foundation look into newly refactored pilot
  surfaces.
- Do not expose implementation details such as auth, scope, API, OpenAPI, DB,
  Redis, staging, mock, evidence, provider, or debug wording in user-facing
  pages.
- Keep page-level pilot work narrow: one surface, one review story, and browser
  verification when visual behavior matters.

## Asset Note

The HR Axis 06 images are raster prototype assets. If the concept becomes a
production brand asset, create a clean vector package before rollout.
