# Qwen Region Manager Advisory Pilot v1

Status: implementation runbook; every new gate defaults to `false`.

## Purpose and boundary

This pilot compares an approved VM reference with real store fixture/product
photos and presents a non-binding suggestion to the currently assigned Region
Manager. It never changes checklist completion, campaign state, Store Action,
KPI, ranking, target, incentive or payroll output.

Only reyon and product images are allowed. Do not upload people, receipts,
identity documents, screens containing personal data or license plates. The
service validates image type, strictly decodes a single JPEG/PNG/WebP frame,
re-encodes private WebP canonical/thumbnail copies and removes metadata. This
is not a malware or personal-data scan.

## Safe defaults

Keep these disabled after merge:

```text
PHOTO_MEDIA_REAL_VM_PILOT_ENABLED=false
VISUAL_COMPARISON_ADVISORY_ENQUEUE_ENABLED=false
VISUAL_COMPARISON_WORKER_ENABLED=false
VISUAL_COMPARISON_ADVISORY_REVIEW_ENABLED=false
```

The API and worker must use the exact same company, reference set and
timezone-qualified not-before timestamp. Shadow and advisory enqueue cannot be
enabled together.

## Owner-gated staging activation

1. Confirm the exact company, reference set, not-before timestamp, assigned
   pilot stores and Region Manager.
2. Confirm private primary/recovery bucket health and quota headroom.
3. Confirm the pinned Qwen snapshot, host digest, key and request/token/spend
   ceilings. Use 30–50 comparisons only.
4. Enable real VM photo intake on the API.
5. Capture one allowed image and prove canonical/thumbnail/recovery readiness
   plus raw disposal. Run wrong-store, wrong-item, MIME mismatch, missing
   attestation and malformed image drills.
6. Enable advisory enqueue, then the worker. Confirm only new advisory rows.
7. After terminal rows exist, enable advisory review visibility.
8. Complete the declared cohort and generate only the sanitized aggregate
   receipt. Never export images, URLs, asset IDs, store names, user IDs, free
   text reasons, prompts or provider payloads.

## Rollback

Disable in order: advisory review visibility, advisory enqueue, worker, real
photo intake. Retain immutable media, runs, reviews and audit history under the
existing retention policy. Do not convert advisory rows to shadow or delete
history during rollback.

## Acceptance

- Every cohort row is advisory and inside the exact scope/window.
- Every row has one final human review or an explicitly counted manual fallback.
- Low-confidence, abstained and failed runs cannot be accepted unchanged.
- No official business sink is mutated.
- Authorization, invalid-media, quota, timeout/retry and kill-switch drills are
  recorded as counts only.
