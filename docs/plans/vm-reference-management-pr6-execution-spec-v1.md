# VM Reference Management PR-6 Execution Spec V1

Status: repository implementation locally verified; runtime and grants disabled by default
Base: PR #1024 merge `d3bd8a81f9f40c6e3559266df49968b5de06d152`

## Contract

PR-6 adds a synthetic-only Visual Merchandising reference and campaign
workflow. An explicitly authorized `VISUAL_MERCHANDISER` may draft and publish
one immutable reference version for exact stores and exact VM checklist items.
Publishing pins an immutable Europe/Istanbul half-open campaign window and an
exact store snapshot. Store Managers may submit one ready, assignment-bound
synthetic campaign asset while the window is open. A bounded idempotent
settlement process records honest `on_time`, `missed`, `exempt`, `withdrawn`,
or `operational_hold` coverage facts without changing checklist scores, KPI,
ranking, competition, Store Actions, or incentives.

All runtime controls default to false and all new capability grants default to
empty. PR-6 accepts only the existing approved byte-identical fixture. Camera,
arbitrary gallery bytes, real photos, paid/provider changes, AI comparison,
review mutations, Report Viewer detail, and production activation are outside
this slice.

## Conservative V1 decisions

- Applicability is explicit selected stores plus exact VM template items.
- `allowedVariants` is empty; non-empty variant routing is rejected.
- `requiredEvidenceCount` is exactly one.
- Overlapping scheduled/open campaigns for the same company, store, and
  template item are rejected under locks; no precedence is inferred.
- `VM_REFERENCE_PUBLISHER` and `VM_VISUAL_REVIEWER` are explicit company-scoped
  permission grants. Ordinary VM assignment and Super Admin do not imply them.
- Reviewer permission is read-only in PR-6. Accept/override/reject/recapture is
  reserved for PR-10.
- Published versions, assignment snapshots, submissions, deadline outcomes,
  command receipts, and checklist pins are append-only.

## Runtime controls and rollback

```text
VM_REFERENCE_PUBLISHING_ENABLED=false
VM_CAMPAIGN_SUBMISSION_ENABLED=false
VM_CAMPAIGN_DEADLINE_SETTLEMENT_ENABLED=false
VM_CAMPAIGN_SETTLEMENT_POLL_SECONDS=60
```

Publishing requires healthy synthetic storage and the exact approved fixture.
Submission requires healthy synthetic storage. Settlement never reads media.
Flags do not replace authorization.

Normal rollback disables new publishing while submission and settlement drain
already-open campaigns to their recorded boundary. An emergency stop first
places affected assignments on an atomic audited operational hold, verifies
the receipt, then disables submission and settlement. Recovery requires
reconciliation and an explicit extension/reopen command. Destructive rollback
must refuse after any PR-6 row, capability assignment, pin, receipt, or audit
exists.

## Transaction and authorization invariants

- Effective permission scopes are derived from active role assignments and
  role permissions, remain company/region/store bounded, and participate in
  authorization-context cache versioning.
- Every mutation re-reads persona, permission, company, store, assignment, and
  current revision before returning an idempotent replay.
- Publish locks the draft and every company/store/template target, validates
  one ready reference asset per item, rejects overlap, then atomically writes
  version, revision, full store snapshot, assignments, audit, and receipt.
- Submit locks assignment and campaign revision, verifies exact upload intent,
  store/actor/item binding and database time, then atomically writes immutable
  submission/media, first on-time fact, projection, audit, and receipt.
- Settlement uses bounded `FOR UPDATE SKIP LOCKED` batches. Repeated ticks
  create no duplicate outcome or audit. Held, exempt, and withdrawn assignments
  never become missed.
- Extension, reopen, add, withdraw, exempt, hold, reconciliation, and retirement
  use expected revisions, payload-bound idempotency, required reasons, database
  time, append-only successors, and typed conflicts.
- Logs, receipts, and audit contain no image bytes, signed URLs, credentials,
  bucket names, provider payloads, or private business payloads.

## Traceability

- FR-08 / AC-07: published reference versions are immutable; changes create
  successors and preserve old reads.
- FR-09 / EC-04: new VM checklist instances pin the exact applicable reference;
  later successors never rewrite the pin.
- FR-15 / AC-15 / EC-15: assignment snapshots and Europe/Istanbul half-open
  windows classify before-boundary submission on time and reject the boundary.
- FR-16 / AC-16: repeated settlement creates one deterministic missed outcome
  and one audit event.
- AC-02 / NFR-01: wrong role, grant, company, store, item, assignment, actor, or
  asset fails closed.
- NFR-03 / AC-17: versions, revisions, outcomes, receipts, and reasons are
  append-only and atomically audited.
- AC-18 / EC-16: submit/settle and revise/submit races are serialized with row
  locks and expected-version compare-and-set.
- EC-17: later review timing cannot rewrite the original deadline fact.
- EC-18: add, withdraw, exemption, and reassignment preserve historical scope.
- AC-19 / EC-19: submission/settlement cannot stop on an open campaign without
  an audited operational hold and explicit reconciliation/reopen.
- AC-09: imports, writes, and contract tests prove isolation from official
  scoring, KPI, ranking, action, and incentive paths.
- AC-14: every flag is false and production remains untouched.

## Verification and merge gates

Implementation requires red/green tests for contracts, permissions, time,
state transitions, idempotency, migration forward/rollback/reapply, disposable
database races, OpenAPI, responsive UI, keyboard/axe behavior, and official-path
isolation. It then requires affected-scope selection, backend/frontend release
proof, one fresh root `npm.cmd run check:release`, and R5 adversarial review.

Repository implementation may merge only while grants and runtime remain
default-disabled. Staging mutation additionally requires named publisher,
reviewer, extension/reopen, exemption/scope-revision, and emergency-retirement
owners; exact staging company/stores/window; acceptance of empty variants and
365-day retirement-anchored retention; authenticated synthetic proof; rollback
rehearsal; and representative iOS Safari/Android Chrome interaction. None of
those gates authorizes real photos or production.

On 28 July 2026 the product owner reported that the representative physical
iOS Safari and Android Chrome interaction checks both passed. This closes only
the PR-6 mobile-interaction merge gate. It does not activate a runtime flag,
assign a capability grant, approve a staging mutation, admit non-synthetic
media, or authorize production.
