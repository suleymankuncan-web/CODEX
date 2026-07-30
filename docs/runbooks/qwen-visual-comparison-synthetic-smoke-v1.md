# Qwen Visual Comparison Synthetic Smoke V1

Status: operator-run only; no product workflow integration
Model: `qwen3.7-plus-2026-05-26`

## Purpose

Run exactly 20 synthetic reference/evidence comparisons through the PR-8B
adapter. The command writes only aggregate counts, latency, tokens, and
estimated spend. It does not write a database, queue, checklist, score, KPI,
ranking, target, incentive, or product API.

## Dataset

Keep the dataset outside Git in one private directory. The manifest path is
relative to that directory and contains:

```json
{
  "version": "hr-axis-qwen-smoke-v1",
  "promptPolicyVersion": "hr-axis-qwen-prompt-policy-v1",
  "resultSchemaVersion": "hr-axis-visual-comparison-result-v1",
  "rubricVersion": "hr-axis-vm-rubric-v1",
  "locale": "tr",
  "criteria": [
    { "dimension": "fixture_zone_layout", "requirement": "..." },
    { "dimension": "color_palette_sequence", "requirement": "..." },
    { "dimension": "folded_product_alignment", "requirement": "..." },
    { "dimension": "hanging_product_color_integrity", "requirement": "..." },
    { "dimension": "garment_condition", "requirement": "..." },
    { "dimension": "overall_presentation_balance", "requirement": "..." }
  ],
  "pairs": [
    {
      "id": "pair-01",
      "referenceFile": "references/01.webp",
      "evidenceFile": "evidence/01.webp",
      "referenceSha256": "64-lowercase-hex",
      "evidenceSha256": "64-lowercase-hex",
      "expectedDecision": "pass"
    }
  ]
}
```

The `pairs` array must contain exactly 20 unique entries. Paths cannot escape
the dataset root. Images and their digests are verified, decoded,
metadata-stripped, and re-encoded as canonical WebP before each request.

## Required Environment

Set secrets only in the operator shell or approved secret store. Never place
them in Git, command arguments, screenshots, receipts, or chat.

- `QWEN_VISUAL_COMPARISON_ENABLED=true`
- `QWEN_API_KEY`
- `QWEN_ALLOWED_HOST_SHA256` — lowercase SHA-256 of the exact workspace
  hostname, without scheme, path, or port
- `QWEN_BASE_URL` — exact Frankfurt workspace base ending in
  `/compatible-mode/v1`
- `QWEN_MODEL=qwen3.7-plus-2026-05-26`
- `QWEN_SMOKE_DATASET_ROOT`
- `QWEN_SMOKE_MANIFEST` — relative to dataset root
- `QWEN_SMOKE_RUN_ID` — unique operator-selected identifier

The runner derives the receipt name from the run ID and manifest digest inside
the dataset root. An existing receipt blocks an accidental repeat of the same
run and manifest.
- `QWEN_TIMEOUT_MS` — maximum `120000`
- `QWEN_MAX_RESPONSE_BYTES` — maximum `262144`
- `QWEN_MAX_OUTPUT_TOKENS` — maximum `1024`
- `QWEN_MAX_TOKENS_PER_REQUEST` — conservative input plus output reservation,
  maximum `20000`
- `QWEN_SMOKE_MAX_TOTAL_TOKENS`
- `QWEN_SMOKE_MAX_SPEND_USD_MICROS`
- `QWEN_INPUT_USD_MICROS_PER_MILLION_TOKENS`
- `QWEN_OUTPUT_USD_MICROS_PER_MILLION_TOKENS`
- `QWEN_MIN_ADVISORY_CONFIDENCE` — decimal from `0` to `1`

Price inputs must be copied from the current Alibaba Model Studio price for the
exact snapshot at run time; the repository intentionally has no stale default.

## Command

```powershell
npm.cmd --prefix backend/nestjs run smoke:qwen-visual-comparison
```

## Expected Result

Success writes one sanitized
`visual_comparison.synthetic_smoke.completed` JSON line and the same terminal
receipt. Failure writes one typed `visual_comparison.synthetic_smoke.failed`
JSON line, updates the receipt with conservative budget state, and exits
non-zero.
Raw images, prompts, responses, API keys, full endpoints, and signed URLs are
never written.

## Stop And Rollback

- Stop on wrong model, invalid output, timeout, budget exhaustion, digest
  mismatch, unexpected endpoint, or any attempt to add product writes.
- Set `QWEN_VISUAL_COMPARISON_ENABLED=false` and revoke/disable the smoke key.
- Manual checklist and review flows require no recovery because this runner has
  no product integration.
