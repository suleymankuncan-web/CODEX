# Frontend TypeScript Strictness Inventory V1

## Reader And Action

Reader:

- A future engineer deciding the first frontend TypeScript strictness PR.

After reading, they should be able to:

- know which stricter flags are already safe,
- know which flags create reviewable work,
- avoid a giant type-assertion PR.

## Sokrates Decision

Claim:

- Frontend TypeScript strictness can be strengthened safely, but only in
  measured steps.

Assumptions:

- A passing temporary compiler flag is a good candidate for a config-only PR.
- A failing flag should be split by error family/domain, not enabled together
  with broad fixes.

Repo evidence:

- The current frontend build passes.
- Temporary `--strict`, `--strictNullChecks`, and `--noImplicitAny` checks pass
  without source changes.
- `--noUncheckedIndexedAccess` and `--exactOptionalPropertyTypes` expose real
  work that should not be mixed into the first config PR.

Counterargument:

- Enabling all strict flags at once would maximize type safety faster. In this
  repo, that would produce a broad cross-page diff and invite type assertions
  instead of useful narrowing.

Risk:

- LOW for the inventory.
- LOW to MEDIUM for a later config-only `strict: true` PR because the compiler
  already passes with `--strict`.
- MEDIUM for `noUncheckedIndexedAccess` fixes.
- MEDIUM to HIGH for `exactOptionalPropertyTypes` because it touches API helper
  payloads, query result state, and many page props.

Door:

- Inventory and config-only strictness are two-way doors.
- Large cross-page type churn becomes harder to review and should be split.

Stop rule:

- Stop if a strictness fix changes runtime behavior, API payload shape, query
  keys, route behavior, auth behavior, or business logic.

## Local Commands Run

Dependency setup:

```powershell
npm.cmd --prefix admin-web ci
```

Result:

- Installed frontend dependencies into the isolated worktree.
- Reported one moderate npm audit finding. This PR does not change
  dependencies.

Baseline build:

```powershell
npm.cmd --prefix admin-web run build
```

Result:

- Passed.

Temporary app compiler checks:

```powershell
npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false --strict
npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false --strictNullChecks
npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false --noImplicitAny
```

Result:

- `--strict`: 0 errors.
- `--strictNullChecks`: 0 errors.
- `--noImplicitAny`: 0 errors.

Temporary node compiler check:

```powershell
npm.cmd exec -- tsc -p tsconfig.node.json --noEmit --pretty false --strict
```

Result:

- 0 errors.

Failing candidate flags:

```powershell
npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false --noUncheckedIndexedAccess
npm.cmd exec -- tsc -p tsconfig.app.json --noEmit --pretty false --strictNullChecks --exactOptionalPropertyTypes
```

Result:

- `--noUncheckedIndexedAccess`: 25 errors.
- `--exactOptionalPropertyTypes`: 66 errors.

## Error Map

### `noUncheckedIndexedAccess`

Main affected areas:

| Area | Error Count |
| --- | ---: |
| KPI grading helper | 4 |
| Admin checklist templates page | 4 |
| Competition stage builder | 3 |
| Store checklist logic | 3 |
| Store checklists page | 2 |
| Audit center page | 2 |
| Admin sidebar | 2 |
| Store sidebar | 2 |
| Report snapshot labels | 2 |
| Store my performance model | 1 |

Pattern:

- Array indexing and split/date parsing assumptions need explicit guards.

### `exactOptionalPropertyTypes`

Main affected areas:

| Area | Error Count |
| --- | ---: |
| Store KPI highlights | 7 |
| Store approvals | 7 |
| Master data bootstrap | 7 |
| Import batch detail | 6 |
| Store checklists | 6 |
| Store home | 4 |
| Integration dashboard | 4 |
| Shared API helpers and scattered route/page props | Remaining errors |

Pattern:

- Optional props and request payloads are often passed as `undefined` rather
  than being omitted.
- Query result state types sometimes model optional data too narrowly.

## Recommendation

First strictness PR:

- Add `strict: true` to the frontend app and node TypeScript configs only.

Why:

- Temporary `--strict` checks already pass for both app and node configs.
- It is a small config-only PR.
- It improves the baseline without cross-page source churn.

Second strictness line:

- Tackle `noUncheckedIndexedAccess` as a small code PR, starting with pure
  helpers and navigation/date parsing before page-level state.

Progress:

- The first `noUncheckedIndexedAccess` implementation slice resolved the 25
  temporary app errors and enabled the flag in both frontend TypeScript configs.
- Fixes were limited to explicit indexing guards/fallbacks for sidebars,
  competition team selection, KPI grading fallback, snapshot/checklist month
  parsing, checklist score maps, audit query arrays, checklist template
  defaults, and store performance trend rows.

Park for later:

- `exactOptionalPropertyTypes` until optional-payload helper patterns are agreed.
  That flag cuts across API wrappers, generated-client payload usage, route
  props, and dense pages; it should not be mixed with the first strictness PR.
