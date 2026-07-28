# Qwen Visual Comparison PR-8 Execution Spec V1

Status: owner-selected provider; PR-8A documentation alignment authorized;
provider invocation and product activation gated
Date: 2026-07-28
Risk: R5
Parent: `checklist-photo-evidence-and-vm-visual-assessment-plan-v1.md`

## Reader And Required Action

This specification is for the engineer who will prepare the visual-comparison
benchmark and, only after its external gates close, implement the Qwen adapter.
After reading it, that engineer must be able to distinguish documentation-only
PR-8A from repository-only PR-8B and must know which evidence is required
before the first provider request.

This specification does not authorize an API key, paid service, provider call,
real photograph, staging mutation, queue, product UI, advisory visibility, or
production activation.

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
- names PR-8B scope, external gates, acceptance criteria, rollback, and stop
  conditions;
- updates the active handoff without claiming provider or runtime proof.

PR-8A contains no code, dependency, environment variable, API, database,
authorization, queue, UI, provider request, paid activation, staging mutation,
or production operation.

Rollback is one squash-revert with no runtime or data effect.

## PR-8B — Repository-Only Adapter And Blinded Harness

PR-8B may start only after every external gate below is evidenced. Its one
review story is: prove whether the pinned Qwen model satisfies the frozen HR
Axis visual-comparison contract without entering a product workflow.

In scope:

- provider-neutral `VisualComparisonPort` contract and Qwen infrastructure
  adapter;
- offline, operator-invoked blinded benchmark harness;
- false-by-default `VISUAL_COMPARISON_BENCHMARK_ENABLED` control;
- exact endpoint allowlist and exact-model startup assertion;
- bounded timeout, response size, retry budget, concurrency, requests, tokens,
  and total benchmark spend;
- strict response validation and typed failure classification;
- digest-bound dataset manifest, frozen labels, blinded holdout, subgroup
  minimums, and deterministic aggregate receipts;
- latency, usage, actual cost, schema validity, false-pass, false-fail,
  abstention, recapture, and subgroup metrics;
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

## Benchmark Dataset Contract

Before any candidate output is visible, freeze:

- 100–150 representative reference/evidence pairs;
- 20–30 hard cases covering lighting, angle, occlusion, layout difference,
  close detail, text, and instruction-like image content;
- device, lighting, layout, and store-class subgroup labels;
- two independent human reviews and a resolved gold label;
- an untouched blinded holdout;
- a manifest digest over ordered image hashes, rubric version, label version,
  subgroup fields, and split assignment.

The report must disclose insufficient subgroup sample sizes. No score is
invented for a missing cohort. Benchmark assets and labels must use a private,
ignored location and must not be committed.

## External Gates Before PR-8B

All of the following must exist:

1. The selected Alibaba workspace, region/deployment scope, dedicated endpoint,
   and pinned-model availability are verified.
2. Sandbox/API-key custody, rotation, revocation, and least-privilege owner are
   approved without exposing the secret to Git or logs.
3. Product terms, DPA/transfer mechanism, subprocessors, inference and support-
   log location, no-training posture, retention/deletion, and incident owner
   are accepted for the intended synthetic benchmark data.
4. Per-request and monthly token/cost ceilings plus an exact benchmark spend
   ceiling are owner-set.
5. The frozen digest-bound, double-reviewed dataset and blind holdout pass the
   dataset contract.
6. The false-pass tolerance, false-fail tolerance, minimum structured-output
   validity, maximum abstention, subgroup minimums, latency ceiling, and exit
   rule are owner-set before outputs are opened.

A Frankfurt endpoint does not prove EU-only inference: Frankfurt workspaces
can use Global or EU deployment scope. The exact snapshot's availability in the
chosen scope must be verified. Selecting Frankfurt therefore does not close
data-transfer, retention, deletion, or subprocessor evidence by itself.

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
- **FR-PR8-04:** The harness freezes labels and split digests before invocation.
- **FR-PR8-05:** The harness records actual usage, cost, latency, failure, and
  quality aggregates without private payloads.
- **FR-PR8-06:** No benchmark result is written to product comparison, scoring,
  action, reporting, target, ranking, KPI, or incentive paths.
- **FR-PR8-07:** Disabled configuration prevents every live provider request.

## Non-Functional Requirements

- **NFR-PR8-01 Security:** Secrets are runtime-only, scoped, rotatable, and
  absent from logs, reports, test fixtures, and process arguments.
- **NFR-PR8-02 Privacy:** Only approved benchmark content is sent; raw media,
  metadata, personal data, and public URLs are prohibited.
- **NFR-PR8-03 Reliability:** Timeouts, retryable classes, retry count,
  concurrency, and response size are bounded and fail closed.
- **NFR-PR8-04 Cost:** Request, token, and spend ceilings stop invocation before
  budget overrun; estimates do not replace provider usage receipts.
- **NFR-PR8-05 Reproducibility:** Model, prompt, rubric, schema, dataset, labels,
  split, and harness versions are digest-bound.
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
- **AC-PR8-04:** Dataset or label changes invalidate the manifest and require a
  new benchmark version; holdout labels remain hidden until invocation closes.
- **AC-PR8-05:** The report includes sample counts, uncertainty, false-pass,
  false-fail, abstention, recapture, subgroup error, schema validity, latency,
  retry, tokens, and actual cost.
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
- **EC-PR8-05:** A subgroup is too small for an acceptance claim.
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

Stop before PR-8B implementation, invocation, merge, or activation if:

- any external gate is missing;
- real media is required before a genuine malware-scanner adapter is proven;
- auth, DB, public API, queue, UI, product-table write, or staging mutation
  enters the diff;
- a model alias or second model is needed to obtain valid output;
- provider output can affect official scoring or operational consequences;
- endpoint scope, retention, deletion, no-training, subprocessor, or incident
  evidence is inferred rather than accepted;
- the dataset is not frozen, blinded, digest-bound, and double-reviewed;
- cost/usage cannot fail closed;
- required checks or final R5 review fail.

## Next Authorized Line

After PR-8B proves the locked acceptance thresholds, a separately gated PR-9
may add the selected-provider hidden shadow queue. PR-9 still requires a fresh
owner shadow Go, cost ceiling, queue reliability proof, holdout result, and
provider contract. PR-10 advisory review remains separate. Official AI scoring
and broad production remain outside this train.
