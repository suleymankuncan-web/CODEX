# Checklist And Task Workflow Consistency V1

Status: owner-approved for single-PR implementation
Date: 2026-07-29
Risk: R4 (cross-layer workflow and data-integrity correction; no migration)

## Purpose

Correct the checklist execution, Store Manager acknowledgement, and remediation
task flow without changing role authority, official scoring, historical records,
or database schema. The PR has one review story: completed checklist facts,
acknowledgement facts, active drafts, and remediation tasks must remain distinct
and must be presented consistently.

## Locked Product Contract

- A checklist is completed when its instance is `completed` and `completed_at`
  exists. Store Manager acknowledgement and score availability do not gate that
  completion fact.
- Region Manager reads BM and VM results, but Region Manager execution coverage
  and primary CTA are derived only from BM checklist state.
- An active BM draft produces `Devam Et`. Without an active BM draft, the
  primary action is always `Checklist Yap`, including after earlier completions
  in the same month. Results remain a separate secondary action.
- A completed checklist awaiting Store Manager acknowledgement is labelled
  `Mağaza Müdürü Onayı Bekliyor`; it is never labelled as a draft.
- Store Manager sees completed checklist instances separately and in completion
  order. Multiple visits for one store/month remain separate records.
- Store Manager cannot start or resume BM/VM field checklists. Pending results
  open acknowledgement; acknowledged results open read-only detail.
- Acknowledgement creates remediation tasks only for valid non-compliant
  findings. A compliant checklist creates no task and the UI must not promise
  one.
- Every active assigned remediation task remains visible in the current task
  queue independent of its due-date month. Terminal history remains filtered by
  closed/cancelled event month.
- At most one active instance per store and template is selected for resume.
  The start command must reuse an existing active instance under concurrent
  attempts rather than creating a second active draft. No completed instance is
  mutated or reused.
- Existing company/region/store read scope and assigned-store action scope stay
  fail-closed.

## Functional Requirements

- **FR-01:** Command-canvas reads expose actor-action-specific BM active,
  completion, and pending acknowledgement signals while preserving VM read data.
- **FR-02:** Null-score completed instances count as completed but display an
  unavailable score.
- **FR-03:** Region Manager CTA follows active-BM-draft-only resume semantics.
- **FR-04:** A new BM instance may start after any number of completed BM
  instances in the same month.
- **FR-05:** Concurrent duplicate starts return the existing active instance or
  deterministically reject/retry without creating duplicate active work.
- **FR-06:** Store Manager command surface renders one row per completed
  checklist instance and never opens the visits/template-start route.
- **FR-07:** Pending and acknowledged Store Manager rows open their correct
  result modes.
- **FR-08:** Active remediation plans remain visible regardless of whether
  `due_on` falls after the selected period.
- **FR-09:** Checklist acknowledgement invalidates checklist, inbox, command,
  and task-workspace caches.
- **FR-10:** Remediation generation reports `created`, `duplicate`,
  `zero_findings`, or `blocked` honestly; it does not claim task creation for a
  compliant checklist.

## Non-Functional Requirements

- **NFR-01:** No DB migration, DDL, production operation, role grant, or scope
  widening.
- **NFR-02:** Completed instances remain immutable and historical occurrences
  are never collapsed or overwritten.
- **NFR-03:** Start and acknowledgement paths remain idempotent under retries.
- **NFR-04:** No cross-store or cross-role action becomes reachable through the
  UI or API.
- **NFR-05:** Existing mobile and desktop command-canvas layout contracts remain
  bounded; this PR changes workflow content, not the approved visual system.
- **NFR-06:** Backend contract, generated OpenAPI client, frontend model, and E2E
  fixtures remain synchronized.

## Acceptance Criteria

- **AC-01:** BM completed + VM missing is not `Bu ay eksik` for Region Manager.
- **AC-02:** BM completed + acknowledgement pending counts as completed and is
  labelled `Mağaza Müdürü Onayı Bekliyor`.
- **AC-03:** BM completed + no active BM draft shows `Checklist Yap` and creates
  a new instance.
- **AC-04:** Active BM draft shows `Devam Et` and resumes without a start POST.
- **AC-05:** VM-only active draft does not produce Region Manager `Devam Et`.
- **AC-06:** Completed instance with null score remains completed and displays
  `Skor yok`.
- **AC-07:** Two completed visits for the same store/month render as two Store
  Manager records.
- **AC-08:** Store Manager makes no mobile-today/start request and never sees a
  false `şablon yayında değil` state.
- **AC-09:** Non-compliant acknowledgement near month-end creates an idempotent
  task visible immediately in Tasks even when due next month.
- **AC-10:** Compliant acknowledgement returns an explicit no-remediation
  outcome and creates no task.
- **AC-11:** Missing remediation source is observable as blocked and does not
  silently report full success.
- **AC-12:** Cross-store start/acknowledgement and Store Manager start remain
  forbidden.

## Edge Cases

- **EC-01:** Multiple historical completions never choose an arbitrary result;
  history remains occurrence-based.
- **EC-02:** Legacy duplicate active instances resume one deterministic latest
  instance and do not create another.
- **EC-03:** A pending acknowledgement may coexist with a newer active BM draft;
  the label remains acknowledgement-pending while the primary CTA is `Devam Et`.
- **EC-04:** A remediation plan duplicate is treated idempotently.
- **EC-05:** A failure after acknowledgement but before all remediation plans
  complete must be observable and retryable without due-date drift.
- **EC-06:** Istanbul month boundaries are used for completion and terminal task
  history.

## Implementation Slices In This PR

1. Additive backend read/start/remediation contract and tests.
2. Region Manager status/CTA mapping and conflicting E2E replacement.
3. Store Manager checklist-instance surface using the existing acknowledgement
   list contract, with pagination and result modes.
4. Task active-queue period semantics and acknowledgement cache refresh.
5. Cross-flow verification, OpenAPI synchronization if the response contract
   changes, and release evidence.

## Verification

- Backend repository/service unit tests for FR-01, FR-02, FR-05, FR-08, FR-10.
- Backend integration tests for AC-09 through AC-12 and retry behavior.
- Frontend model/unit tests for independent execution/receipt state.
- Targeted Playwright for Region Manager and Store Manager at desktop and mobile
  viewports, including multiple occurrences and false-template regression.
- `npm.cmd run check:affected-verification`.
- Fresh canonical `npm.cmd run check:release` once after targeted proof passes.
- R4 `problem_solver_high` adversarial review before PR merge.

## Rollback

The PR is schema-free. Runtime rollback is one squash revert. Existing
checklist instances, acknowledgements, and remediation plans remain untouched.
If additive response fields are introduced, old fields remain until all
frontend consumers have moved, allowing frontend rollback without API outage.

## Stop Conditions

Stop if the implementation requires a migration, role/scope widening,
historical mutation, production data repair, task creation for compliant rows,
or weakening the assigned-store authorization boundary. Stop if reliable
single-active enforcement cannot be achieved without DDL; in that case retain
deterministic reuse and document the residual concurrency constraint for a
separate owner decision.
