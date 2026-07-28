# Checklist Photo Media Storage Provider Decision V1

Status: owner-approved for PR-3 foundation and PR-4 single-fixture staging proof
Date: 2026-07-27
Risk: R5
Provider: Cloudflare R2 Standard

## PR-4 Scanner Revision

The owner approved a zero-incremental-cost synthetic-only revision on
2026-07-27. PR-4 staging accepts exactly one server-configured SHA-256 fixture
digest and re-verifies the raw bytes at finalization. This adapter reports
`fixture_identity_only`; it is not a malware scanner and cannot satisfy a
real-media safety capability. Empty, malformed, or multiple fixture digests
fail enabled startup. Camera and arbitrary gallery input remain disabled.

No Render ClamAV service and no operational `PHOTO_MEDIA_CLAMAV_*` variables
are part of this bounded proof. Real photographs remain `No-Go` until a
separate R5 owner decision selects, contracts, configures, and proves a genuine
malware-scanner adapter. The provider-neutral scanner port is retained so that
future choice does not rewrite storage or checklist workflow contracts.

## Locked Decision

PR-3 uses two distinct private Cloudflare R2 Standard buckets in the real EU
jurisdiction. A location hint is not sufficient. The primary and recovery
buckets may share one Cloudflare account for the synthetic staging gate only.
Account-level isolation must be reconsidered before real photographs or broad
production.

The two buckets use separate bucket-scoped credentials. Public `r2.dev`
delivery and public custom domains remain disabled. The application issues
short-lived signed URLs only after server-side authorization.

The application hard ceilings are deliberately below the current R2 Standard
monthly free allowance:

- 8 GiB provider-visible storage across primary, thumbnail, raw and recovery;
- 750,000 Class A operations;
- 7,500,000 Class B operations;
- zero-incremental-cost target, with provider billing alerts treated as
  informational rather than enforcement.

These ceilings reduce cost risk but do not guarantee a zero invoice: free-tier
usage is account-wide, provider pricing can change, and provider-side rounding
still applies. Signed-read issuance reserves one Class B operation, but an R2
pre-signed URL can be replayed during its short validity window; therefore the
counter is a fail-closed application issuance ceiling, not a provider billing
spend cap. This residual is accepted for synthetic staging only and must be
reassessed before real photographs. New uploads and new signed-read issuance
fail closed at the application ceilings while governed cleanup remains
available.

Multipart upload concurrency is bounded twice: a process-local guard is
acquired before Multer buffers a request, and a database lease limits
user/store raw provider writes before the initiated asset is uploaded.

Cloudflare currently documents a 10 GB-month, one-million Class A and
ten-million Class B monthly free allowance for R2 Standard. It also documents
EU jurisdictional restrictions and prefix-based bucket locks. Sources:

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/reference/data-location/
- https://developers.cloudflare.com/r2/buckets/bucket-locks/

## Object And Lock Layout

Server-generated keys separate retention behavior mechanically:

- `transient/` contains raw uploads and receives no provider lock;
- `locked/` contains canonical evidence and receives the 30-day bucket-lock
  rule in both primary and recovery buckets;
- `derived/` contains replaceable thumbnails and receives no provider lock;
- `rehearsals/` contains synthetic restore fixtures and receives no provider
  lock.

The active database retention policy must never be shorter than the 30-day
provider lock window. Raw uploads are promptly removed after verified
canonicalization or by the stale-partial cleanup path. A whole-bucket lock is
not allowed because it would prevent raw and rehearsal cleanup.

## Recovery And Maintenance

- A canonical asset cannot become `ready` until primary and recovery copies
  match the canonical SHA-256 and byte count.
- Ready canonical evidence has an RPO target of zero and a controlled manual
  restore RTO of at most 24 hours.
- The project owner is the initial incident and restore operator.
- `maintenance:photo-media` is the schedulable fail-closed entry point. It first
  retries lease-bound raw, stale-partial and retention cleanup acknowledgements,
  then runs inventory reconciliation and a synthetic restore rehearsal. This
  order lets an idempotent provider delete converge after a process crash.
- Reconciliation verifies active canonical/recovery bytes with `GET` plus
  server-side SHA-256; provider-controlled custom metadata is not integrity
  proof. Retained inactive locked generations remain presence-accounted.
- Reconciliation receipts contain counts and a digest, never object keys,
  credentials, image bytes or business payloads.
- Cleanup claims use row locks and exclude legal, operational, active-workflow
  and AI-review holds. Deletion becomes a durable tombstone only after all
  provider deletions succeed.

## Activation Gate

The merged code remains disabled by default. Before an authenticated staging
smoke, the owner must configure and privately verify both EU buckets, separate
credentials, disabled public delivery, the `locked/` 30-day lock rules, the
exact single-fixture identity adapter, and the approved hard ceilings. No
secret, account ID or real bucket name belongs in Git, logs or evidence
receipts. A genuine malware scanner remains mandatory before any real-media
activation.

Only synthetic fixtures are permitted. Real photographs remain No-Go until the
privacy notice, lawful purpose, provider terms, pilot permission, mobile proof
and later plan gates are explicitly closed.

## Rollback

Before any PR-3 runtime row exists, use the guarded pre-use rollback script.
After use, rollback is feature-disable plus forward repair. Never delete
objects or narrow schema merely to reverse a deployment. Preserve metadata and
objects for governed reconciliation and cleanup.
