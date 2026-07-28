# Checklist Item Evidence PR-4 Execution Spec V1

Status: Approved derivative of the owner-approved 10-PR execution line
Date: 2026-07-27
Parent: `checklist-photo-evidence-and-vm-visual-assessment-plan-v1.md`
Risk: R5
Implementation PR: PR-4 only

## Context

PRs #1020-#1022 locked the product contract, added the provider-neutral data
foundation, and added disabled-by-default synthetic private-media storage. The
foundation includes `media_asset` and `checklist_response_media`, but the
current checklist template and instance model does not persist the per-item
`none|optional|required` policy or an immutable instance snapshot. The current
completion commands consequently cannot prove required ready evidence.

This slice closes that gap without accepting real photographs, enabling a
provider, changing checklist scoring, or changing historical completed rows.
Capture UI and runtime commands remain independently feature-gated. The
external authenticated staging and representative-device evidence remains a
merge gate, not an assumption made by this spec.

The owner additionally locked the PR-4 synthetic safety boundary on
2026-07-27: exactly one byte-identical HR Axis fixture may pass a deterministic
SHA-256 identity adapter. The server checks it before upload and after raw
provider read. This is not malware scanning, cannot accept real media, and
cannot satisfy a future real-media scanner capability. No Render ClamAV
service or operational ClamAV environment variable is authorized by PR-4.

## Functional Requirements

- **PR4-FR-01 / FR-01:** Draft template items MUST accept exactly `none`,
  `optional`, or `required`; omitted legacy input MUST default to `none`.
- **PR4-FR-02 / FR-09:** Starting an instance MUST atomically snapshot every
  published template item, its policy and its evidence-count limit into
  immutable instance-item rows.
- **PR4-FR-03 / FR-02:** An authorized BM or VM executor MUST be able to link a
  ready `checklist_evidence` asset from the same company/store to the exact
  active instance item. One asset MUST NOT satisfy another item or instance.
- **PR4-FR-04 / FR-02:** Before completion, the executor MAY unlink evidence
  with a non-empty reason. Completed or locked evidence MUST remain immutable.
- **PR4-FR-05 / FR-04:** Both checklist completion commands MUST lock the
  instance and reject completion when a `required` instance item lacks at
  least one active ready evidence link.
- **PR4-FR-06 / FR-04:** `optional` and `none` MUST NOT block completion;
  `none` MUST reject new evidence links.
- **PR4-FR-07 / AC-04:** Link, unlink, and completion lock MUST write typed,
  append-only photo-evidence audit in the same database transaction.
- **PR4-FR-08 / FR-02:** The BM/VM checklist session MUST show policy, camera
  and gallery controls, upload state, retry, thumbnail preview, remove-before-
  completion, and required-evidence completion feedback.
- **PR4-FR-09:** Capture and enforcement MUST use independent server controls;
  enforcement MUST NOT activate unless capture and storage health are active.
- **PR4-FR-10:** When real-photo permission is absent, non-synthetic upload
  MUST fail closed and UI capture MUST remain unavailable without relaxing a
  pinned required policy.
- **PR4-FR-11:** Synthetic staging MUST accept exactly one configured fixture
  digest, recheck raw provider bytes before finalization, and reject every
  other byte sequence before processing, canonical/recovery writes, linking,
  or readiness.

## Non-Functional Requirements

- **PR4-NFR-01 / NFR-01:** Server-side records, not client-supplied tenant
  identifiers, MUST determine company, region, store, instance, item and asset
  ownership. Cross-company/store/role/assignment access MUST fail closed.
- **PR4-NFR-02 / NFR-03:** Published policy, instance policy snapshots,
  completed evidence links and completion audit MUST be immutable.
- **PR4-NFR-03 / NFR-05:** Checklist reads MUST return thumbnail metadata only;
  signed canonical reads remain explicit and on demand.
- **PR4-NFR-04 / NFR-07:** Capture, retry, remove, preview and errors MUST be
  keyboard and screen-reader operable and MUST NOT rely on colour alone.
- **PR4-NFR-05 / NFR-08:** The modal MUST remain usable at 320, 390, 768 and
  1024 CSS-pixel widths; real iOS Safari and Android Chrome proof remains the
  external gate.
- **PR4-NFR-06 / NFR-09:** Errors and audit MUST never contain image bytes,
  signed URLs, credentials, provider payloads or private business payloads.
- **PR4-NFR-07:** Existing score formulas, responses, completed history,
  acknowledgement/remediation meanings and downstream consumers MUST remain
  byte-for-byte semantically unchanged.

## Acceptance Criteria

- **PR4-AC-01 / AC-01:** Given otherwise complete instances with `none`,
  `optional`, and `required` items, completion succeeds for the first two and
  returns a typed missing-evidence conflict for the third until ready evidence
  is linked.
- **PR4-AC-02 / AC-02:** Guessed IDs, wrong tenant/store, wrong BM/VM role,
  expired assignment, completed instance, non-ready asset and wrong
  classification are rejected without a link or audit success event.
- **PR4-AC-03 / AC-04:** A successful link records source, asset hash, actor,
  exact instance/item, order and correlation; completion locks the link.
- **PR4-AC-04 / AC-09:** Existing checklist totals and all KPI, ranking,
  competition, Store Action and incentive queries receive no evidence-derived
  score or write.
- **PR4-AC-05 / AC-13:** Automated desktop/mobile accessibility tests pass and
  the named real-device evidence exists before merge.
- **PR4-AC-06 / AC-14:** Storage and capture remain disabled by default;
  production and real-photo processing remain unavailable.

## Edge Cases

- **PR4-EC-01 / EC-01:** Finalize/link racing completion resolves under the
  instance lock; evidence committed after completion cannot satisfy it.
- **PR4-EC-02 / EC-02:** Repeated link and completion requests are idempotent
  or return the existing deterministic state without duplicate links/audit.
- **PR4-EC-03 / EC-03:** Scope is re-read at link, unlink, read and completion;
  losing assignment between upload and link fails closed.
- **PR4-EC-04 / EC-04:** A later template version or policy change cannot
  alter an existing instance snapshot.
- **PR4-EC-05 / EC-13:** Multiple assets have stable order within the configured
  maximum; reuse across items/instances is rejected.
- **PR4-EC-06 / EC-14:** Interrupted upload remains retryable and does not
  create an active evidence link.
- **PR4-EC-07:** A response may be saved before evidence, but required
  completion remains blocked until evidence is ready and linked.
- **PR4-EC-08:** Disabling capture while a required instance is in progress
  preserves the draft and reports storage unavailable; it never auto-completes
  or changes the policy.

## API Contracts

Existing template create/update/read models gain:

```ts
type ChecklistEvidencePolicy = "none" | "optional" | "required";

type ChecklistTemplateItem = {
  evidencePolicy: ChecklistEvidencePolicy;
  maxEvidenceCount: number;
};

type ChecklistInstanceItemEvidence = {
  templateItemId: string;
  evidencePolicy: ChecklistEvidencePolicy;
  evidence: Array<{
    mediaAssetId: string;
    displayOrder: number;
    captureSource: "camera" | "gallery" | "system_generated";
    thumbnailAvailable: boolean;
  }>;
};
```

New checklist-scoped commands:

```text
POST   /api/mobile/checklists/instances/:instanceId/items/:itemId/evidence
DELETE /api/mobile/checklists/instances/:instanceId/items/:itemId/evidence/:assetId
POST   /api/mobile/checklists/evidence/:assetId/read-url
```

Link body:

```ts
{ mediaAssetId: UUID; expectedEvidenceVersion: number; idempotencyKey: UUID }
```

Unlink body:

```ts
{ reason: string; expectedEvidenceVersion: number; idempotencyKey: UUID }
```

Success returns the exact active item evidence projection. Typed failures are
`feature_disabled`, `storage_unavailable`, `scope_denied`, `policy_forbids`,
`asset_not_ready`, `asset_scope_mismatch`, `instance_locked`,
`missing_required_evidence`, and `stale_version` through the repository's
standard error envelope. Upload/finalize remains owned by the media module and
cannot accept real photos while `PHOTO_MEDIA_SYNTHETIC_ONLY=true`. The
checklist-scoped synthetic path additionally requires the submitted body digest
to exist in the server-owned `PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST`;
client attestation alone never authorizes a fixture.

For PR-4 the allowlist contains exactly one digest. Physical-device proof uses
the byte-identical PNG through iOS Files and Android Downloads; Photos, editors,
or any transcoding path are not grounds to expand the allowlist. Camera remains
disabled. The receipt identifies the scanner assurance as
`fixture_identity_only` and records no image bytes, signed URL, credential,
bucket name, or private identifier.

## Data Models

| Entity/field | Type | Constraint |
| --- | --- | --- |
| `checklist_template_item.evidence_policy` | text | non-null, default `none`, strict allowlist |
| `checklist_instance.evidence_version_no` | integer | non-negative evidence-only optimistic version |
| `checklist_instance_item_policy` | row | unique instance + item; exact template ownership FK |
| `checklist_instance_item_policy.evidence_policy` | text | immutable strict snapshot |
| `checklist_response_media` | existing row | active link unique to exact instance/item/asset; lifecycle trigger retained |
| `photo_evidence_command_receipt` | row | actor-scoped idempotency key, command digest, deterministic result |

The migration is additive. Existing template items become `none`; completed
and cancelled instances are not backfilled. Planned and in-progress instances
receive a conflict-safe snapshot derived from their exact template version. An
instance-insert trigger is installed before that bounded backfill so rolling
deployments cannot create a pinless active instance. No completed history is
rewritten.

## Rollout And Rollback

- Defaults: capture `false`, required enforcement `false`, storage `false`,
  synthetic-only `true`.
- Publish of a new `required` item fails unless capture, enforcement and healthy
  storage are active. Existing pinned `required` instances are never relaxed.
- Before feature use, rollback may remove the additive PR-4 objects and
  columns; generated `none` snapshots alone do not count as feature use. After
  any non-`none` policy, evidence link, command receipt, or workflow audit
  exists, rollback is feature-off plus forward migration only.
- Disabling capture preserves ready assets, drafts, links and audit for governed
  retention; it does not delete evidence.

## Out Of Scope

- Real photographs, privacy notice approval, provider activation or paid use.
- Store Action V2 solution review (PR-5).
- VM campaign/reference management (PR-6).
- New retention operator surfaces (PR-7).
- AI provider, benchmark, shadow queue, advisory UI or official scoring.
- Report Viewer evidence-detail expansion.
- Broad production activation or redesign of Command Canvas.

## Verification And External Gate

Repository proof MUST include migration forward/rollback/reapply, schema
immutability, application/unit/API authorization, completion races, OpenAPI
drift, desktop/mobile Playwright and the selected canonical release.

Merge additionally requires:

1. authenticated synthetic staging upload/finalize/link/read with sanitized
   receipts against the exact PR head; and
2. representative physical iOS Safari and Android Chrome UI/picker, retry and
   preview evidence using a pre-approved synthetic fixture. The device proof
   MUST NOT capture or transmit a real-world photograph while real-photo
   privacy permission is absent.

Neither external receipt may contain image bytes, signed URLs, credentials or
private user data. Absence of either receipt is a No-Go for PR-4 merge, not
permission to weaken the gate.
