# Qwen PR-9 Hidden Shadow Queue Execution Plan V1

Status: owner-authorized implementation slice

## Scope

Reuse `ops.visual_comparison_run` as the durable shadow work ledger. A worker-only
reconciler selects finalized VM campaign evidence for one configured company,
reference set, and not-before timestamp, creates deterministic queued runs, and
dispatches only run identities to a dedicated BullMQ queue. The worker reads
private canonical media, calls the merged PR-8B provider-neutral adapter, and
writes only sanitized shadow results back to the run ledger.

No controller, DTO, OpenAPI, frontend, auth, checklist score, assignment review,
Store Action, KPI, ranking, target, incentive, report, or official score behavior
changes in this PR.

## Runtime Gates

- enqueue and worker flags default to `false`;
- enabled runtime requires BullMQ, an exact company/reference-set/not-before
  scope, exact Qwen snapshot/host digest, server-side secret, request/token/spend
  ceilings, and bounded attempts/concurrency;
- tests use fakes and make no Qwen, R2, Redis, staging, or production call.

## Acceptance

- identical canonical reference/evidence/policy inputs create one run;
- lost dispatch is recoverable because queued ledger rows are reconciled again;
- duplicate queue delivery does not call the provider twice;
- only ready canonical WebP media with matching digests reaches the adapter;
- timeout/unavailable failures are retryable; configuration, schema, model,
  request, disabled, and budget failures are terminal;
- request/token/spend ceilings are reserved atomically in the durable ledger
  and survive worker restart or replica changes;
- stale processing is recoverable while attempt-number compare-and-set rejects
  stale completion/failure writes;
- disabling either flag stops new provider work without affecting manual VM
  submission or review;
- targeted tests, isolation contracts, backend lint/build, affected selection,
  final R5 review, and the selected canonical release are green before merge.

## Rollback

Set both flags to `false`. Queued/shadow records remain inspectable and manual
VM workflows continue. Code rollback is one squash revert.
