# Photo Media Retention Operations PR7 Execution Spec V1

Status: approved through the owner-approved ten-PR parent plan; repository
implementation authorized; cleanup activation and real deletion remain gated
Date: 2026-07-28
Risk: R5
Reviewers: product owner; repository R5 adversarial reviewer
Parent: `checklist-photo-evidence-and-vm-visual-assessment-plan-v1.md`

## Context

PRs #1021-#1025 established immutable media ownership, private synthetic R2
storage, recovery replicas, checklist evidence, Store Action photo review, and
VM reference/campaign records. The current maintenance service can reconcile
known objects, rehearse restore, and claim expired assets with hold checks.

The current expired-cleanup entry point is not sufficient for governed
retention operations: it selects and deletes in one call. It does not freeze a
reviewable candidate set, require the caller to present the exact digest, or
prove that the executed set is the previewed set. Reconciliation also needs
typed coverage for database/link/lifecycle failures, and operators need a
sanitized usage/forecast view before any cleanup is enabled.

PR7 closes those repository contracts without activating scheduled cleanup,
without processing real photographs, and without selecting or calling an AI
provider. Existing synthetic assets remain governed by their pinned retention
policy version and all legal, operational, workflow, AI-review, and provider
lock holds.

## Decisions

- **D-PR7-01:** Retention deletion MUST be a two-command workflow: immutable
  dry-run manifest, then exact manifest ID plus digest execution.
- **D-PR7-02:** A manifest item MUST pin asset ID, company ID, asset state,
  canonical hash, accounted bytes, expiry, retention-policy identity/version,
  and an eligibility digest. It MUST NOT store object keys, URLs, credentials,
  image bytes, or business payloads.
- **D-PR7-03:** Execute MUST re-lock every item and recheck the pinned values,
  holds, expiry, object-lock safety, and manifest status. Any stale/held item
  fails the whole unclaimed execution before provider deletion.
- **D-PR7-04:** Provider deletion remains lease-bound and retryable. A durable
  tombstone is written only after all primary, recovery, and derivative
  deletions succeed.
- **D-PR7-05:** Scheduled cleanup is false by default. Manual preview is
  read-only; manual execute and scheduled execute remain unavailable unless
  the dedicated cleanup control is enabled.
- **D-PR7-06:** Reconciliation receipts classify missing, mismatched, orphan,
  dangling-link, stuck-upload, stuck-purge, protected-expiry, and tombstone-
  residue findings. Receipts contain counts and digests only.
- **D-PR7-07:** Usage/forecast is derived from authoritative DB counters and
  asset rows. It is advisory and sanitized; it does not promise provider
  billing parity.
- **D-PR7-08:** `derived_artifact` assets use the pinned policy's
  `derived_retention_days`. The exact shorter duration remains a company policy
  owner choice; creation and restore MUST preserve it, and code MUST NOT
  hard-code 180, 30, or another value.
- **D-PR7-10:** Manual preview/execute are restricted to the actor's company
  scope. Aggregate provider usage is returned only when that scope covers every
  company, including inactive companies with retained history.
- **D-PR7-09:** Real-photo, AI, scoring, KPI, ranking, Store Action generation,
  target, incentive, provider, and production behavior remain unchanged.

## Functional Requirements

- **FR-PR7-01:** The system MUST create a bounded dry-run purge manifest from
  currently eligible assets without deleting or leasing provider objects.
- **FR-PR7-02:** The manifest digest MUST be deterministic over the ordered,
  typed, sanitized candidate snapshot.
- **FR-PR7-03:** Execute MUST require the exact manifest ID and digest and MUST
  reject expired, completed, failed, digest-mismatched, or stale manifests.
- **FR-PR7-04:** Execute MUST claim only manifest items, revalidate every hold
  and pinned field, and delete/tombstone idempotently.
- **FR-PR7-05:** Cleanup failures MUST release the item lease, preserve the
  manifest for a bounded retry, and append a sanitized failure event.
- **FR-PR7-06:** Reconciliation MUST report all categories in D-PR7-06 and
  fail closed on integrity violations.
- **FR-PR7-07:** A usage summary MUST report current bytes/operations,
  classification counts/bytes, eligible/protected/stuck counts, recent growth,
  a bounded forecast, and warning/critical threshold states.
- **FR-PR7-08:** Derived artifacts MUST receive `derived_retention_days` from
  their immutable policy version; reference and evidence assets keep their
  existing policies.
- **FR-PR7-09:** The maintenance runner MUST always perform retryable raw/
  partial cleanup and reconciliation, but MUST execute retention purge only
  when scheduled cleanup is explicitly enabled.
- **FR-PR7-10:** Operator documentation MUST define preview, approval,
  execute, retry, reconciliation, restore, legal hold, and emergency stop.

## Non-Functional Requirements

- **NFR-PR7-01 Security:** Maintenance endpoints remain `SUPER_ADMIN` and
  authenticated, company scope is fail-closed, and no object identity or
  private payload is returned.
- **NFR-PR7-02 Integrity:** Manifest/header/items and reconciliation/usage
  receipts are append-only or guarded against mutation.
- **NFR-PR7-03 Concurrency:** Candidate creation and execution use database
  locks, expected status/version, and bounded batches; concurrent workers
  cannot delete the same asset twice.
- **NFR-PR7-04 Recovery:** Disabling cleanup stops new deletion while leaving
  reconciliation and restore available. Deleted bytes are never "restored" by
  changing DB state.
- **NFR-PR7-05 Privacy:** Logs, API responses, audit, manifests, and evidence
  MUST NOT contain object keys, URLs, credentials, image bytes, raw UUID lists,
  personnel data, or provider payloads.
- **NFR-PR7-06 Cost:** Existing 8 GiB / 750k Class A / 7.5m Class B ceilings
  remain authoritative; alerts are advisory and use configured percentages.
- **NFR-PR7-07 Performance:** Preview and usage queries are bounded and indexed;
  provider calls occur only during explicit execute/reconcile/restore paths.
- **NFR-PR7-08 Compatibility:** Existing ready assets, checklist links, action
  attempts, VM references, and campaign submissions remain readable and
  immutable.

## Acceptance Criteria

- **AC-PR7-01 (FR-PR7-01/02):** Given eligible and held expired assets, preview
  includes only eligible assets, deletes nothing, returns counts/bytes/digest,
  and persists the same ordered digest.
- **AC-PR7-02 (FR-PR7-03):** Wrong digest, expired manifest, second execute,
  or a manifest whose item became held/stale is rejected before any provider
  delete.
- **AC-PR7-03 (FR-PR7-04/05):** A valid manifest deletes every exact provider
  object once, writes tombstones after success, and records retryable failure
  without falsely completing the manifest.
- **AC-PR7-04 (FR-PR7-06):** Reconciliation detects and classifies every named
  category while returning no object key or asset-ID list.
- **AC-PR7-05 (FR-PR7-07):** Usage summary derives thresholds from configured
  ceilings and returns `normal|warning|critical|limit_reached` per dimension.
- **AC-PR7-06 (FR-PR7-08):** A derived artifact pins
  `derived_retention_days`; evidence/reference expiry behavior is unchanged.
- **AC-PR7-07 (FR-PR7-09):** With cleanup disabled, the runner cannot create or
  execute a scheduled purge but still performs safe raw/partial retry,
  reconciliation, usage readback, and restore rehearsal.
- **AC-PR7-08 (D-PR7-09):** Contract/isolation tests prove no official score,
  KPI, ranking, competition, Store Action generation, target, or incentive
  import/write path is added.
- **AC-PR7-09 (FR-PR7-10):** The runbook names the exact activation owner gate,
  rollback, retry, legal-hold, and restore procedure.

## Edge Cases

- **EC-PR7-01:** An asset receives a legal/workflow/AI/operational hold after
  preview and before execute.
- **EC-PR7-02:** Retention policy default changes after an asset was finalized;
  the asset keeps its pinned version.
- **EC-PR7-03:** Two preview requests see the same eligible asset; only one
  executable manifest may claim it and the other becomes stale.
- **EC-PR7-04:** Provider delete succeeds but the process stops before the DB
  tombstone; retry treats provider delete as idempotent and completes safely.
- **EC-PR7-05:** Primary/recovery generations include inactive locked objects;
  all retained generations remain accounted and are deleted only by the exact
  manifest execution.
- **EC-PR7-06:** A DB row exists without an object, an object without a DB row,
  or a tombstoned row still has provider bytes.
- **EC-PR7-07:** An upload or purge lease remains after worker failure and is
  classified as stuck only after its configured age boundary.
- **EC-PR7-08:** No recent finalized assets exist; forecast reports zero growth
  rather than divide-by-zero or invented usage.
- **EC-PR7-09:** Alert thresholds are equal/inverted/out of range; enabled
  startup fails closed.
- **EC-PR7-10:** Manifest limit exceeds the bounded maximum or is non-integer;
  request validation rejects it.

## API Contracts

All routes remain under `POST /api/internal/photo-media/maintenance/*` and
require authenticated `SUPER_ADMIN` scope.

```ts
type PurgePreviewRequest = {
  limit: number;                 // 1..100
  reason: "manual_retention_cleanup";
};

type PurgePreviewReceipt = {
  manifestId: string;
  manifestDigest: string;
  candidateCount: number;
  candidateBytes: number;
  expiresAt: string;
  status: "previewed";
};

type PurgeExecuteRequest = {
  manifestId: string;
  manifestDigest: string;        // lowercase SHA-256
};

type PurgeExecuteReceipt = {
  manifestId: string;
  manifestDigest: string;
  claimedCount: number;
  deletedCount: number;
  status: "completed" | "retryable_failure";
};

type RetentionUsageReceipt = {
  current: { bytes: number; classAOperations: number; classBOperations: number };
  recentGrowthBytes: number;
  projectedThirtyDayBytes: number;
  classifications: Array<{ classification: string; assetCount: number; bytes: number }>;
  lifecycle: {
    purgeEligibleCount: number;
    protectedExpiredCount: number;
    stuckUploadCount: number;
    stuckPurgeCount: number;
    cleanupFailureCount: number;
  };
  alerts: Array<{
    dimension: "bytes" | "class_a" | "class_b";
    state: "normal" | "warning" | "critical" | "limit_reached";
    used: number;
    limit: number;
  }>;
};
```

Typed failures are `cleanup_disabled`, `manifest_not_found`,
`manifest_digest_mismatch`, `manifest_expired`, `manifest_not_executable`,
`manifest_stale`, `asset_held`, `manifest_reason_invalid`, and
`provider_delete_failed`.

## Data Models

### `ops.photo_media_purge_manifest`

| Field | Type | Constraint |
| --- | --- | --- |
| `photo_media_purge_manifest_id` | UUID | primary key |
| `source` | TEXT | `manual|scheduled` |
| `status` | TEXT | `previewed|executing|completed|retryable_failure|expired` |
| `manifest_digest` | CHAR(64) | lowercase SHA-256 |
| `candidate_count` | INTEGER | non-negative |
| `candidate_bytes` | BIGINT | non-negative |
| `reason` | TEXT | `manual_retention_cleanup|scheduled_retention_cleanup` |
| `created_by_user_id` | UUID nullable | required for manual; null for scheduled |
| `created_at/expires_at/executed_at` | TIMESTAMPTZ | half-open validity |

### `ops.photo_media_purge_manifest_item`

| Field | Type | Constraint |
| --- | --- | --- |
| `manifest_id, item_no` | UUID, INTEGER | primary key/order |
| `media_asset_id, company_id` | UUID | exact tenant-owned asset |
| `asset_state` | TEXT | V1 `ready` only |
| `canonical_sha256` | CHAR(64) | pinned proof |
| `accounted_provider_bytes` | BIGINT | non-negative |
| `expires_at` | TIMESTAMPTZ | pinned expiry |
| `retention_policy_id/version` | UUID, INTEGER | pinned policy |
| `eligibility_digest` | CHAR(64) | typed row digest |

Both tables deny ordinary update/delete except the narrow manifest status
transition function/transaction owned by the repository. Items are immutable.

Existing `audit.photo_media_reconciliation_run` gains typed non-negative count
columns for the added categories. No object identity is added.

## Execution Sequence

1. Add failing contract/service/repository/config/schema tests.
2. Add migration 067, schema projection, disposable smoke, and guarded pre-use
   rollback.
3. Add typed repository/service contracts for preview, execute,
   reconciliation categories, and usage.
4. Replace direct expired cleanup with preview/execute. Keep raw/partial
   disposal independent because those paths prevent ungoverned transient-byte
   accumulation and do not delete finalized evidence.
5. Add false-by-default cleanup flag and bounded config.
6. Add internal typed endpoints and generated OpenAPI/client contracts.
7. Update the maintenance runner and operator runbook.
8. Run targeted proofs, schema smoke, affected-scope selector, selected
   canonical checks, R5 adversarial review, PR checks, squash merge, and
   post-merge verification.

## Verification

- Targeted Jest: maintenance service, repository, controller, config, schema
  contracts, and isolation.
- `npm.cmd run smoke:photo-evidence-schema`.
- `npm.cmd run smoke:migration:fresh-db` or an explicit migration Conditional
  Go only if Docker is unavailable.
- OpenAPI generate, frontend API generate/check.
- Backend lint/build/release.
- `npm.cmd run test:scripts`.
- `npm.cmd run check:affected-verification` and exactly its canonical result.
- `git diff --check` plus final R5 `problem_solver_high` review.
- GitHub required gate, Vercel if selected, mergeability, squash merge, and
  exact-tree post-merge verification.

## Rollback

Before any manifest row exists, migration 067 may use the guarded pre-use
rollback. After first use, rollback is:

1. disable scheduled/manual execute;
2. preserve manifests, items, events, tombstones, assets, and provider bytes;
3. continue read-only usage/reconciliation and governed restore;
4. repair forward.

Never recreate deleted bytes by marking a tombstone `ready`. Never narrow or
drop used tables. Provider deletion recovery uses the independently verified
recovery posture only when the asset was not validly governed-deleted.

## Activation Gate

Repository implementation and merge may proceed with cleanup disabled. Before
any staging execute or scheduled activation, the owner must approve the
deletion/legal-hold procedure, named operator, exact environment/run window,
manifest expiry/batch, and recovery confirmation. Real photos and production
remain outside this gate.

## Out Of Scope

- Real photos, camera, arbitrary gallery input, or malware-scanner selection.
- AI candidates, benchmark invocation, queue, model output, or reviewer UI.
- Official scoring/KPI/ranking/competition/action/target/incentive behavior.
- Report Viewer AI or private evidence expansion.
- Provider configuration, paid services, staging deletion, or production.
- A polished retention admin UI; PR7 supplies typed operator contracts only.
- Silent shortening of existing asset expiry.

## Stop Conditions

Stop if execution cannot be bound to the exact preview digest, if holds can
change during a live delete lease, if used migration rollback is destructive,
if object identifiers/private payloads enter receipts, if a provider or real
photo is required, or if cleanup must be enabled to prove repository behavior.
