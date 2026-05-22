# Store Action Target Source Decision V1

## Scope

This evidence records the Store Action / Coaching Loop V1A decision for target
coverage, target miss, and target approval signals.

It does not add a new endpoint, DB table, migration, workflow state machine,
auth rule, KPI scoring rule, target approval rule, target reference rule, UI
surface, notification, or write command.

## Sokrates Decision

Decision:

- Target performance follow-up may enter Store Action through the existing KPI
  exception candidate path for `TARGET_ACHIEVEMENT`.
- `target_distribution_request` remains approval work, not direct Store Action
  coaching work.
- Target coverage states such as `missing`, `pending_region_approval`,
  `pending_change_conflict`, and `stale_reference` remain target-readiness
  signals on the target domain surface.
- Do not create direct target coverage/miss Store Action candidates until
  ownership, deep link, scope, and scoring-reference semantics are explicit.

Why now:

- KPI exception candidates already provide the safe Store Action path for
  off-track target achievement.
- Target coverage/miss can look like coaching work, but it is currently closer
  to data/readiness and approval-state hygiene.
- Treating every missing or stale target reference as store-manager coaching
  would risk hiding approval and target-reference semantics inside Store
  Action.

Repo evidence:

- `storeKpiScoreProfile` marks `TARGET_ACHIEVEMENT` as `scoreBehavior:
  "task_candidate"`.
- Workflow inbox target distribution requests are emitted as
  `sourceType: "target_distribution_request"` and `itemType: "approval"`.
- `TargetDistributionService.getTargetCoverage` summarizes
  `missingEmployees`, `pendingEmployees`, `conflictEmployees`, and
  `staleEmployees`.
- `TargetApprovalQueuePage` displays target coverage/readiness and filters
  attention rows where `targetStatus !== "approved"`.
- Target coverage read scope is already guarded by target distribution service
  tests, and approval action scope is separate from read scope.

Counterargument:

- A direct target-missing candidate would be visible and useful for store
  managers. That can be true later, but only after the owner is explicit:
  missing target reference may require store input, region approval, HR/admin
  correction, or simply a pending workflow. Those are different actions.

Risk:

- LOW for this decision and guard.
- MEDIUM if future code treats all target coverage issues as coaching work.
- HIGH if Store Action starts approving targets, mutating target references, or
  changing `TARGET_ACHIEVEMENT` score interpretation.

Door:

- Two-way door for this docs/contract decision.
- Near one-way-door if future work changes target approval, target reference
  promotion, scoring, or DB state.

Stop rule:

- Stop before creating direct target coverage/miss candidates.
- Stop before changing target approval status, target reference promotion,
  personnel target reference state, or `TARGET_ACHIEVEMENT` scoring.
- Stop if a target source candidate cannot name whether the owner is store
  manager, region manager, HR/admin, or operations.

## Approved V1A Path

Target-driven Store Action follow-up is allowed only when it arrives through
the KPI exception source:

```text
approved target reference / imported performance
-> TARGET_ACHIEVEMENT KPI status-band calculation
-> workflow inbox KPI exception task
-> read-only Store Action candidate
```

This keeps source ownership stable:

- Target distribution owns requests, approvals, and target-reference readiness.
- KPI/reporting owns target-achievement score/status interpretation.
- Store Action owns the read-only candidate interpretation after the KPI
  exception exists.

## Parked Direct Target Path

Direct target candidates are parked:

```text
target coverage row with missing/stale/conflict/pending status
-> direct Store Action candidate
```

Unpark only after these are explicit:

- owner by status family,
- whether the action is coaching, approval, data repair, or operator readiness,
- exact deep link and source reference shape,
- assigned-store read/action scope and negative cases,
- whether Operations Control Tower should summarize the issue instead,
- proof that scoring-reference semantics remain unchanged.

## Verification

Required for this slice:

- `git diff --check`
- `node --test scripts/store-action-readonly-candidates-contract.test.mjs`
- `npm.cmd run test:scripts`

No frontend build, backend build, OpenAPI generation, or Playwright gate is
required because this slice changes only docs and root script contracts.

## Next Decision

Store Action V1A read-only source decisions are now bounded enough to stop
before persisted action-plan V1B.

Do not start V1B until the project explicitly approves:

- action-plan owner and lifecycle,
- DB placement and rollback,
- command authorization and negative scope tests,
- audit event names and payload,
- workflow inbox source/status mapping,
- frontend surface and recovery states.
