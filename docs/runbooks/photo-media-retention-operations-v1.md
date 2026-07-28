# Photo Media Retention Operations V1 Runbook

Status: repository capability only; cleanup execution is disabled by default.

This runbook covers synthetic staging media only. It does not authorize real
photographs, production use, paid services, AI processing, or a deletion run.
Never paste object keys, signed URLs, credentials, asset UUIDs, image content,
or business payloads into tickets, PRs, logs, or evidence documents.

## Runtime switches

- `PHOTO_MEDIA_SCHEDULED_RETENTION_CLEANUP_ENABLED=false` is the safe default.
- `PHOTO_MEDIA_RETENTION_MANIFEST_TTL_MINUTES=60` limits the approval window.
- `PHOTO_MEDIA_RETENTION_WARNING_PERCENT=70` and
  `PHOTO_MEDIA_RETENTION_CRITICAL_PERCENT=85` classify usage alerts.
- Existing hard byte and operation ceilings remain authoritative.

Changing the cleanup switch to `true` is a destructive-operation activation.
It requires a separately approved staging target and run window, named
operator, reviewed legal/workflow/AI/operational holds, exact manifest digest,
verified recovery posture, rollback-only rehearsal, and explicit commit
authority. No approval in the implementation PR satisfies this gate.

## Safe preview

1. Confirm the runtime is synthetic-only and the intended target is staging.
2. Confirm reconciliation and restore rehearsal are green.
3. Call `POST /api/internal/photo-media/maintenance/retention/preview` as
   `SUPER_ADMIN` with a bounded `limit` (1-100) and
   `reason=manual_retention_cleanup`.
4. Record only the returned manifest ID, SHA-256 digest, candidate count,
   candidate bytes, expiry, and status. Do not extract object identities.
5. Review the candidate count/bytes, current usage summary, all hold owners,
   recovery proof, and manifest expiry before requesting execution approval.

Preview is read-only with respect to provider objects. Its immutable manifest
items pin asset/company identity, state, canonical digest, accounted bytes,
expiry, and retention-policy identity/version without storing object keys.

## Exact execution

Execution is permitted only after the activation gate above is independently
satisfied.

1. Set the cleanup switch to `true` only for the approved run window and deploy.
2. Submit the exact manifest ID and digest to
   `POST /api/internal/photo-media/maintenance/retention/execute`.
3. The service locks and revalidates the complete manifest before any provider
   deletion. A changed hold, expiry, policy proof, state, lease, digest, or
   manifest status rejects the whole claim.
4. Confirm the sanitized completion receipt and reconciliation result.
5. Restore the switch to `false`, deploy, and confirm the disabled state.

Never re-create a manifest to bypass a stale/held rejection. Investigate the
new state and obtain a new approval if another preview is appropriate.

## Failure and retry

- A provider deletion failure records a retryable failure, releases the asset
  lease through the existing failure path, and preserves the manifest receipt.
- A process interruption may leave an execution lease. Do not manually edit
  it. Wait for expiry, reconcile, verify provider/DB state, and retry the exact
  manifest only with renewed approval.
- Provider delete is idempotent; tombstone recording is lease-bound. A missing
  object is investigated through reconciliation, never hidden by changing the
  manifest.
- Disable cleanup immediately if failures, unexpected counts, hold conflicts,
  recovery degradation, or usage anomalies occur.

## Reconciliation and usage

Reconciliation is fail-closed for missing objects, hash/byte mismatches,
orphans, dangling active links, stuck uploads, stuck purge leases, protected
expiry, and tombstone residue. Protected expiry is reported but is not itself a
deletion candidate. Usage output contains only aggregate bytes, operation
counts, classification totals, growth projection, lifecycle counts, and
threshold states.

## Rollback

Code rollback is safe while cleanup remains disabled. Database rollback
`db/rollback/067_photo_media_retention_operations_v1.rollback.sql` is pre-use
only and refuses after a manifest or post-migration reconciliation receipt
exists. Once used, preserve the schema/evidence and roll forward with a new
migration. Never delete manifest or reconciliation evidence to force rollback.

## Real-photo and production gate

This runbook does not change the current No-Go. Real photographs still require
a genuine malware scanner, privacy/data-processing approval, capture notice,
provider terms, access review, and separately approved rollout. Production
remains outside scope.
