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
