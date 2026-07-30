# Qwen PR10 Region Manager Advisory Pilot Specification V1

Status: Approved for implementation
Date: 2026-07-30
Risk: R5, advisory-only
Owner decision source: approved photo-evidence/VM plan, locked Qwen pilot decision,
and the owner's instruction to continue the next PR autonomously

## Context

PR #1037 established a hidden, fail-closed Qwen comparison worker and durable
`shadow` ledger without changing any official Store result. PR10 exposes the
next controlled slice: a narrowly scoped real VM store-photo intake, new
`advisory` comparison runs, and a Region Manager human-review workspace.

The first pilot remains reversible and isolated. AI output is a suggestion,
never an official score or workflow decision. Every new runtime capability is
false by default and limited to one exact company, reference set, and
`not-before` boundary.

GPT-5.6 Luna's current public rate is materially lower than its launch rate.
PR10 therefore defines a provider-neutral same-corpus evaluation receipt, but
does not add Luna to the runtime, silently replace the owner-locked Qwen
snapshot, or choose a provider.

## Functional Requirements

- **FR-1 — Narrow real-photo intake.** The backend MUST accept real camera or
  gallery images only for an enabled `vm_campaign_evidence` pilot scope and
  MUST fail closed for every other classification or scope.
- **FR-2 — Media validation.** Intake MUST require content-policy attestation,
  validate JPEG/PNG/WebP magic bytes and MIME agreement, enforce 15 MiB and
  40 MP limits, decode exactly one image, rotate/re-encode to canonical WebP,
  strip metadata, create a thumbnail, verify recovery storage, and dispose the
  raw input.
- **FR-3 — Honest assurance.** Runtime and documentation MUST describe the
  control as strict image decode/re-encode; they MUST NOT claim malware or PII
  scanning. Capture guidance MUST prohibit people, receipts, identity
  documents, personal-data screens, and licence plates.
- **FR-4 — Isolation mode.** The reconciler MUST create new `advisory` rows
  only when the advisory enqueue gate is enabled. Existing shadow rows MUST
  remain shadow. Shadow and advisory enqueue modes MUST be mutually exclusive.
- **FR-5 — Pinned provider path.** Advisory jobs MUST reuse the PR9 queue,
  rubric, schema, validator, retry, budget, and exact
  `qwen3.7-plus-2026-05-26` non-thinking/tools-off path. Luna and fallback
  providers MUST NOT be invoked by product runtime.
- **FR-6 — Region Manager list/detail.** A Region Manager MUST be able to list
  and inspect advisory runs only for stores covered by both the current region
  assignment and current action-store assignment.
- **FR-7 — Private thumbnails.** Reference and evidence thumbnails MUST be
  served only after run authorization, derived internally, and returned with
  `Cache-Control: private, no-store` without object keys or signed URLs.
- **FR-8 — Final human decision.** A Region Manager MUST record exactly one of
  `accept`, `override`, `reject`, or `recapture`; every decision requires a
  bounded reason, and override additionally requires `pass|partial|fail`.
- **FR-9 — Review integrity.** Review MUST recheck assignment in the same
  transaction, lock the advisory run, preserve provider `result_json`, store
  the normalized human outcome in `after_result_json`, mark only the
  experimental run `human_reviewed`, and append the typed audit event.
- **FR-10 — Idempotency and conflict.** An identical retry of review one MUST
  return the existing review; a different retry MUST return conflict.
- **FR-11 — Low-confidence safety.** Abstained, invalid, failed, or
  below-threshold results MUST NOT be accepted; override, reject, or recapture
  remain available.
- **FR-12 — Role denial.** Report Viewer, Store Manager, Visual Merchandiser,
  and VM Visual Reviewer MUST NOT access advisory list/detail/media/review
  endpoints or the Region Manager advisory workspace.
- **FR-13 — Operational UI.** `/store/visual-campaigns` MUST provide a compact
  Region Manager advisory workspace with data-backed waiting/manual/reviewed
  metrics, filterable list, responsive detail sheet, and review dialog.
- **FR-14 — Honest product copy.** The UI MUST display suggestion, confidence,
  quality flags, limitations, criteria, and timestamp, plus a persistent
  advisory/no-score warning. It MUST NOT expose provider/model, cost, tokens,
  hashes, URLs, raw JSON, or internal implementation language.
- **FR-15 — Complete states.** The UI MUST implement loading, empty, disabled,
  partial, error/retry, success toast, conflict, and access-denied states.
- **FR-16 — Pilot receipt.** A digest-bound collector MUST summarize an exact
  30–50 opaque-run cohort without outputting images, URLs, hashes, prompts,
  provider payloads, secrets, actor IDs, store names, or free-form reasons.
- **FR-17 — Luna evaluation protocol.** The repository MUST document a separate
  owner-gated, provider-neutral same-corpus evaluation using frozen canonical
  inputs and human outcomes. It MUST NOT add a Luna adapter, key, runtime flag,
  fallback, or automatic provider selection.

## Non-Functional Requirements

- **NFR-1 — Default-off:** all real-photo, advisory-enqueue, worker, and
  advisory-visibility/review gates MUST default false.
- **NFR-2 — Fail closed:** missing/invalid scope, time, storage, quota, model,
  host, price ceiling, assignment, or media validation MUST produce no provider
  call and no official sink mutation.
- **NFR-3 — Authorization:** out-of-scope run identifiers MUST use not-found
  semantics and MUST NOT reveal cross-store existence.
- **NFR-4 — Data minimization:** list/detail contracts MUST omit media IDs,
  object storage identities, provider request data, prompt text, usage/cost,
  and raw result payloads.
- **NFR-5 — Concurrency:** review writes MUST be serialized and must not permit
  two different final decisions.
- **NFR-6 — Accessibility:** the new UI MUST pass keyboard/focus behavior and
  targeted axe checks.
- **NFR-7 — Responsive:** the workspace MUST have no document-level horizontal
  overflow at 1440x900, 1024x768, 390x844, and 320 px.
- **NFR-8 — Performance:** lists MUST remain bounded and media MUST use the
  existing thumbnail/canonical limits rather than raw uploads.
- **NFR-9 — Rollback:** disabling visibility, enqueue, worker, and real-photo
  intake in that order MUST stop new activity without deleting immutable
  history.
- **NFR-10 — Traceability:** implementation and tests MUST reference relevant
  FR/NFR/AC/EC identifiers.

## Acceptance Criteria

- **AC-1 (FR-1, FR-2, NFR-1):** Given all gates are false, when a real VM image
  is submitted, then no asset is finalized and no provider work is created.
- **AC-2 (FR-1, FR-2):** Given the exact pilot scope and valid attestation,
  when a valid image is submitted, then canonical WebP, thumbnail, verified
  recovery copy, stripped metadata, and disposed raw input are proven.
- **AC-3 (FR-2, NFR-2):** Given wrong scope, MIME mismatch, oversize,
  over-dimension, decode failure, multi-frame input, or missing attestation,
  when upload is attempted, then it fails closed.
- **AC-4 (FR-4, FR-5):** Given advisory enqueue only, when reconciliation runs,
  then new eligible rows are advisory, old shadow rows are unchanged, and the
  exact Qwen identity is queued.
- **AC-5 (FR-4, NFR-1):** Given both shadow and advisory enqueue are enabled,
  when configuration loads, then startup fails before polling.
- **AC-6 (FR-6, FR-12, NFR-3):** Given an assigned Region Manager, when the
  exact assigned-store run is requested, then access succeeds; same-region but
  unassigned store, other region, Report Viewer, Store Manager, VM, and VM
  reviewer requests are denied with non-disclosing semantics.
- **AC-7 (FR-7, NFR-4):** Given an authorized run, when each thumbnail is read,
  then the response is private/no-store and contains no storage identity.
- **AC-8 (FR-8, FR-9, FR-10):** Given a terminal advisory run, when each valid
  review decision is submitted, then one review and one audit event persist;
  exact retries are idempotent and different retries conflict.
- **AC-9 (FR-11):** Given a low-confidence, abstained, invalid, or failed run,
  when accept is submitted, then it is rejected while the three manual
  alternatives remain valid.
- **AC-10 (FR-13, FR-14, FR-15):** Given each API state, when the Region Manager
  opens the workspace, then metrics, list, detail, review, warning, loading,
  empty, partial, error/retry, conflict, and disabled states render without
  internal implementation copy.
- **AC-11 (FR-12):** Given every non-Region-Manager persona, when routes and API
  calls are exercised, then advisory UI/actions and data remain absent.
- **AC-12 (NFR-6, NFR-7):** Given the four required viewports and keyboard-only
  use, when the main list/sheet/dialog flows are exercised, then axe has no
  critical violation, focus is restored, and page overflow is absent.
- **AC-13 (FR-16):** Given an exact 30–50 opaque-run manifest, when the collector
  runs, then scope/model/version/review/sink invariants are checked and only
  sanitized aggregates are emitted.
- **AC-14 (FR-17):** Given the Qwen cohort is frozen, when the Luna protocol is
  read, then it requires separate owner/account/spend approval and identical
  inputs/criteria/schema while making no automatic provider decision.
- **AC-15 (NFR-9):** Given active pilot components, when rollback order is
  followed, then new visibility/intake/enqueue/provider work stops and existing
  ledger/media/review/audit history remains.

## Edge Cases

- **EC-1:** media object exists only in one bucket or recovery hash differs.
- **EC-2:** assignment changes between list read and review submission.
- **EC-3:** run is processing, leased, stale, or already human-reviewed.
- **EC-4:** two review requests race with different payloads.
- **EC-5:** result JSON is absent, invalid, abstained, or below confidence.
- **EC-6:** thumbnail asset is missing, quarantined, deleted, or cross-store.
- **EC-7:** collector manifest has duplicates, fewer than 30, more than 50, or
  mixed company/reference/not-before/model/version identities.
- **EC-8:** provider timeout/retry/budget stop occurs after media read.
- **EC-9:** feature gates change while an operator has a dialog open.
- **EC-10:** Luna public alias/pricing changes between evaluation approval and
  execution; evaluation stops until identity and ceiling are reapproved.

## API Contracts

```ts
type AdvisoryDecision = "accept" | "override" | "reject" | "recapture";
type HumanFinalDecision = "pass" | "partial" | "fail";

interface AdvisoryListItem {
  comparisonRunId: string;
  storeLabel: string;
  status: "completed" | "abstained" | "failed_terminal" | "human_reviewed";
  suggestion: "pass" | "partial" | "fail" | "recapture" | null;
  confidence: number | null;
  requiresManualDecision: boolean;
  completedAt: string | null;
  reviewedAt: string | null;
}

interface AdvisoryDetail extends AdvisoryListItem {
  qualityFlags: string[];
  limitations: string[];
  criteria: Array<{ key: string; outcome: string; explanation: string }>;
  humanReview: null | {
    decision: AdvisoryDecision;
    finalDecision: HumanFinalDecision | null;
    reason: string;
    reviewedAt: string;
  };
}

interface SubmitAdvisoryReview {
  decision: AdvisoryDecision;
  finalDecision?: HumanFinalDecision;
  reason: string;
}
```

Endpoints:

- `GET /visual-comparisons/advisories`
- `GET /visual-comparisons/advisories/:comparisonRunId`
- `GET /visual-comparisons/advisories/:comparisonRunId/media/reference/thumbnail`
- `GET /visual-comparisons/advisories/:comparisonRunId/media/evidence/thumbnail`
- `POST /visual-comparisons/advisories/:comparisonRunId/reviews`

## Data Model

No migration is planned. PR10 reuses:

| Entity | Existing purpose | PR10 constraint |
| --- | --- | --- |
| `ops.visual_comparison_run` | isolated provider run | new rows use `advisory`; original result preserved |
| `ops.visual_comparison_review` | typed human review | exactly review number one |
| `audit.photo_evidence_event` | immutable typed audit | inserted with review transaction |
| photo media asset/storage records | private canonical/thumbnail/recovery | exact company/reference/store scope |

The public command uses `recapture`; the existing immutable database value
remains `request_recapture` and is translated only at the repository boundary.
This preserves the approved API vocabulary without changing historical schema.

If implementation proves the existing schema cannot meet FR-8–FR-10 without a
semantic compromise, stop rather than adding a migration inside this PR.

## Out of Scope

- Official checklist, campaign, task, action, KPI, ranking, competition,
  target, or incentive mutation.
- AI-generated official scores or automatic workflow closure.
- Report Viewer, Store Manager, VM, or VM Reviewer advisory detail/actions.
- Broad camera/gallery enablement or broad production rollout.
- Luna/OpenAI runtime adapter, secret, failover, repair pass, or provider
  selector.
- Statistical accuracy claims from a 30–50 comparison pilot.
- Dedicated malware scanner or automated PII detector.
- Destructive cleanup of retained media, run, review, or audit history.

## Verification And Rollback

Targeted tests trace to AC/EC identifiers. Required final proof:

```powershell
npm.cmd run check:affected-verification
npm.cmd run check:release
```

Rollback order: advisory visibility off; advisory enqueue off; worker off;
real-photo intake off. Immutable history remains retained.
