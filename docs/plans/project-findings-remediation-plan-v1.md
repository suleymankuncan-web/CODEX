# Project Findings Remediation Plan V1

Status: completed
Shelf: operating
Last verified: 2026-07-13

## Objective

Close the actionable findings from the July project assessment without opening
a generic refactor, speculative runtime, broad-production, or inferred-data
train. Execution is limited to four ordered PRs:

```text
OT-1 -> INC-1 -> AUTH-1 -> TREF-1
```

Each controlled PR uses a fresh `origin/main`, one review story, squash merge,
scope-appropriate verification, required checks, clean mergeability, and
post-merge `origin/main` verification. GitHub Codex review remains disabled.

## Global Boundaries

- Controlled pilot remains `Conditional Go / Continue`; broad production is
  `No-Go`.
- No production operation, paid-service change, destructive cleanup, staging
  DML/DDL, inferred historical winner, or provider configuration is authorized.
- ORG/ASSIGN correction remains blocked until exact historical authority exists.
- DG1-C retirement remains blocked until a sanitized provider usage window is
  complete.
- Pilot feedback is the primary product signal. Only evidence-backed P0/P1
  findings open an unplanned runtime slice.
- Large-file extraction is allowed only when a real approved change touches the
  file and the extraction preserves behavior; there is no generic refactor PR.

## OT-1 - Operating Truth Alignment

Risk: `R0 docs/process`

Deliverable:

- align `current-state.md`, the project control board, and active next actions
  with merged PRs #971-#975;
- record the completed Admin, Region Manager, Store Manager, Store Personnel,
  Report Viewer, Moi scope, June report/export, and incentive-readback evidence;
- classify account recovery and a fresh cross-person denial as optional evidence;
- retain broad-production, ORG/ASSIGN, and DG1-C gates.

Acceptance:

- no code, runtime, auth, API, DB, provider, scoring, or workflow change;
- the three operating documents agree on B1 status and next action;
- `git diff --check`, `npm.cmd run test:scripts`, and
  `npm.cmd run check:affected-verification` pass.

Rollback: revert the OT-1 squash commit.

Stop: any documentation claim would require or imply a runtime behavior change.

## INC-1 - June Incentive Reason Classification

Risk: `R0 evidence / read-only live`

Deliverable:

- use the existing Super Admin staging read contract to reconcile all June
  `13 blocked + 3 no_source` projections into sanitized state/reason/source
  aggregates;
- classify every bucket as `expected_data_gap`, `owner_input_required`,
  `suspected_code_defect`, or `unknown`.

Acceptance:

- all 16 projections reconcile exactly;
- no name, store, UUID, personnel data, credential, cookie, raw payload, or
  business value is recorded;
- no DML, correction, approval, review, close, or submission occurs;
- any temporary local diagnostic is removed and tracked files return to their
  exact pre-run hashes;
- no runtime fix is opened without a concrete defect.

Rollback: revert the evidence squash commit; the live read has no mutation to
roll back.

External gate: a valid staging Super Admin read session and safe read window.

Stop: if the current response cannot explain the reason, do not widen the
endpoint. Prepare a separate repository-only R3 diagnostic proposal.

## AUTH-1 - Browser Session Account Freshness

Risk: `R5 auth`

Deliverable:

- an application account deactivated after browser-session issue fails closed
  on the next protected request/session readback without waiting for cookie TTL.

Acceptance:

- active accounts retain current browser-session behavior;
- inactive or missing accounts return `401`;
- non-development authorization lookup failure remains fail-closed;
- DB-fresh role and action-store assignment behavior remains intact;
- CSRF, secure cookies, logout, JWT/provider mapping, and API shapes remain
  unchanged;
- Clerk is not revalidated on every request;
- targeted auth tests, backend lint/build/release, affected selection, required
  root checks, and a read-only High adversarial review pass.

Rollback: revert the AUTH-1 squash commit.

External gate: a live deactivate/reactivate smoke requires a separately safe
disposable account and window; it is not implied by this plan.

Stop: schema, migration, provider configuration, or a broader auth-model change
becomes necessary. Split and re-plan instead.

## TREF-1 - Target Reference Supersession Specification

Risk: `R0 decision/spec`

Deliverable:

- lock append-only revision chains, effective dates, manager/store rotation,
  next-day start, preserved snapshots/closed periods, audit history,
  fork/cycle/duplicate-active/concurrency behavior, and rollback;
- produce truth tables and traceable FR/NFR/AC/EC identifiers;
- determine whether the current schema is sufficient;
- define the exact implementation, test, transaction, row-lock, and old-value
  predicate contract.

Acceptance:

- no runtime code, migration, DML, or staging execution;
- all semantics are mechanically testable and rollback is explicit;
- docs gates pass.

Rollback: revert the TREF-1 squash commit.

Owner gate: stop if retroactive revision or closed-period semantics remain
ambiguous.

## Conditional Work - Not Authorized By This Plan

- TREF implementation/staging evidence starts only after TREF-1 is locked; a
  required migration is a separate R5 PR.
- DG1-C runtime contraction starts only after a sanitized provider usage window
  clears removal. Unknown/external use preserves compatibility.
- ORG/ASSIGN starts only after exact historical authority and provenance exist;
  current timestamps never select a winner.
- Broad production requires separately locked RPO/RTO, queue-loss tolerance,
  protected-capacity target, incident ownership, budget, recovery, and final
  owner Go/No-Go.

## Completion

The authorized line completed in order:

| Slice | Result | Merge evidence |
| --- | --- | --- |
| OT-1 | Operating truth aligned | PR #976, `75e6f1a46ced9f8930f1fb4160f1607804bee347` |
| INC-1 | All 16 June non-projected rows classified `owner_input_required`; decision `no_runtime_change` | PR #977, `3fbd26ad6449d89fec1c8a7ead265b138e7ded48` |
| AUTH-1 | Stale browser sessions fail closed against fresh application-account status | PR #978, `cca1b3cbccdc063bf66a96227c33c01787af5378` |
| TREF-1 | Owner decisions and mechanically testable specification locked | This TREF-1 squash commit |

Completion of this train does not authorize the conditional work above. TREF
implementation, DG1-C contraction, ORG/ASSIGN correction, and broad production
remain behind their recorded gates.
