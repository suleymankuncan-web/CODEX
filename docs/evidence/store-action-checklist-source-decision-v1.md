# Store Action Checklist Source Decision V1

## Scope

This evidence records the Store Action / Coaching Loop V1A decision for
checklist-derived candidates.

It does not add a new endpoint, DB table, migration, workflow state machine,
auth rule, KPI scoring rule, checklist scoring rule, acknowledgement rule, UI
surface, notification, or write command.

## Sokrates Decision

Decision:

- Checklist receipts remain acknowledgement work, not direct Store Action
  coaching candidates.
- Checklist score follow-up may enter Store Action only through the existing
  KPI exception candidate path for now.
- `BM_CHECKLIST` and `VM_CHECKLIST` are already configured as store KPI
  `task_candidate` metrics, so their operational follow-up should be read from
  KPI exception/status-band evidence rather than inventing a separate checklist
  low-score threshold.
- Do not create direct `checklist_receipt` Store Action candidates until the
  low-score threshold owner and acknowledgement relationship are explicit.

Why now:

- The first Store Action V1A slice derives candidates from KPI exception tasks.
- The source guard parks `checklist_receipt` as an acknowledgement boundary.
- Checklist is the next attractive source, but direct use of raw checklist
  `totalScore` or `complianceRate` would silently introduce a new threshold
  policy.

Repo evidence:

- `storeKpiScoreProfile` includes `BM_CHECKLIST` and `VM_CHECKLIST`.
- Both checklist store-score metrics have `scoreBehavior: "task_candidate"`.
- Workflow inbox KPI exceptions are emitted as `sourceType: "kpi_exception"`
  and `itemType: "task"`.
- Workflow inbox checklist receipts are emitted as
  `sourceType: "checklist_receipt"` and `itemType: "acknowledgement"`.
- Checklist acknowledgement read models expose `totalScore` and
  `complianceRate`, but no direct Store Action low-score threshold owner exists
  in the current Store Action V1A spec.

Counterargument:

- A direct checklist low-score candidate could feel more precise because it can
  link to the exact checklist receipt. That precision is useful later, but it
  becomes unsafe if the system invents a new low-score trigger outside KPI
  grading/status-band rules.

Risk:

- LOW for this decision and guard.
- MEDIUM if future code reads raw checklist scores and creates coaching tasks
  without a documented threshold and owner.
- HIGH if checklist scoring, acknowledgement semantics, or store-score blending
  change as part of Store Action without an explicit source-domain decision.

Door:

- Two-way door. A later direct checklist candidate can be added after source
  policy is explicit.
- Near one-way-door if it changes scoring, acknowledgement, DB state, or
  workflow status semantics.

Stop rule:

- Stop before creating direct `checklist_receipt` candidates.
- Stop before comparing raw checklist scores to a hard threshold not owned by
  an existing rules/config decision.
- Stop before changing acknowledgement status, checklist scoring, checklist
  weights, or store-score blending.

## Approved V1A Path

Checklist-driven Store Action follow-up is allowed only when it arrives through
the KPI exception source:

```text
completed checklist evidence
-> store score / KPI status-band calculation
-> workflow inbox KPI exception task
-> read-only Store Action candidate
```

This keeps source ownership stable:

- Checklist owns visit completion, result evidence, and acknowledgement.
- KPI/reporting owns score contribution and status-band interpretation.
- Store Action owns the read-only candidate interpretation after the KPI
  exception exists.

## Parked Direct Checklist Path

Direct checklist candidates are parked:

```text
checklist receipt totalScore/complianceRate
-> direct Store Action candidate
```

Unpark only after these are explicit:

- low-score threshold source and owner,
- whether acknowledgement remains separate from coaching follow-up,
- whether BM and VM checklist thresholds differ,
- exact deep link and source reference shape,
- assigned-store read/action scope,
- verification for positive and negative role/scope cases.

## Verification

Required for this slice:

- `git diff --check`
- `node --test scripts/store-action-readonly-candidates-contract.test.mjs`
- `npm.cmd run test:scripts`

No frontend build, backend build, OpenAPI generation, or Playwright gate is
required because this slice changes only docs and root script contracts.

## Next Decision

The next Store Action source decision should be target coverage/miss, docs-only
first, unless the user explicitly chooses persisted action-plan V1B shaping.
