# Checklist Photo Evidence And VM Visual Assessment Plan V1

Status: core product boundaries locked; listed owner gates remain unresolved;
implementation not authorized by this document
Risk: R5
Date: 2026-07-27
Shelf: Checklist / Store Action / Visual Merchandising

## Reader And Required Action

This plan is for the engineer or agent who will add photographic checklist
evidence, photographic Store Action resolution, Visual Merchandiser reference
publishing, and provider-neutral visual assessment.

After reading, the implementer should know:

- which product decisions are already locked;
- which existing checklist and Store Action meanings must be preserved;
- the required authorization, media, audit, retention, and failure contracts;
- the exact implementation sequence and rollback boundary;
- why AI output must remain shadow/advisory during the first pilot;
- which decisions still require a later owner gate.

This is a plan, not runtime authority. It authorizes no database change,
provider activation, staging write, production operation, paid service, or AI
model selection by itself.

## PR-4 Synthetic Fixture Safety Decision

The owner approved a bounded PR-4 exception on 2026-07-27. Synthetic staging
may accept exactly one pre-approved, byte-identical fixture through a
server-side SHA-256 identity check. This is fixture identity verification, not
malware scanning. A changed byte, an empty or multiple-digest allowlist, client
attestation, or an elevated role cannot broaden the accepted input.

The fixture digest is checked before the raw provider write and again after the
raw object is read for finalization. A mismatch fails closed before image
processing, canonical/recovery writes, evidence linking, or readiness. Camera
and arbitrary gallery input remain disabled. Real photographs remain `No-Go`
until a separate R5 owner decision configures and proves a genuine malware-
scanner adapter, privacy/provider gates, and representative-device evidence.
No Render ClamAV service is authorized for this synthetic PR-4 proof.

## Executive Decision

HR Axis will treat photographs as versioned operational evidence, not as
ordinary UI attachments.

The first useful product line is human-reviewed photo evidence:

1. A checklist item may require, allow, or forbid photographic evidence.
2. Region Managers and Visual Merchandisers may capture evidence while
   executing an authorized checklist.
3. A Store Manager resolves every checklist-derived V2 action with a required
   note and solution photograph.
4. That submission does not close the action. It enters
   `solution_review_pending`.
5. The responsible Region Manager compares the finding evidence and solution
   evidence, then approves or rejects it.
6. Approval closes the action; rejection returns it with a reason.

The second product line is Visual Merchandising reference comparison:

1. Visual Merchandising publishes an immutable reference version.
2. A store captures evidence against the pinned reference version.
3. A provider-neutral worker may evaluate the pair asynchronously.
4. During the first pilot, the result is shadow/advisory evidence only.
5. It cannot alter checklist scores, store scores, KPI, ranking, competition,
   Store Action creation, or incentives.
6. Visual Merchandising may accept, override, or reject the advisory result.

The AI provider and exact model are deliberately deferred. They will be chosen
later from a labelled benchmark, real cost, latency, residency, privacy, and
contract evidence.

## Existing Product Truth To Preserve

### Checklist engine

- BM and VM use one checklist engine with role-specific template types and
  permissions.
- Completed checklist instances and their scored responses remain immutable.
- Visual Merchandisers act only on explicitly assigned stores.
- Store Managers see their own store's completed checklist results.
- Missing VM checklist coverage is not an automatic zero.
- Multiple completed VM visits may exist for one store in one month.

### Checklist acknowledgement and remediation

- `checklist_receipt` means acknowledgement, not remediation.
- `checklist_remediation` means operational work created from a real persisted
  non-compliant finding after acknowledgement.
- The stable remediation source remains
  `checklist:{checklistInstanceId}:item:{templateItemId}`.
- Current V1 Store Action closure requires a resolution note and gives the
  Region Manager informational visibility only.
- This plan introduces photographic resolution and Region Manager review as a
  separately versioned V2 lifecycle. It must not silently reinterpret existing
  terminal records.

### Official scoring boundary

Checklist scores already feed store KPI, ranking, and competition. Therefore:

- original human checklist scoring remains authoritative;
- AI records must be stored outside official response and total-score fields;
- no experimental field may enter reporting snapshots or scoring evaluators;
- incentives remain independent from checklist and visual-assessment data.

## Goals

- Make checklist evidence defensible, private, scoped, and auditable.
- Let templates configure photo evidence per checklist item.
- Add a human-reviewable before/after remediation loop.
- Let Visual Merchandising publish versioned reference sets.
- Support asynchronous, replaceable visual-assessment providers without
  coupling the domain to one vendor.
- Preserve manual scoring and review when queue or AI delivery is unavailable;
  preserve drafts and fail closed when required-evidence storage is unavailable.
- Establish measurable pilot gates before any scoring promotion.
- Keep storage growth and retention visible and configurable.

## Non-Goals

- No second checklist engine.
- No public or permanent image URLs.
- No face recognition, identity inference, demographic inference, employee or
  customer surveillance.
- No image generation.
- No AI-written official score, KPI, ranking, competition, task, or incentive.
- No synchronous AI dependency in checklist completion.
- No production activation in this plan.
- No broad redesign of checklist, Store Action, or reporting modules.
- No provider choice before benchmark and contractual evidence.
- No retroactive rewriting of completed checklist history.

## Locked Product Decisions

### D-PHOTO-1 — Per-item evidence policy

Each published checklist template item owns one explicit policy:

```text
none | optional | required
```

`required` blocks checklist completion until a valid, finalized evidence asset
is linked to the item. A quarantined, failed, deleted, or incomplete upload does
not satisfy the rule.

Each checklist instance pins the exact immutable template version, item, and
evidence policy at creation. A later template publication cannot tighten or
relax an in-progress or completed instance. One asset satisfies only one exact
instance item and purpose in V1; cross-item reuse or semantic item matching is
not allowed.

### D-PHOTO-2 — Capture source

Camera and gallery are both allowed. The server records the declared source as
`camera` or `gallery`. Source is evidence metadata, not proof of authenticity.

### D-ACTION-1 — Human-reviewed closure

A Store Manager must submit a required solution note and at least one valid
solution photograph for every checklist-derived remediation operating under
the V2 lifecycle. Submission moves the action to `solution_review_pending`; it
does not close the action.

The scoped Region Manager may:

- approve, which closes the action;
- reject with a required reason, which returns the action for correction.

### D-VM-1 — Reference ownership and immutability

Visual Merchandising publishes reference images directly through a distinct
company-scoped `VM_REFERENCE_PUBLISHER` permission; ordinary VM assignment
alone does not grant publishing authority. Advisory comparison review requires
the separate `VM_VISUAL_REVIEWER` permission. A published reference version is
immutable. Changes create a successor version. Every comparison pins the exact
checklist template version, item, reference item, and reference version used.

### D-VM-2 — Campaign window and deadline

Every published VM reference campaign owns an explicit submission window:

```text
starts_at | submission_closes_at | timezone = Europe/Istanbul
```

For example, a campaign beginning on `2026-07-05` and ending on `2026-07-10`
opens at `2026-07-05 00:00:00` and uses the exclusive close boundary
`2026-07-11 00:00:00` in `Europe/Istanbul`. Therefore all of 10 July is
included without relying on fragile `23:59:59.999` rounding. The database
stores timestamp instants; the business window is interpreted and displayed in
that named timezone.

At publication, the campaign pins its immutable reference version and an exact
company/store assignment snapshot. A later Region Manager, Store Manager, or
store-assignment change does not silently remove or transfer the campaign
obligation. Adding or removing a store requires an explicit, audited scope
revision; historical assignments remain visible.

A store is on time when its first valid, finalized campaign-evidence submission
is recorded before `submission_closes_at`. VM review may happen after the
deadline and does not turn an on-time submission into a late one. If no valid
submission exists when the window closes, the assignment becomes `missed` and
the product shows `Süresi geçti — Yapılmadı`.

Deadline outcomes including `missed`, `exempt`, `withdrawn`,
`operational_hold`, and reopened successor outcomes are operational coverage
facts only. They do not create a zero score, change
checklist/KPI/ranking/competition/incentive values, or generate Store Action
work without a later explicit scoring/workflow decision.

The ordinary store flow cannot submit at or after `submission_closes_at`. A
deadline may be extended before closure only by an authorized publisher, with
a required reason and append-only audit. Reopening or extending a closed
campaign is a separate explicit command; it never edits the old deadline
invisibly or erases the original `missed` event.

The server, not only the UI, enforces the half-open submission interval:

```text
starts_at <= database_finalized_at < submission_closes_at
```

Extension, reopen, store add/remove, exemption, finalization, and deadline
settlement all lock the campaign plus affected assignment, require the expected
revision/version, use authoritative database time, and commit the state change
and audit event atomically. A stale command fails with a typed conflict.

An authorized, reasoned `exempt` decision may cover closure, renovation,
technical impossibility, or another approved operational exception. Exemption
is not completion and remains separately reportable.

If submission infrastructure is disabled or unhealthy during an open window,
affected assignments enter an audited `operational_hold` before submission is
stopped. Deadline settlement cannot mark them `missed` while that hold is
active. Recovery requires reconciliation and an explicit extension/reopen
decision; elapsed outage time is never silently ignored or converted into
store failure.

### D-RETENTION-1 — Configurable rolling retention

The initial company policy is 365 days. It must not be hard-coded. A future
owner may change the default, for example to 180 days, without a code release.

Every asset receives `expires_at` using a recorded retention-policy version at
finalization. Changing the default affects future assets by default. Shortening
existing assets requires an explicit administrative action and an impact
preview; it cannot happen silently.

Assets linked to an open checklist, open action, pending Region Manager review,
active legal hold, or active AI review are protected from cleanup.

For a published reference, the retention clock begins only when that reference
is retired or superseded, not when it is first published.

### D-AI-1 — Shadow/advisory only

AI comparison begins in shadow mode. It produces structured advisory evidence
for authorized human reviewers. It must never write to or indirectly influence:

- checklist response score or checklist total score;
- KPI, ranking, or competition;
- Store Action generation or priority;
- incentive projection, correction, or finalization.

Promoting AI output to an official decision is a future R5 owner decision and
separate implementation line.

### D-AI-2 — Provider deferred

The provider and model are not locked. Runtime code must depend on a
provider-neutral comparison port. Selection follows the benchmark and provider
contract gate defined below.

## Roles And Authorization

Read scope and action scope remain separate. Every media operation derives the
company, store, checklist instance, template item, action, and reference from
server-side records. The client may never supply authoritative tenancy or
ownership identifiers.

| Role | Evidence read | Evidence upload | Reference publish | Resolution review | AI result |
| --- | --- | --- | --- | --- | --- |
| Store Manager | own store | own-store solution evidence and own-store VM campaign evidence | no | submit only | own-store advisory read only when exposed |
| Region Manager | assigned region/stores | authorized BM checklist evidence | no | approve/reject assigned-store submissions | assigned-region advisory read |
| Visual Merchandiser | assigned stores and relevant references | authorized VM checklist evidence | only with `VM_REFERENCE_PUBLISHER` | no | only with `VM_VISUAL_REVIEWER` and approved scope |
| Report Viewer | company-wide read only | no | no | no | denied until a later explicit surface decision |
| HR Admin | company-scoped policy/template administration | no personal execution bypass | no VM reference publish unless separately assigned | no operational bypass | aggregate/read according to policy |
| Super Admin | company policy and emergency administrative controls | no silent impersonation | administrative recovery only | audited override only if separately implemented | configuration and audit |

Mandatory negative tests include cross-company, cross-store, unassigned-store,
wrong-template-type, expired assignment, guessed asset ID, replayed signed URL,
and revoked action scope.

## Domain Model

The implementation should use dedicated relational ownership rather than
embedding media IDs or provider URLs inside opaque checklist JSON.

### `media_asset`

Owns the durable asset lifecycle and safe storage identity:

- opaque asset ID;
- company and classification;
- server-generated object key;
- original upload state and canonical derivative state;
- detected MIME, width, height, bytes, and hashes;
- capture source;
- uploader and timestamps;
- quarantine/rejection reason;
- retention policy version and `expires_at`;
- deletion/tombstone state and reason;
- legal/operational hold state.

Provider URLs and credentials are never persisted as business data.

### `checklist_response_media`

Links an asset to one checklist instance, one template item, and one response
purpose. It preserves ordering and the exact completed checklist history.

### `store_action_plan_evidence`

Links finding and solution assets to a checklist-derived action. It records
purpose (`finding` or `solution`), submitter, submission attempt, and review
association without changing the stable remediation source ID.

### `visual_reference_set`

Owns a named VM campaign/reference family, company scope, applicability dates,
target store/layout metadata, `starts_at`, `submission_closes_at`, business
timezone, and lifecycle (`draft`, `scheduled`, `open`, `closed`, `retired`).

### `visual_campaign_assignment`

Owns the store obligation and current projection. It records
campaign/reference version, company/store, current window/scope revision,
first valid submission time for that revision, current deadline classification,
current review state, current hold, optimistic version, and the audit identity
of every explicit scope or deadline command.

### `visual_campaign_revision`

Owns immutable, append-only publication/window/scope revisions. Each revision
records its parent, exact reference version, start and exclusive close instant,
business timezone, assigned-store snapshot/delta, reason, actor, and effective
time. Extending or reopening creates a successor; it never overwrites the
original window.

### `visual_campaign_assignment_outcome`

Owns the immutable outcome of one store under one campaign revision. Previous
`missed`, `on_time`, `exempt`, or `withdrawn` outcomes remain queryable after a
successor revision. The current projection points to the active revision while
history/reporting can show original and successor outcomes together.

Deadline compliance and human review are separate axes so a late review cannot
rewrite submission truth:

```text
deadline_status:
scheduled | open | on_time | missed | exempt | withdrawn | operational_hold

review_status:
not_submitted | review_pending | correction_requested | completed
```

`missed` requires database `now >= submission_closes_at` and no valid on-time
submission. Repeated scheduler runs are idempotent and cannot duplicate the
transition or audit event. Review transitions never rewrite `deadline_status`.

Adding a store after publication requires an explicit successor revision and
explicit start/close window; it never inherits an ambiguous elapsed deadline.
Removing a store creates a reasoned `withdrawn` outcome rather than deleting
the obligation. Reopening a missed assignment creates a successor opportunity
while the original `missed` outcome remains visible. Submit authorization is
always checked from fresh current role/store scope even though the obligation
snapshot itself is historical and immutable.

### `visual_reference_item`

Owns the immutable versioned rubric item, reference version, expected visual
intent, allowed variants, and review instructions.

### `visual_reference_item_asset`

Links one or more canonical reference images to the exact reference item
version.

### `visual_comparison_run`

Stores experimental provider-neutral assessment evidence:

- store evidence asset and exact reference version;
- normalized hashes;
- rubric and prompt versions;
- provider adapter and model identifiers;
- start/end/status, attempts, latency, and bounded cost metadata;
- structured dimension results, confidence, reasons, and abstention;
- isolation classification fixed as `shadow` or `advisory`.

It contains no foreign-key or write path that promotes its score into official
checklist, KPI, ranking, competition, action, or incentive fields.

### `visual_comparison_review`

Append-only human review of a comparison run: accept, override, reject, or
request recapture; reviewer, reason, before/after structured values, and time.

## State Machines

### Media lifecycle

```text
initiated
  -> uploaded
  -> quarantined -> accepted -> canonicalized -> ready
  |             |            |                -> rejected
  |             |            -> rejected
  |             -> rejected
  -> rejected

ready -> expired -> purge_pending -> deleted_tombstone
```

Any validation failure moves to `rejected` with a typed reason. Partial and
abandoned uploads are cleaned separately and never become evidence.
Raw uploads are quarantine-only: they are never viewable or model-readable and
are promptly disposed after successful canonicalization or terminal rejection,
subject only to an explicitly approved security hold.

### Store Action photographic remediation V2

```text
open
  -> in_progress
  -> solution_review_pending
  -> closed

solution_review_pending
  -> correction_required
  -> in_progress
```

Rules:

- solution submission requires a note and ready evidence;
- only the action's current `owner_user_id`, who must also pass current
  assigned-store Store Manager action scope, may submit;
- only the assigned-region Region Manager may approve or reject;
- rejection requires a reason;
- each submission and review remains append-only evidence;
- every submission has an immutable attempt ID and the action owns one
  current-attempt pointer;
- submit/resubmit/review uses a row lock, expected state/version compare-and-set,
  and idempotency key in one transaction;
- a reviewer cannot approve a superseded or stale attempt;
- old V1 terminal actions are not reopened or backfilled automatically.

### VM reference lifecycle

```text
draft -> published -> retired
```

Published content cannot be edited. A successor must retain ancestry and an
effective date. Existing checklist/comparison records continue to point to the
version they used.

### Visual comparison lifecycle

```text
queued -> processing -> completed
                    -> abstained
                    -> failed_retryable
                    -> failed_terminal

completed | abstained -> human_reviewed
```

Provider failure, queue backlog, or abstention never changes the official
checklist result and never blocks the manual workflow.

## Checklist Capture Flow

1. The server returns the published item evidence policy with the checklist
   instance.
2. The user selects camera or gallery and sees a capture notice prohibiting
   faces, customers, badges, screens, plates, and unrelated personal data.
3. The client requests an upload initiation for the exact authorized instance
   and item.
4. The server derives tenancy and storage key, checks quotas, and returns a
   short-lived upload capability.
5. Finalization verifies uploaded bytes, detects the real format, decodes with
   bounded pixels, strips metadata, re-encodes, scans, and creates derivatives.
   During the bounded PR-4 synthetic proof, `scans` means the locked fixture
   identity check above; it does not authorize or represent real-media malware
   scanning.
6. Only `ready` evidence appears in the checklist and can satisfy `required`.
7. Completion performs a final server-side evidence-policy check in the same
   protected command boundary as checklist completion.
8. Completion locks the evidence links used by that completed instance.

If upload infrastructure is unavailable, an item whose published policy is
`required` cannot be falsely completed. The UI keeps the draft, explains the
failure, and permits retry. AI availability is never part of this rule.

## Store Action Resolution Flow

1. A real non-compliant checklist finding creates the existing idempotent
   `checklist_remediation` action after acknowledgement.
2. Finding evidence is visible from the action context when it exists.
3. The Store Manager adds a solution note and solution photograph.
4. Submission changes the action to `solution_review_pending` and records an
   audit event atomically in the same transaction.
5. The Region Manager views before/after evidence with timestamps and source
   context.
6. Approval closes the action and records the reviewer.
7. Rejection requires a reason and returns the action to
   `correction_required`/`in_progress` without deleting prior evidence.
8. Resubmission creates a new attempt; it does not overwrite the previous one.
   If ownership must change, a separately authorized and audited Store Action
   reassignment decision must complete before a different Store Manager may
   submit; this plan does not invent that command.

## VM Reference And Assessment Flow

1. Visual Merchandising creates a draft reference set and rubric.
2. The authorized publisher selects the start/end window, applicable stores,
   required evidence count, and any store/layout variants.
3. Reference images pass the same safe media pipeline as store evidence.
4. Publishing creates an immutable reference version and assignment snapshot.
5. Before `starts_at`, assignments are `scheduled`; while
   `starts_at <= database_now < submission_closes_at`, they are open for
   submission.
6. A VM checklist item or VM campaign submission pins the exact applicable
   checklist-template item and reference version.
7. The own-store Store Manager may submit campaign evidence against that
   reference; an authorized VM may separately capture audit evidence during a
   VM checklist visit. The two purposes remain distinguishable in audit.
8. The first valid finalized submission before `submission_closes_at` freezes
   `deadline_status=on_time` and moves `review_status` to `review_pending`;
   later review timing does not change deadline status.
9. At or after `submission_closes_at`, an idempotent close job marks every
   assignment without a valid submission as `missed`, except assignments with
   `exempt`, `withdrawn`, or `operational_hold` outcome.
10. A transactionally safe outbox/event queues a comparison after evidence is
   ready; no API request waits for the model.
11. The worker loads only the exact authorized canonical objects, calls the
   provider-neutral port, validates structured output, and stores a shadow run.
12. Low-quality, unsupported, or low-confidence inputs produce `abstained` or
   `recapture_required`, never a zero score.
13. Visual Merchandising reviews the result and may accept, override, reject, or
   request recapture with a reason.
14. The official human checklist result and the operational deadline fact
    remain separate and unchanged.

### VM campaign UI contract

The publisher form requires:

- campaign name and instructions;
- immutable reference image version;
- start date and end date;
- applicable stores and store/layout variants;
- required evidence count and capture guidance.

After publication, assigned stores may see the reference while the campaign is
`scheduled`, but the submission action stays disabled until `starts_at`. The
store and VM coverage surfaces use the same honest labels:

```text
Planlandı
Gönderime Açık
Zamanında Gönderildi
İnceleme Bekliyor
Düzeltme İstendi
Tamamlandı
Süresi geçti — Yapılmadı
Muaf
Kapsamdan Çıkarıldı
Operasyonel Beklemede
Yeniden Açıldı
```

Coverage totals separately report deadline compliance and review progress:
assigned, on-time, missed, exempt, review-pending, correction-requested, and
completed stores, plus withdrawn, operational-hold, and reopened successor
counts. `exempt` and `withdrawn` are excluded from the required-submission
denominator but remain visible. Operational-hold stores are excluded from
settlement until reconciliation. No UI label may call a store late merely
because VM review finished after the displayed deadline.

## Media Processing Contract

### Input limits

- Accept raster formats only; initially JPEG, PNG, and WebP.
- Reject SVG, executable/active formats, unbounded animation, and undecodable
  or polyglot content.
- Maximum raw upload: configurable, initially 15 MB per image.
- Enforce configurable dimensions, decoded-pixel ceiling, per-item count,
  per-instance count, per-user/store daily bytes, and concurrent-upload limit.

### Canonical evidence

- Preserve aspect ratio; never crop evidence automatically.
- Long edge: 2048 px when the source is larger.
- JPEG/WebP quality target: 85, subject to measured readability.
- Strip EXIF, GPS, device, and other metadata.
- Do not apply filters or aggressive sharpening.
- Record original-upload hash before disposal/quarantine policy and canonical
  content hash after re-encoding.

### UI thumbnail

- Long edge: 480 px.
- Used only for lists and previews.
- Never sent to the assessment model.

### Quality gate

Detect at minimum blur, severe under/over-exposure, unusable angle, insufficient
coverage, and unsupported dimensions. Failure returns an understandable
`Yeniden fotoğraf gerekli` result. It does not assign a low operational score.

### Fine-detail exception

If a rubric requires price label, typography, or small fixture detail, require
an additional close-up rather than increasing every image to original size.

## Storage And Delivery Contract

- Private buckets only.
- Separate authorization classes and preferably separate prefixes/buckets for
  VM references, checklist evidence, action evidence, and derived artifacts.
- Object keys are opaque and server-generated.
- Reads use short-lived signed delivery after object-level authorization.
- Signed URLs are not stored in business records or audit events.
- The AI worker may read only the exact objects in one claimed job and cannot
  list the bucket.
- Partial uploads, quarantined files, and expired derivatives have dedicated
  cleanup paths.
- Canonical and thumbnail derivatives are generated once; on-demand image
  transformation must not become an uncontrolled billing path.
- Database backup is not evidence backup. Storage recovery, reconciliation,
  missing-object detection, and restore rehearsal are separate required proofs.

## Retention And Cleanup

### Policy

- Initial default: 365 days.
- Company-scoped and versioned.
- Configurable without deployment.
- Reference originals may require a different policy from store evidence;
  derived thumbnails and AI artifacts should use shorter retention where safe.

### Cleanup eligibility

An object is eligible only when:

- `expires_at` is in the past;
- it is not linked to an active checklist, action, review, legal hold, or
  comparison job;
- its canonical business references are reconcilable;
- deletion retry and tombstone handling are available.

Cleanup deletes storage bytes but retains the minimum audit tombstone: asset
ID, content hash, actor/source, created/deleted times, policy version, and
deletion reason. No raw image or personal payload remains in the tombstone.

Normal product users have no evidence-delete command. Every cleanup starts with
a dry-run manifest; the scheduled or explicitly authorized purge consumes that
exact eligible set with digest and reconciliation evidence.

The administrative surface should show current usage, monthly growth,
estimated retention footprint, upcoming cleanup, failed deletions, and protected
expired objects. Manual cleanup is allowed only through the same eligibility
rules and a previewed, audited command.

## Capacity And Cost Baseline

Use these as planning assumptions, not permanent vendor facts:

- canonical evidence average: approximately 850 KB;
- thumbnail average: approximately 80 KB;
- combined stored footprint: approximately 930 KB per photo;
- 1,000 photos per month: approximately 0.93 GB per month;
- rolling 12 months at 1,000 photos per month: approximately 11.2 GB;
- 1,000 audits per month with three photos each: approximately 33.5 GB over a
  rolling 12-month window.

Before selecting storage, recalculate with a real pilot sample and include
reference images, failed/quarantined uploads, audit artifacts, backup copies,
egress, and provider transformation costs. Cost alarms must use configurable
monthly storage, egress, transformation, and AI ceilings.

## Provider-Neutral AI Contract

The application owns a `VisualComparisonPort`; provider SDKs stay behind
adapters. The request contains only:

- exact canonical reference asset(s);
- exact canonical store evidence asset(s);
- a versioned, bounded rubric;
- locale and structured output schema;
- explicit image-detail policy;
- correlation and idempotency identifiers.

The provider response must validate into a typed result such as:

```json
{
  "decision": "pass | partial | fail | abstain | recapture_required",
  "dimensions": [
    {
      "key": "layout_alignment",
      "score": 0,
      "confidence": 0.0,
      "reasonCode": "string",
      "explanation": "string"
    }
  ],
  "overallConfidence": 0.0,
  "qualityFlags": [],
  "modelLimitations": []
}
```

Provider prose alone is not accepted. Unknown fields, invalid ranges, missing
rubric dimensions, unsafe content, or schema drift fail closed into review.
Text visible inside an image is untrusted data and cannot alter system/rubric
instructions.

Required ports:

- `MediaStoragePort`
- `MediaSafetyPort`
- `VisualComparisonPort`
- `VisualComparisonQueuePort`
- `MediaRetentionPort`

## Queue, Retry, And Reliability

- Use a dedicated visual-comparison queue and worker.
- Enqueue through an outbox or equivalent durable boundary after database
  commit.
- Jobs are idempotent on evidence hash, reference version, rubric version, and
  comparison-policy version.
- Retry only typed transient failures with bounded exponential backoff.
- Permanent provider/schema/safety failures go to review/dead-letter state.
- Enforce company and global concurrency, request, token, and cost ceilings.
- Provider circuit breaker and kill switch leave manual checklist and Region
  Manager review available.
- Queue backlog, oldest-job age, failure classes, abstention rate, override
  rate, cost, and latency are observable without logging image contents.

## Audit Requirements

Append-only, tamper-resistant audit must cover:

- upload initiated, uploaded, rejected, quarantined, finalized, viewed,
  downloaded, redacted, expired, deleted, and deletion failed;
- checklist evidence linked/unlinked before completion;
- reference draft created, published, retired, and superseded;
- campaign scheduled, opened, submitted, closed, missed, exempted, extended,
  reopened, and scope revised;
- action solution submitted, approved, rejected, and resubmitted;
- comparison queued, invoked, completed, abstained, failed, and retried;
- human review accepted, overridden, rejected, or recapture requested;
- retention policy changed and cleanup preview/command executed;
- authorization denial for sensitive evidence access.

Record actor, tenant/scope, correlation ID, event time, asset hashes, reference,
rubric, provider adapter, model, prompt/policy versions, and before/after state.
Never record signed URLs, credentials, raw provider payloads containing private
data, or image bytes.

"Append-only" is mechanical, not descriptive. The schema PR must deny ordinary
application-role `UPDATE` and `DELETE` on these audit records through database
privileges/triggers or use an equivalently tamper-evident store. Media,
checklist-completion, solution-submission, and review state changes write their
audit event atomically in the same transaction. The current mobile checklist
save/complete paths must gain these events before photographic evidence is
enabled.

## Privacy And Safety

Before a real-photo pilot:

- approve the exact purpose and user-facing capture notice;
- prohibit faces, customers, badges, receipts, screens, plates, and unrelated
  personal information;
- strip EXIF/GPS and re-encode all accepted images;
- define reject/redaction handling for accidentally captured personal data;
- confirm storage and AI processing region, encryption, subprocessors,
  no-training use, provider retention, and deletion terms;
- define subject-request, legal-hold, incident, and backup-expiry handling;
- run malicious-file, decompression-bomb, quota, replay, and cross-tenant tests.

Real store images must not use a free provider tier whose retention, training,
privacy, or service terms are not contractually suitable.

## AI Benchmark And Selection Gate

Provider choice is a later decision. Benchmark candidates may include current
Gemini and OpenAI multimodal models, but model names, versions, prices, and
availability must be freshly verified when the gate opens.

Prepare:

- 100–150 representative, consented reference/evidence pairs;
- 20–30 hard cases covering low light, angle, occlusion, different layouts,
  close detail, text, and deliberately adversarial content;
- double-reviewed VM labels and human inter-rater baseline;
- identical canonical images, rubric, structured schema, and scoring method for
  every candidate.

Measure:

- mean absolute difference from human labels;
- false pass rate, treated as the critical error;
- false fail rate;
- abstention and recapture accuracy;
- structured-output validity;
- subgroup error by device, lighting, layout, and store class;
- latency, retry rate, and real per-comparison cost;
- human override and appeal rate.

The owner chooses the provider only after seeing the benchmark, privacy/DPA,
residency, no-training, retention, operational, and cost evidence. A cheaper
model may handle normal cases and a stronger model may handle bounded hard
cases, but routing is not authorized until evidence proves it useful.

## Functional Requirements

- **FR-01:** Published checklist items expose `none|optional|required` evidence
  policy.
- **FR-02:** Authorized BM/VM executors can upload camera or gallery evidence
  for an exact checklist item.
- **FR-03:** The server validates, canonicalizes, scans, and finalizes evidence
  before it can satisfy a checklist rule.
- **FR-04:** Required evidence is enforced server-side at completion.
- **FR-05:** Store Managers submit photographic remediation with a note.
- **FR-06:** Region Managers approve or reject solution submissions within
  assigned scope.
- **FR-07:** Rejected/resubmitted evidence preserves complete attempt history.
- **FR-08:** Visual Merchandising publishes immutable versioned references.
- **FR-09:** A checklist/comparison pins its exact reference version.
- **FR-10:** Visual comparison runs asynchronously through a provider-neutral
  adapter.
- **FR-11:** AI output is reviewable, overridable, and isolated from official
  scoring and compensation paths.
- **FR-12:** Retention, cleanup, usage, holds, and tombstones are configurable
  and auditable.
- **FR-13:** Manual checklist and review workflows survive AI outage.
- **FR-14:** Report Viewer remains company-wide read only for approved evidence
  surfaces but has no advisory-AI detail until a later explicit decision; all
  other roles keep their existing scope boundaries.
- **FR-15:** Every published VM campaign owns a Europe/Istanbul start/deadline
  window and an immutable-at-publication store assignment snapshot.
- **FR-16:** An idempotent close process classifies stores without a valid
  on-time submission as `missed` without changing official scoring or creating
  work.

## Non-Functional Requirements

- **NFR-01 Security:** private storage, object-level authorization, server keys,
  bounded signed URLs, safe re-encoding, and negative scope tests.
- **NFR-02 Privacy:** metadata stripping, capture notice, restricted content,
  controlled provider processing, retention, and deletion.
- **NFR-03 Integrity:** immutable completed links, immutable references,
  hashes, append-only reviews, and tamper-resistant audit.
- **NFR-04 Availability:** async AI, idempotent jobs, retry limits, circuit
  breaker, and manual fallback.
- **NFR-05 Performance:** uploads do not block unrelated reads; list surfaces
  use thumbnails; canonical objects are loaded only on demand.
- **NFR-06 Cost:** configurable quotas and alarms for storage, egress,
  transformation, queue, and model use.
- **NFR-07 Accessibility:** capture, upload, progress, error, comparison, and
  review controls are keyboard/screen-reader operable and do not rely on color
  alone.
- **NFR-08 Mobile:** camera/gallery, retry, offline interruption, long forms,
  and review surfaces are verified on representative iOS Safari and Android
  Chrome devices before pilot Go.
- **NFR-09 Observability:** structured metrics and typed failures without image
  contents, credentials, or signed URLs.
- **NFR-10 Recovery:** storage inventory reconciliation and restore rehearsal
  prove that database records and evidence objects can be recovered together.

## Acceptance Criteria

- **AC-01:** A required item cannot complete without ready evidence; optional
  and none behave exactly as configured.
- **AC-02:** Cross-company/store/role/assignment media access fails closed.
- **AC-03:** Spoofed, unsafe, oversized, extreme-pixel, or quarantined uploads
  never become viewable evidence.
- **AC-04:** Camera/gallery source, hashes, actor, item, and completion link are
  auditable.
- **AC-05:** Solution upload produces `solution_review_pending`, not `closed`.
- **AC-06:** Only the correct Region Manager can approve/reject; rejection
  preserves history and requires a reason.
- **AC-07:** Published references cannot be edited and old comparisons retain
  the exact old version.
- **AC-08:** AI/provider outage does not block human checklist completion or
  human action review.
- **AC-09:** Contract tests prove experimental visual output cannot reach
  checklist totals, KPI, ranking, competition, Store Action creation, or
  incentives.
- **AC-10:** Expired eligible objects are deleted while protected objects remain
  and auditable tombstones persist; the dry run itself deletes nothing.
- **AC-11:** A storage reconciliation/restore rehearsal passes before real-photo
  pilot Go.
- **AC-12:** The benchmark report contains accuracy, false pass/fail,
  abstention, subgroup, latency, cost, and provider-contract evidence before a
  model is selected.
- **AC-13:** Mobile capture and long review flows pass on real representative
  devices before pilot Go.
- **AC-14:** No production data or broad production runtime is touched by this
  implementation line without a separate explicit decision.
- **AC-15:** Submission immediately before `submission_closes_at` is on time;
  submission at or after that exclusive boundary is rejected by the ordinary
  flow, independent of VM review time.
- **AC-16:** Repeated close jobs create one `missed` transition/audit event and
  never write zero, KPI, ranking, competition, action, or incentive data.
- **AC-17:** Deadline/scope revision, closed-campaign reopening, and exemption
  require explicit permission, reason, and append-only before/after audit.
- **AC-18:** Finalize, close, extend, reopen, exempt, add, and withdraw races
  resolve under campaign/assignment locks, expected-version compare-and-set,
  database time, and one atomic audit boundary; stale commands fail.
- **AC-19:** Disabling submission for an open campaign first creates an audited
  operational hold; settlement cannot classify held stores as missed until an
  explicit recovery reconciliation closes the hold.

## Edge Cases

- **EC-01:** Upload completes after checklist completion starts.
- **EC-02:** Duplicate finalize or queue delivery occurs.
- **EC-03:** User loses assigned-store scope between upload and finalize.
- **EC-04:** Reference is superseded while a checklist is in progress.
- **EC-05:** Action is reviewed while a Store Manager resubmits.
- **EC-06:** Asset expires while an action/review is still open.
- **EC-07:** Provider succeeds after job timeout or retry.
- **EC-08:** Image is clear but layout/reference variant is unsupported.
- **EC-09:** Image contains instruction-like text or unsafe personal content.
- **EC-10:** Storage object exists without DB row, or DB row exists without
  object.
- **EC-11:** Retention default is shortened after assets were finalized.
- **EC-12:** A completed historical V1 action has no evidence.
- **EC-13:** Multiple photographs may represent one rubric item within its
  configured maximum; one asset linked to multiple items is rejected in V1.
- **EC-14:** Poor connectivity interrupts a mobile upload and the user retries.
- **EC-15:** Upload begins before the deadline but finalization completes at or
  after `submission_closes_at`;
  only the authoritative finalized-submission timestamp can satisfy the window.
- **EC-16:** The close job and a valid finalization race at the deadline; one
  locked transaction and database time produce a deterministic result.
- **EC-17:** VM review or correction request occurs after the displayed
  deadline; the original on-time fact remains, while review/correction state is
  reported separately.
- **EC-18:** A store is added, removed, closed, reassigned, or exempted after
  campaign publication; only an explicit scope/exception revision changes the
  obligation and history is retained.
- **EC-19:** Submission or settlement capability is disabled during an open
  window; affected stores enter operational hold and cannot be penalized by the
  outage.

## Implementation PR Train

Each PR starts from fresh merged `main`, owns one reviewable story, declares
contract impact, and includes rollback. Never run two full release suites at
the same time.

### PR-1 — Executable contracts and isolation guards

Scope:

- convert FR/NFR/AC/EC requirements into typed contracts and failing tests;
- freeze official-score and incentive isolation;
- define state enums, event names, quotas, and feature/kill switches;
- no schema, provider, or runtime behavior.

Rollback: remove contracts/tests; no data effect.

Gate: owner confirms pilot is evidence-only/shadow and accepts the role matrix.

### PR-2 — Additive schema and migration contracts

Scope:

- add media, reference, action-evidence, comparison, and review tables;
- add immutable/version/uniqueness and tenant ownership constraints;
- add versioned retention policy, `expires_at`, protection/hold, tombstone, and
  raw-upload disposal structures;
- add DB-enforced update/delete denial or equivalent tamper evidence for audit;
- prove forward and rollback behavior on a disposable database.

Rollback: safe only before rows exist; after use, rollback is feature-disable
plus forward migration, never destructive narrowing.

Gate: database design and retention/privacy owner review.

### PR-3 — Private media storage foundation

Scope:

- implement storage and media-safety ports;
- initiate/finalize/read contracts, canonicalization, thumbnailing, scanning,
  quotas, quarantine, partial cleanup, and signed delivery;
- enforce retention assignment, protected holds, prompt raw-upload disposal,
  deletion tombstones, and a minimum scheduled cleanup path before any real
  photo is accepted;
- add cross-tenant/object negative tests and storage reconciliation;
- permit only synthetic images until privacy notice, lawful-purpose/provider
  terms, and real-photo pilot permission are approved.

Rollback: disable uploads and delivery; preserve existing objects and metadata
for governed cleanup.

Gate: storage provider, region, backup, recovery, and cost ceiling approved.

### PR-4 — Checklist item evidence

Scope:

- publish per-item evidence policy;
- add BM/VM item capture and evidence preview;
- enforce required evidence at server completion;
- pin the immutable evidence policy to each created instance item;
- preserve current scoring formulas and completion locking.

Rollback: capture and required-evidence enforcement form one dependency-aware
activation set. Enforcement cannot be enabled unless capture/storage health is
enabled. Disabling capture prevents new required-policy activation but never
silently relaxes an already-pinned required item. In-progress required items
remain safely drafted until storage recovers; no fake completion or automatic
score is allowed. Completed evidence history is never invalidated.

Gate: authenticated staging upload/finalize/read smoke and real-device mobile
proof.

### PR-5 — Store Action photographic review V2

Scope:

- solution note/photo submission;
- `solution_review_pending`, approval, rejection, correction, resubmission;
- Region Manager scoped review UI and audit;
- current action-owner submit authority, immutable attempt IDs, row locks,
  expected-version compare-and-set, and stale-review rejection;
- preserve old V1 records and stable remediation sources.

Rollback: disable new V2 submission/review entry while preserving pending data;
provide an explicit operational queue for any pending items.

Gate: owner approves V2 transition and pending-item rollback procedure.

### PR-6 — VM reference management

Scope:

- draft/publish/retire immutable reference sets and versions;
- applicability, Europe/Istanbul start/deadline windows, exact assignment
  snapshots, and exact version pinning;
- idempotent scheduled/open/close transitions, on-time submission truth,
  missed/exempt classification, and audited extension/reopen/scope revision;
- immutable campaign revisions and assignment outcomes, fresh submit scope,
  row locks, expected-version compare-and-set, and operational-hold recovery;
- `VM_REFERENCE_PUBLISHER` administration, `VM_VISUAL_REVIEWER` review scope,
  and authorized assigned-store/reference reads.

Rollback: stop new publishing while already-open campaigns continue submission
and settlement to their recorded boundary. If execution must also stop, first
atomically place affected assignments on operational hold, then disable
submission/settlement. Recovery runs reconciliation and requires an explicit
extension/reopen decision; it never lets deadlines expire invisibly.

Gate: reference owner, variants, expiry, deadline/exception authority, and
emergency retirement procedure.

### PR-7 — Retention operations, reconciliation, and usage controls

Scope:

- extend the already-enforced PR-3 lifecycle with dry-run manifests, digest-
  bound scheduled/manual purge, failure retry, and operator runbooks;
- reconcile orphan objects, missing objects, checksum mismatch, dangling links,
  stuck uploads/purges, protected expiry, and tombstones;
- add usage/forecast/alerts;
- shorter derivative/AI artifact policy.

Rollback: stop cleanup jobs; never restore deleted bytes by changing DB state.

Gate: restore rehearsal and deletion/legal-hold procedure.

### PR-8 — Blinded benchmark harness and candidate adapters

Scope:

- freeze double-reviewed human labels before any candidate output is visible;
- implement the provider-neutral adapter contract and controlled candidate
  benchmark harness behind disabled product flags;
- require minimum counts for every claimed device, lighting, layout, and store
  subgroup and record uncertainty where sample size is insufficient;
- validate schemas, privacy redaction, latency, usage, real cost, false pass,
  false fail, abstention, and subgroup results;
- expose no AI output to operational reviewers or product surfaces.

Rollback: stop benchmark invocations and retain only governed evaluation
evidence according to its retention policy.

Gate: approved candidate sandboxes and data terms. The owner selects a provider
only after the blinded benchmark, DPA/privacy, no-training/retention, residency,
budget, and incident evidence is complete.

### PR-9 — Selected-provider hidden shadow queue

Scope:

- outbox, dedicated queue/worker, idempotency, retries, circuit breaker, and
  selected provider adapter;
- structured shadow records only, feature-gated and hidden from ordinary
  product users;
- repeat a blinded holdout evaluation without changing the frozen labels;
- prove no official scoring, action, reporting, or incentive reads/writes.

Rollback: kill switch stops enqueue/processing; manual workflows continue and
shadow data remains inspectable.

Gate: selected provider contract, holdout acceptance thresholds, cost ceiling,
queue reliability, and owner shadow Go.

### PR-10 — Advisory reviewer surface and controlled staging pilot

Scope:

- add `VM_VISUAL_REVIEWER` accept/override/reject/recapture flows only after
  blinded evaluation closes;
- show confidence and limitations without implying official scoring;
- keep Report Viewer AI detail denied unless a later owner decision opens it;
- execute approved pilot accounts/stores/references;
- collect sanitized upload, auth, recovery, queue, retention, cost, advisory,
  override, and accessibility receipts;
- exercise outages, retries, quota, rejection, and kill switches;
- publish Go/No-Go closeout without product mutations.

Rollback: disable all feature flags, stop workers, preserve governed evidence,
and execute approved cleanup only after retention/hold review.

Gate: explicit staging target, run window, real-photo/privacy permission, named
operational owners, reviewer-accountability policy, and accessibility/mobile
proof.

Any use of AI in official scoring is outside this PR train and requires a new
R5 plan.

## Verification Matrix

Every implementation PR runs targeted tests first, then the repository's
affected-scope selector and only its selected canonical checks.

Required proof across the train includes:

- unit tests for policy, state transitions, hash/idempotency, and output schema;
- API/OpenAPI/generated-client drift checks for every contract change;
- disposable-database migration, constraint, immutability, and rollback tests;
- authorization system-flow and cross-tenant negative tests;
- malicious-upload, quota, replay, and partial-upload tests;
- queue retry, duplicate delivery, timeout, backlog, and kill-switch tests;
- Europe/Istanbul campaign boundary, database-time race, idempotent close,
  immutable revision/outcome, add/withdraw, extension/reopen, exemption,
  operational-hold, and recovery tests;
- isolation tests proving missed, exempt, withdrawn, operational-hold, and
  reopened outcomes never write score, KPI, ranking, competition, action, or
  incentive data;
- official scoring/KPI/ranking/competition/Store Action/incentive isolation
  tests;
- desktop/mobile interaction and accessibility tests;
- authenticated staging media and provider smokes when their gates open;
- storage reconciliation and restore rehearsal;
- canonical release once per final PR head when selected by repository policy.

No coverage, worker isolation, audit, or test suite may be reduced to shorten
the release. GitHub Codex review remains disabled; local adversarial review and
required checks remain mandatory.

## Feature Flags And Rollback Controls

Minimum independent controls:

- checklist evidence capture;
- required-evidence completion enforcement;
- Store Action photographic resolution;
- Region Manager solution review;
- VM reference publishing;
- VM campaign submission;
- VM campaign deadline settlement;
- comparison enqueue;
- comparison worker/provider delivery;
- advisory result visibility;
- scheduled retention cleanup.

Flags are not authorization. Server scope checks remain authoritative when a
feature is enabled. Disabling a flag must not delete or reinterpret history.
Checklist evidence capture/storage and required-evidence enforcement are an
atomic dependency set: enforcement may never be on while capture/storage is
off or unhealthy. AI controls remain independently disableable because AI is
never required for completion or human review.

Campaign publishing, submission, and deadline settlement have separate
controls, but one invariant governs them: submission or settlement may not be
disabled for an open assignment unless an atomic `operational_hold` is recorded
first. Settlement skips held assignments. Recovery requires audited
reconciliation plus an explicit extension/reopen decision.

## Stop Conditions

Stop before implementation or merge if:

- tenancy, store assignment, item ownership, or action scope cannot be derived
  from server records;
- the design needs a public bucket or permanent URL;
- safe decode/re-encode, quotas, scanning/quarantine, or metadata stripping is
  unavailable; the only exception is the locked single-fixture PR-4 identity
  proof, which cannot accept real media;
- rollback requires deleting or rewriting completed checklist history;
- existing V1 actions would be silently reclassified;
- AI output can reach any official score, KPI, ranking, competition, action
  generation, or incentive path;
- real photos would be sent without approved privacy/provider terms;
- storage restore/reconciliation cannot be proven;
- required mobile evidence is waived without a newer explicit owner decision;
- a provider/model/cost/residency decision is inferred rather than approved;
- broad production is requested without a new explicit Go decision;
- required checks, mergeability, or staging evidence fail.

## Remaining Owner Gates

These are intentionally unresolved:

- storage provider and region;
- real-photo pilot stores, users, and run window;
- exact capture notice, privacy/legal basis, and incident owner;
- reference variants by campaign, fixture, layout, or store class;
- campaign deadline extension/reopen authority, exemption authority, and
  operational escalation owner;
- maximum photos per item/visit and company cost ceilings;
- AI provider/model and any normal/hard-case routing;
- benchmark acceptance thresholds, especially false-pass tolerance;
- whether Report Viewer sees advisory comparison detail or aggregate evidence;
- whether and when the default retention changes from 365 days;
- any future promotion of AI output beyond shadow/advisory.

## Definition Of Done

This plan's authorized product line is complete only when:

- photographic evidence is private, scoped, safe, versioned, and restorable;
- required/optional item policy works on real mobile devices;
- Store Manager solution submission and Region Manager approval/rejection are
  complete and auditable;
- VM reference versions are immutable and pinned;
- VM campaign windows and assignment snapshots classify on-time, missed, and
  exempt stores honestly without score contamination;
- retention and cleanup operate from configurable policy with holds and
  tombstones;
- provider-neutral shadow assessment survives outage and cannot contaminate
  official business results;
- benchmark, privacy, cost, security, recovery, and staging evidence are
  published;
- every locked acceptance criterion passes;
- broad production and official AI scoring remain closed unless separately
  approved.

## Related Documents

- `docs/superpowers/specs/2026-04-29-vm-checklist-v1-design.md`
- `docs/plans/store-action-checklist-remediation-v1.md`
- `docs/plans/store-action-checklist-remediation-implementation-v1.md`
- `docs/domains/store-action.md`
- `docs/architecture/pilot-route-role-matrix.md`
