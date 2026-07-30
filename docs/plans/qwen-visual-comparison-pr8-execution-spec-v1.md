# Qwen Visual Comparison PR-8 Execution Spec V1

Status: owner-selected provider; PR-8A merged; lean controlled-pilot revision
locked on 2026-07-30; PR-8B implementation may proceed behind disabled runtime
Date: 2026-07-28
Risk: R5
Parent: `checklist-photo-evidence-and-vm-visual-assessment-plan-v1.md`

## 2026-07-30 Lean Pilot Override

The owner has limited intended input to store, shelf, fixture, display, and
product photographs and rejected a personal-data-programme posture for this
pilot. `qwen-store-photo-lean-pilot-decision-v1.md` is the controlling decision
for PR-8B, PR-9, and PR-10.

Where this older execution spec conflicts with that decision, the lean
decision wins. In particular, the former six external gates, 100-150 pair
blind benchmark, two-independent-reviewer rule, dedicated malware-scanner
prerequisite, and expanded provider legal/subprocessor evidence are not pilot
entry gates. PR-8B instead uses a 20-pair synthetic technical smoke; PR-10 uses
a 30-50 comparison controlled store-photo pilot. AI remains advisory, invalid
or low-confidence output fails to manual review, and the Region Manager keeps
the final decision.

Minimum implementation controls remain mandatory: private media, allowed
image types and limits, magic-byte validation, decode/re-encode, metadata
stripping, server-side revocable secret, exact-model assertion, strict output
validation, bounded timeout/concurrency/tokens/spend, disabled-by-default
runtime, kill switch, zero official-score effects, and manual fallback.

## Reader And Required Action

This specification is for the engineer who will prepare the visual-comparison
smoke and implement the Qwen adapter under the lean pilot decision. After
reading it, that engineer must distinguish merged documentation-only PR-8A
from repository-only PR-8B and know the minimum controls required before the
first provider request.

This specification authorizes repository implementation of PR-8B. A provider
call requires the configured server-side key, exact-model assertion, and
fail-closed smoke budget. Product integration, staging mutation, queue, UI,
advisory visibility, and broad production remain outside PR-8B.

## Locked Owner Decision

The product owner selected one initial visual-comparison provider on 28 July
2026:

- provider: Alibaba Cloud Model Studio;
- model snapshot: `qwen3.7-plus-2026-05-26`;
- mode: non-thinking;
- inputs: exact canonical reference image plus exact canonical store evidence;
- output: strict application-validated structured result;
- tools, function calling, web search, code execution, and provider-side
  augmentation: disabled;
- second model, Luna fallback, and model-generated repair pass: disabled;
- rollout: blinded benchmark, then hidden shadow, then separately approved
  advisory review;
- final human authority: the fresh assigned Region Manager for the store;
- official checklist score, KPI, ranking, competition, Store Action generation,
  target, and incentive effects: prohibited.

Qwen is intentionally replaceable. Application and domain code depend on a
provider-neutral visual-comparison port; the Qwen SDK, endpoint vocabulary,
and response envelope stay inside one infrastructure adapter.

## Preserved Product And Safety Boundaries

- Checklist completion and human review continue when Qwen is unavailable.
- AI output is experimental evidence, never an official business fact.
- Region Manager read and decision scope is derived from current server-side
  company, region, and store assignments at review time.
- `VM_VISUAL_REVIEWER` remains read-only for Qwen results in this line. It does
  not grant final approval, override, rejection, or recapture authority.
- Report Viewer receives no Qwen detail or new route.
- Only canonical media can reach the adapter. Raw, quarantined, thumbnail,
  public-URL, unresolved, or retention-ineligible media is rejected.
- The current byte-identical synthetic fixture proves identity only. It is not
  a malware scanner and cannot authorize real reyon photographs.
- Real media remains No-Go until a genuine media-safety adapter and the
  separately recorded privacy/capture gates pass.
- Provider secrets, endpoints, image bytes, signed URLs, prompts, raw responses,
  object identities, and private business payloads never enter Git, logs,
  benchmark reports, audit, or evidence receipts.

## Provider Contract

The adapter request contains only:

- exact canonical reference and evidence bytes;
- a bounded, versioned rubric and locale;
- a versioned prompt/policy identifier;
- a strict structured-output schema;
- explicit image-detail and client-side resize policy;
- correlation and idempotency identifiers;
- a bounded deadline and maximum response size.

The request must pin the exact model snapshot and set non-thinking mode. The
adapter must not silently fall back to an alias, preview, older snapshot, or
second provider.

The provider response is untrusted. It must validate into the existing
provider-neutral vocabulary:

```json
{
  "decision": "pass | partial | fail | abstain | recapture_required",
  "dimensions": [
    {
      "key": "layout_alignment",
      "score": 0,
      "confidence": 0,
      "reasonCode": "reference_mismatch",
      "explanation": "bounded explanation"
    }
  ],
  "overallConfidence": 0,
  "qualityFlags": [],
  "modelLimitations": []
}
```

Unknown fields, duplicate or missing rubric dimensions, invalid ranges,
unsupported reason codes, oversized text, instruction-following from image
content, invalid JSON, or schema drift fail closed. PR-8B records a typed
terminal benchmark failure or `abstain`; it does not ask the same or another
model to repair the output.

## PR-8A — Decision And Gate Alignment

PR-8A is documentation only. It:

- records the Qwen selection and pinned runtime posture;
- changes the benchmark from competitive provider selection to Qwen
  validation and exit evidence;
- records Region Manager final advisory authority;
- names PR-8B scope, then-current gates, acceptance criteria, rollback, and stop
  conditions;
- updates the active handoff without claiming provider or runtime proof.

PR-8A contains no code, dependency, environment variable, API, database,
authorization, queue, UI, provider request, paid activation, staging mutation,
or production operation.

Rollback is one squash-revert with no runtime or data effect.

## PR-8B — Repository-Only Adapter And Synthetic Smoke Harness

PR-8B may start under the lean pilot decision. Its one review story is: prove
whether the pinned Qwen model satisfies the bounded HR Axis comparison
contract in a 20-pair synthetic smoke without entering a product workflow.

In scope:

- provider-neutral `VisualComparisonPort` contract and Qwen infrastructure
  adapter;
- offline, operator-invoked synthetic smoke harness;
- false-by-default `VISUAL_COMPARISON_BENCHMARK_ENABLED` control;
- exact endpoint allowlist and exact-model startup assertion;
- bounded timeout, response size, retry budget, concurrency, requests, tokens,
  and total benchmark spend;
- strict response validation and typed failure classification;
- fixture manifest, frozen expected outcomes, and deterministic aggregate
  receipts;
- latency, usage, actual cost, schema validity, false-pass/false-fail examples,
  abstention, and recapture metrics;
- isolation tests proving zero official or product-table reads/writes.

Out of scope:

- database migration or mutation;
- auth or permission change;
- public/internal product API;
- queue, outbox, scheduled worker, or retry daemon;
- admin, store, reviewer, or Report Viewer UI;
- product `visual_comparison_run` writes;
- real photographs or staging campaign evidence;
- selected-provider shadow delivery, advisory review, or production.

The harness must support a fully local fake transport for contract tests, but a
fake transport cannot close provider, token, latency, cost, schema, or quality
evidence.

## Synthetic Smoke Contract

Before invocation, freeze 20 synthetic reference/evidence pairs covering
ordinary matches plus lighting, angle, occlusion, layout difference, close
detail, text, recapture, and invalid-output cases. Bind the ordered fixture
hashes to the rubric, schema, and prompt versions. One domain reviewer performs
a usefulness spot-check. This technical smoke makes no statistical accuracy or
subgroup claim. Assets remain private and ignored; they are not committed.

## Minimum Preconditions Before Provider Smoke

1. The configured endpoint accepts the exact pinned model snapshot.
2. The API key is server-side, revocable, absent from Git/logs, and disabled
   after the operator-run smoke when not needed.
3. Request, token, concurrency, timeout, response-size, smoke-spend, and monthly
   spend ceilings fail closed.
4. The 20 synthetic pairs and versioned rubric/schema/prompt are frozen.
5. Disabled configuration and invalid provider output produce typed stops with
   zero product writes.

No provider legal dossier, double-independent review, large blind holdout, or
formal subgroup threshold is required for this advisory-only smoke.

## Provider Evidence Sources

Re-verify these official sources when PR-8B opens because model availability,
deployment scope, capability, and price are time-sensitive:

- [Regions and service deployment scopes](https://www.alibabacloud.com/help/en/model-studio/regions/)
  distinguishes Frankfurt data storage from Global or EU inference scope.
- [Visual understanding](https://www.alibabacloud.com/help/en/model-studio/vision-model)
  documents Qwen 3.7 Plus visual input and non-thinking structured output.
- [Structured output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)
  documents JSON mode and requires application-side validation.
- [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
  identifies the current Qwen 3.7 Plus snapshot and pay-as-you-go token prices.
- [Model Studio overview](https://www.alibabacloud.com/help/en/model-studio/what-is-model-studio)
  documents workspace-specific Frankfurt endpoints and usage billing.

## Functional Requirements

- **FR-PR8-01:** Every request uses the exact pinned Qwen snapshot in
  non-thinking mode with tools disabled.
- **FR-PR8-02:** The adapter accepts only canonical reference/evidence pairs
  and the provider-neutral rubric/schema.
- **FR-PR8-03:** Invalid provider output fails closed without model repair.
- **FR-PR8-04:** The harness freezes fixture outcomes and contract versions
  before invocation.
- **FR-PR8-05:** The harness records actual usage, cost, latency, failure, and
  quality aggregates without private payloads.
- **FR-PR8-06:** No benchmark result is written to product comparison, scoring,
  action, reporting, target, ranking, KPI, or incentive paths.
- **FR-PR8-07:** Disabled configuration prevents every live provider request.

## Non-Functional Requirements

- **NFR-PR8-01 Security:** Secrets are runtime-only, scoped, rotatable, and
  absent from logs, reports, test fixtures, and process arguments.
- **NFR-PR8-02 Content:** Only approved synthetic smoke content is sent;
  metadata, personal data, and public URLs are prohibited.
- **NFR-PR8-03 Reliability:** Timeouts, retryable classes, retry count,
  concurrency, and response size are bounded and fail closed.
- **NFR-PR8-04 Cost:** Request, token, and spend ceilings stop invocation before
  budget overrun; estimates do not replace provider usage receipts.
- **NFR-PR8-05 Reproducibility:** Model, prompt, rubric, schema, fixtures,
  expected outcomes, and harness versions are version-bound.
- **NFR-PR8-06 Observability:** Receipts contain aggregates, versions, digests,
  and typed failures but no image, secret, URL, prompt, or raw response.
- **NFR-PR8-07 Replaceability:** Qwen-specific types do not escape the
  infrastructure adapter.

## Acceptance Criteria

- **AC-PR8-01:** Alias substitution, thinking mode, enabled tool, wrong endpoint,
  or wrong model fails before an invocation.
- **AC-PR8-02:** Invalid JSON, unknown field, missing dimension, invalid score,
  duplicate key, oversized explanation, or prompt-injection response becomes a
  typed failure/abstention and never a pass.
- **AC-PR8-03:** Repeated invocation with the same idempotency identity cannot
  double-count benchmark cost or quality results.
- **AC-PR8-04:** Fixture, expected-outcome, rubric, schema, or prompt changes
  require a new smoke version and invalidate prior aggregate results.
- **AC-PR8-05:** The report includes sample count, usefulness spot-check,
  false-pass/false-fail examples, abstention, recapture, schema validity,
  latency, retry, tokens, and actual cost without statistical claims.
- **AC-PR8-06:** Negative isolation tests prove zero product/database/API/queue/
  UI effect and zero official-score reads or writes.
- **AC-PR8-07:** Disabled or budget-exhausted configuration makes zero network
  requests and returns a typed stop receipt.

## Edge Cases

- **EC-PR8-01:** Provider returns HTTP success with invalid structured content.
- **EC-PR8-02:** Provider times out after processing and reports usage later.
- **EC-PR8-03:** The pinned model alias changes or snapshot becomes unavailable.
- **EC-PR8-04:** One image contains instruction-like text or an unsupported
  visual layout.
- **EC-PR8-05:** The small smoke is mistakenly interpreted as a statistical
  quality or subgroup claim.
- **EC-PR8-06:** Usage fields are missing, inconsistent, or exceed the local
  reservation.
- **EC-PR8-07:** The endpoint redirects, resolves outside the allowlist, or
  returns an unexpected certificate/region identity.

## Verification And Review

PR-8A:

- `git diff --check`;
- `npm.cmd run test:scripts`;
- cold-reader pass against this specification and the active handoff.

PR-8B, after its gates open:

- targeted contract and adapter Jest tests;
- negative endpoint/model/schema/tool/budget/secret tests;
- backend lint, build, and release;
- `npm.cmd run test:scripts`;
- `npm.cmd run check:affected-verification` and its selected canonical proof;
- one fresh root release only when selected by repository policy;
- final R5 `problem_solver_high` adversarial review;
- required GitHub checks, mergeability, squash merge, and post-merge exact-tree
  verification.

Provider-backed evidence is separate from local contract proof. Never report a
fake transport or dry run as Qwen quality, usage, latency, or cost evidence.

## Rollback

PR-8B rollback disables benchmark invocation and revokes its scoped API key.
It preserves sanitized, governed benchmark receipts for audit and deletes
benchmark assets only through their approved retention procedure. Because
PR-8B has no product write path, ordinary checklist and VM workflows continue
unchanged.

## Stop Conditions

Stop before PR-8B invocation, merge, or activation if:

- an exact pinned-model request, server-side secret, or fail-closed budget
  cannot be proven;
- auth, DB, public API, queue, UI, product-table write, or staging mutation
  enters the diff;
- a model alias or second model is needed to obtain valid output;
- provider output can affect official scoring or operational consequences;
- the synthetic fixtures or versioned rubric/schema/prompt are not frozen;
- cost/usage cannot fail closed;
- required checks or final R5 review fail.

## Next Authorized Line

After PR-8B proves the technical smoke, PR-9 may add the hidden shadow queue
with a cost ceiling, idempotency, kill switch, and manual fallback. PR-10 adds
the feature-gated Region Manager advisory surface and a 30-50 comparison
controlled staging pilot. Official AI scoring and broad production remain
outside this train.
