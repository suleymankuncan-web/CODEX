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
- `docs/prototypes/store-approvals-request-center-v1.html` is the locked Store
  approvals / Talep Merkezi visual contract for the approvals cleanup.
- `docs/prototypes/store-home-store-manager-standard-v1.html` is the locked
  Store Home dashboard visual contract for the Store Manager persona.
- `docs/prototypes/store-home-region-manager-standard-v1.html` is the locked
  Store Home dashboard visual contract for the Region Manager persona.
- `docs/prototypes/store-checklist-result-modal-v1.html` is the locked and
  implemented checklist result modal visual contract for Store Manager
  acknowledgement and Region Manager review contexts.

## Locked Prototype Contracts

These files are not loose inspiration. When their matching production surface is
implemented, layout, palette, density, status tones, row rhythm, modal/drawer
model, labels, and interaction flow must match unless a documented production
constraint requires a deviation.

| Prototype | Surface | SHA-256 |
| --- | --- | --- |
| `docs/prototypes/store-workforce-prototype-v1.html` | `/store/workforce` | `93390D1705B9DFEC74E3ACF084320FC91B1F31580E45C6FE8A26B479EDCD031F` |
| `docs/prototypes/store-approvals-request-center-v1.html` | `/store/approvals` request center | `F122E2A80F1E9AFFDCCF2942F6E3F609942409527047B5452B50874E8AE2CABD` |
| `docs/prototypes/store-home-store-manager-standard-v1.html` | `/store/home` Store Manager dashboard | `B36442A7244FCF4FE85954E4F08C88E2A3684055DD03D854F3C54DA629022E37` |
| `docs/prototypes/store-home-region-manager-standard-v1.html` | `/store/home` Region Manager dashboard | `DF4E1583D39588FFA2B150937DAC3556983A59F781960C8DC986ED396B4A1E81` |
| `docs/prototypes/store-checklist-result-modal-v1.html` | `/store/checklists` result modal | `110EAD19449A59EBB1C84666FC4F66AC9067DEAF7CCF1BF8990917BDFD2DC8B9` |

## Prototype Implementation Evidence

When a locked prototype is promoted into a production route, the PR evidence
must stay short but complete. Record:

- approved prototype path, source screenshot, or spec reference,
- route, persona, role visibility, and scope matrix,
- real data source for every visible metric, status, row, and action,
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
