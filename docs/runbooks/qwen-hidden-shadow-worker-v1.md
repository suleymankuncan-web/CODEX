# Qwen Hidden Shadow Worker V1

Status: disabled-by-default controlled-pilot runtime

## Purpose

Process finalized VM campaign evidence in a hidden advisory lane. The worker
compares private canonical WebP reference/evidence media and writes only a
sanitized result to `ops.visual_comparison_run`. It does not change checklist
completion, VM approval, Store Action, KPI, ranking, target, incentive, report,
or official scoring behavior.

## Safe Default

Keep both switches off until an exact staging scope and run window are approved:

```text
VISUAL_COMPARISON_ENQUEUE_ENABLED=false
VISUAL_COMPARISON_WORKER_ENABLED=false
```

With either switch off, no new provider work starts. Existing manual VM
submission and Region Manager review continue unchanged.

## Controlled Runtime Inputs

The enqueue process requires:

- `QUEUE_BACKEND=bullmq` when the worker is enabled;
- `VISUAL_COMPARISON_COMPANY_ID`;
- `VISUAL_COMPARISON_REFERENCE_SET_ID`;
- `VISUAL_COMPARISON_NOT_BEFORE` as an exact ISO timestamp;
- `VISUAL_COMPARISON_RECONCILE_LIMIT` and poll interval;
- `VISUAL_COMPARISON_MAX_ATTEMPTS` and processing lease;
- `QUEUE_VISUAL_COMPARISON_NAME`.

The worker additionally requires the approved Qwen runtime values:

- `QWEN_BASE_URL` for the exact Frankfurt workspace compatible endpoint;
- `QWEN_ALLOWED_HOST_SHA256` for that hostname;
- `QWEN_API_KEY` from the server-side secret store;
- `QWEN_MODEL=qwen3.7-plus-2026-05-26`;
- timeout, response-byte, request, token, spend, and price ceilings.

Price ceilings must be explicit positive values. Request, conservative token,
and spend reservations are serialized and accumulated in the shadow ledger, so
a worker restart or second replica cannot reset the approved run-window budget.

Never put a key, full endpoint, raw image, signed URL, prompt, or provider
response in Git, logs, screenshots, receipts, or chat.

## Activation Order

1. Confirm Redis, worker, private photo storage, and exact scope health.
2. Set the exact company, reference set, not-before timestamp, and conservative
   budgets while both switches remain `false`.
3. Enable the worker switch and verify startup registration without provider
   traffic.
4. Enable enqueue only for the approved window.
5. Observe sanitized run counts, typed failures, tokens, latency, and spend.
6. Disable enqueue when the bounded comparison count is reached.
7. Disable the worker after in-flight work settles.

Only provider timeout and provider unavailable failures retry, and the final
permitted attempt becomes terminal. A processing lease can recover a crashed
worker; attempt-number compare-and-set prevents the stale worker from completing
or failing a newer attempt. Configuration,
request, schema, model, disabled, budget, media, and unexpected failures are
terminal. The durable ledger and stable job ID make duplicate delivery a no-op.

## Stop And Rollback

Immediately set both switches to `false` for wrong scope/model/host, budget
pressure, repeated provider failures, media integrity failure, or any product
side effect. Leave shadow ledger rows intact for diagnosis. No product rollback
or score repair is required because this lane has no official product sink.
