# Import Decision Evidence V1

## Goal

Make the existing admin import batch detail screen expose an operator-level decision without changing import, scoring, materialization, mapping, retry, or backend endpoint behavior.

## Scope

Included:

- Derive a visible decision from the existing batch detail, reconciliation, error, data quality, dependency, and retry evidence.
- Show one of three labels: `Go`, `Conditional Go`, or `No-Go`.
- Show the decision basis next to the label so operators can understand why the screen is warning or blocking.
- Cover the decision panel with the existing integration Playwright surface test.

Not included:

- no new backend endpoint,
- no new import behavior,
- no score math changes,
- no materialization changes,
- no JSON-specific source adapter,
- no broad UI redesign.

## Decision Rules

`Go` means the batch evidence is clean:

- row accounting is matched,
- there are no classified quality issues,
- there are no retryable rows,
- there is no dependency block.

`Conditional Go` means the batch is inspectable but not clean:

- reconciliation evidence is still loading, or
- quality issues exist, or
- retryable rows exist, or
- row-level mapping action is still needed.

`No-Go` means the operator should stop before treating the batch as usable:

- row accounting mismatch,
- unaccounted rows,
- pending rows,
- blocked dependencies,
- failed or stuck state.

## Operator Evidence

The panel shows four factors:

- row accounting,
- quality guard,
- retry evidence,
- dependency mapping.

These are intentionally plain operational terms. They do not replace row-level evidence, lineage evidence, reconciliation details, or error rows; they summarize them.

## Verification

Targeted Playwright coverage:

```text
npm.cmd run test:e2e -- integration-surfaces.spec.ts -g "admin import batch detail explains KPI row lineage evidence"
```

Release gate:

```text
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is a good hardening slice because it does not invent a new workflow. It takes evidence the system already had and turns it into a safer operator decision surface.

The important boundary is that this panel must remain a summary. The backend remains the truth for import rows, reconciliation, mapping, retry, and materialization.
