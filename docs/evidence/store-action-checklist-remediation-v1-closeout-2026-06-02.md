# Store Action Checklist Remediation V1 Closeout - 2026-06-02

Status: closed
Shelf: Store Action

## Scope

This closeout records the Store Action `checklist_remediation` implementation
line. It keeps `checklist_receipt` as acknowledgement work and adds a separate
remediation source for real checklist findings.

## Merged PRs

| PR | Merge commit | Result |
| --- | --- | --- |
| #635 `docs: lock store action remediation decisions` | `48bdd679a57c9b961fb0706a9204d01c49bac858` | Locked checklist remediation, target projection, and coaching-loop decisions. |
| #636 `docs: plan checklist remediation implementation` | `4c93a8203849ba7df870f69de56a80059a4dbe79` | Added the reviewable implementation PR sequence and stop conditions. |
| #637 `feat: add checklist remediation source contract` | `3e531a0c108e6e73953b8ba315ba36f8e4ce2634` | Added `checklist_remediation` to the Store Action source contract, schema migration, OpenAPI, generated frontend types, and contract tests. |
| #638 `feat: add checklist remediation finding extractor` | `cfefeecc12b46a812722ed2fec1445e56992b387` | Added the pure extractor for persisted checklist findings. |
| #639 `Store Action remediation PR-3 acknowledgement generation` | `490ab7cfdaaf1ee9b0aa3ebe8dbb3e2eecb30cf1` | Created remediation Store Action plans after acknowledgement from real findings. |
| #640 `Store Action remediation PR-4 task source mapping` | `bc0bfdb727b9a2d0ce41fd93a950f28161ceff7d` | Mapped checklist remediation source labels and read UI copy in Store Tasks. |
| #641 `Store Action remediation PR-5 region read visibility` | `170db8a7798bc0b207d37bd235c374a29f599eb6` | Added scoped region-manager read-only informational visibility. |

## Shipped Behavior

- `checklist_receipt` still means the store manager acknowledged the checklist
  result.
- `checklist_remediation` is a persisted Store Action source type.
- Remediation tasks are created only after successful checklist acknowledgement.
- Remediation tasks are created only from persisted
  `ops.checklist_response.is_non_compliant = true` rows.
- Score-only low rows do not create tasks.
- Source IDs are deterministic:
  `checklist:{checklistInstanceId}:item:{templateItemId}`.
- Duplicate active tasks are prevented by the existing active-source unique
  index and duplicate conflicts are handled idempotently.
- V1 due date is acknowledgement date plus 7 UTC calendar days.
- V1 priority for persisted non-compliant findings is high.
- Store manager write behavior remains assigned-store scoped.
- Store manager closure still requires a resolution note.
- Region managers can read scoped checklist remediation information through the
  workflow inbox path.
- Region-manager rows are informational only and use reported-resolution
  language.

## Preserved Behavior

- API behavior outside the planned Store Action source widening stayed
  unchanged.
- Auth and permission semantics stayed unchanged except the explicit
  region-manager read-only remediation visibility.
- `checklist_receipt` workflow inbox semantics stayed acknowledgement-only.
- KPI exception Store Action behavior stayed unchanged.
- Store Action lifecycle status behavior stayed unchanged.
- Checklist scoring, checklist completion, ranking, target distribution, and
  target projection runtime behavior stayed unchanged.
- BullMQ, import, materialization, and snapshot behavior were not changed.

## Verification Evidence

Local and PR gates across the PR train included:

- Store Action contract tests.
- Store Action schema contract tests.
- backend OpenAPI generation.
- admin API generation/check.
- checklist remediation extractor unit tests.
- checklist acknowledgement generation tests.
- duplicate-generation/idempotency tests.
- assigned-store forbidden-scope tests.
- workflow inbox region-manager scope tests.
- `npm.cmd --prefix backend/nestjs test -- workflow-inbox.service.spec.ts store-action-plan.repository.spec.ts`
- `npm.cmd --prefix backend/nestjs run lint`
- `npm.cmd --prefix backend/nestjs run build`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts`
- `npm.cmd run test:scripts`
- `git diff --check`
- `git diff --cached --check`

GitHub checks were green before each merge. PR #641 completed with Vercel,
Vercel Preview Comments, `frontend-release-check`, `release-check`, and
`release-rehearsal` green.

## Parked Decisions

- Mobile checklist response currently saves score/comment and does not persist
  `is_non_compliant`; mobile-generated low findings do not create remediation
  tasks until the persisted source contract is extended.
- Score-threshold generation remains parked until low-threshold ownership is
  persisted in DB/API/source data.
- Photo/file evidence upload remains outside V1.
- Region-manager verification, approval, reject, reopen, and evidence review
  remain outside V1.
- Target projection remains docs-only in this line.
- Push, email, mobile, or provider-backed notification delivery is not part of
  V1.

## Rollback Shape

Runtime rollback is source-slice dependent:

- UI/read-label rollback removes source-specific labels without data repair.
- Generation rollback can disable the acknowledgement generation path; existing
  generated rows remain ordinary Store Action plans.
- Source-type narrowing after production rows exist would require a data
  decision and must not be treated as a simple rollback.
