# Architecture Hardening V5 Closeout

Date: 2026-05-31

## Result

Architecture Hardening V5 is closed.

V5 resolved the parked V4 OpenAPI generator parity drift, completed a safe
OpenAPI helper split, narrowed one competition write boundary, and narrowed one
workforce write boundary. Runtime behavior stayed intentionally unchanged.

Estimated architecture health after V5: `95/100`.

## Merged PRs

| PR | Title | Merge commit | Risk reduced |
| --- | --- | --- | --- |
| #580 | `docs: plan architecture hardening v5` | `02a794c595631c9dadc2f5e53330bd5ece7ae307` | Bounded the V4 parked debt into a finite V5 execution line. |
| #581 | `fix: stabilize openapi generator parity` | `8f749955ad14d127a028701907a5812a40b8be7c` | Repaired OpenAPI generation drift without changing the API contract. |
| #582 | `refactor: split openapi schema helpers` | `ff00b71293ad747e205979b60c013ecd95c295e0` | Moved pure OpenAPI helpers out of the oversized generator while preserving generated output parity. |
| #583 | `docs: characterize competition execution boundary` | `1c96c2a3e6756d88289857f1c81be0558acffd22` | Selected one competition runtime extraction target before moving code. |
| #584 | `refactor: extract competition execution command` | `45f340306b4aa00079dc70b330c0472f92c545fe` | Extracted stage package plan execution persistence without touching scoring or finalization. |
| #585 | `test: characterize seller code approval command` | `7977101626adb6cf3b1836775ca221b55431fa1c` | Locked seller-code approval transaction and duplicate behavior before runtime movement. |
| #586 | `refactor: extract seller code approval command` | `1bba9c56104e6d2db8d1baa62a809ee0421e0120` | Extracted seller-code approval persistence without touching offboarding or access lifecycle. |

## Changed Boundaries

- `backend/nestjs/src/openapi/generate-openapi.ts`
  - Frozen generator baseline reduced from `5256` to `5169` lines.
  - Pure helpers moved to `backend/nestjs/src/openapi/openapi-schema-helpers.ts`.
  - `docs/api/openapi.json` stays unchanged after generation.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
  - Frozen baseline reduced from `1295` to `1245` lines.
  - Stage package plan execution persistence moved to
    `competition-stage-package-plan-execution-command.repository.ts`.
  - Scoring, finalization, review, cancel, clone, DB schema, API contract, and
    workflow semantics stayed unchanged.
- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
  - Source reduced from `910` to `797` lines.
  - Seller-code approval persistence moved to
    `workforce-seller-code-command.repository.ts`.
  - Offboarding approval and access lifecycle closure stayed unchanged.

## Verification Evidence

Across the V5 PR line, the following gates were used where applicable:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
git diff --check
```

PR checks:

- PR #580 through PR #586 were merged only after GitHub checks and Codex review
  channels were clean.
- PR #586 final merge base after closeout input:
  `1bba9c56104e6d2db8d1baa62a809ee0421e0120`.

## Remaining Parked Risk

These are not active generic refactor prompts. Reopen only with a concrete bug,
product trigger, failing gate, or reviewability blocker:

- Competition scoring recalculation and finalization persistence/policy.
- Workforce offboarding approval and access lifecycle closure.
- Further OpenAPI generator movement beyond pure helper extraction.
- Broad E2E decomposition unless gate time, flake rate, or reviewability
  evidence justifies it.
- Redesign-sensitive frontend page splits while Store UI/product shape is still
  moving.

## Rollback

Each V5 runtime PR remains independently revertible. None of the V5 PRs require
DB migration rollback, data repair, queue drain, or external operational repair.
