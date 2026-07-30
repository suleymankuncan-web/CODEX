# Qwen Store Photo Lean Pilot Decision V1

Status: owner-locked; supersedes the PR-8B six-gate benchmark posture for the
controlled pilot
Date: 2026-07-30
Risk: R5, advisory-only
Parent: `checklist-photo-evidence-and-vm-visual-assessment-plan-v1.md`

## Decision

The pilot handles store, shelf, fixture, display, and product photographs.
Personal data is not an intended input. The pilot is operated as a bounded
visual-merchandising comparison workflow, not as a personal-data programme.

The previous PR-8B six-gate evidence package is superseded. Provider legal
dossiers, subprocessor inventories, double-independent review, a 100-150 pair
blind benchmark, and digest-heavy external receipts are not pilot entry gates.
They become relevant only if scope changes, personal data becomes intentional,
or AI is proposed for automatic official scoring.

## Product Flow

1. Visual Merchandising publishes an immutable reference image, explicit
   evaluation criteria, assigned stores, and a Europe/Istanbul start/deadline.
2. A Store Manager submits one or more photographs of the assigned store,
   shelf, fixture, display, or products.
3. The server validates the file as an allowed image, decodes and re-encodes
   it, strips metadata, applies byte/pixel limits, and stores it privately.
4. The asynchronous worker sends the exact reference, canonical evidence, and
   versioned criteria to the pinned Qwen snapshot.
5. Strict application validation converts the response into the
   provider-neutral result. Invalid or low-confidence output becomes
   `manual_review_required`; it never becomes a pass.
6. The responsible Region Manager approves, overrides, rejects, or requests
   recapture. This human decision is final.
7. During the pilot the AI result cannot change checklist scores, KPI,
   rankings, competitions, targets, incentives, or action closure.

## Minimum Controls

- Accepted content: store, shelf, fixture, display, and product photographs.
- Capture instruction: do not include people, receipts, identity documents,
  screens containing personal information, or vehicle plates. If accidentally
  present, reject the photograph and request recapture.
- MIME declaration alone is not trusted; allowed magic bytes and successful
  decode are required. Byte and pixel limits are explicit.
- Accepted images are re-encoded and EXIF/GPS metadata is removed before use.
- Originals are not publicly served. Canonical media remains in private R2
  storage behind server authorization and bounded signed delivery.
- The provider key is server-side, revocable, absent from Git/logs, and scoped
  to the selected model where supported.
- Exact model snapshot, non-thinking mode, strict schema, disabled tools,
  request timeout, concurrency, response-size, token, and spend limits fail
  closed.
- Feature flags and a kill switch stop comparisons without blocking manual
  checklist and review flows.
- A dedicated antivirus service is not a pilot prerequisite. Image
  allowlisting, limits, magic-byte validation, isolated decode, re-encode,
  metadata stripping, and rejection of decode failures form the pilot media
  boundary. Revisit a scanner if file types, uploader population, exposure, or
  threat evidence broadens.

## Proportional Validation

### Step 1 - Technical smoke

- Run 20 synthetic reference/evidence comparisons.
- Verify exact-model use, valid structured output, timeouts, disabled tools,
  invalid-output handling, zero product writes, tokens, latency, and cost.
- One domain reviewer spot-checks whether the result is useful.

### Step 2 - Controlled store-photo pilot

- Review 30-50 store-photo comparisons across ordinary lighting, angle, and
  layout variation.
- Compare Qwen's advisory result with the Region Manager's final decision.
- Record agreement, false-pass examples, false-fail examples, abstentions,
  recapture requests, latency, and cost as aggregates.
- Make no fixed statistical accuracy claim from this small pilot.

### Step 3 - Continue, tune, or stop

- Continue advisory use when output is useful and cost remains bounded.
- Tune the rubric/prompt through a new version when errors are understandable.
- Disable the model path when false passes mislead, cost is uncontrolled, or
  structured output is unreliable. Manual review continues.

## Deferred Until Scope Promotion

These are not PR-8B/PR-9/PR-10 pilot gates:

- 100-150 pair blinded benchmark and two independent human labelers;
- formal subgroup performance claims;
- automatic official scoring or automated operational consequences;
- personal-data processing or face/document analysis;
- broad production activation;
- second-model routing, repair, or fallback;
- a dedicated malware-scanning service without demonstrated need;
- expanded provider legal/subprocessor evidence beyond ordinary account terms.

Automatic official scoring, intentional personal data, or broad production use
requires a new owner decision and R5 review.

## PR Line

- **PR-8B:** provider-neutral port, Qwen adapter, strict contracts, operator-run
  20-pair synthetic smoke harness, cost/timeout/kill-switch controls; no product
  workflow writes or UI.
- **PR-9:** asynchronous hidden shadow processing for controlled campaign
  submissions, manual fallback, idempotency, and zero official-score effects.
- **PR-10:** Region Manager advisory review UI and 30-50 comparison staging
  pilot; AI remains advisory and feature-gated.

## Required Evidence

- targeted contract tests and selected canonical repository checks;
- one successful exact-model smoke plus invalid-output/timeout/budget stops;
- aggregate request count, tokens, latency, and spend;
- pilot human-decision agreement and representative error examples;
- kill-switch and manual-fallback proof.

Secrets, raw images, signed URLs, and raw provider responses never enter Git or
sanitized reports.
