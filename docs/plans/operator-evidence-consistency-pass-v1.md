# Operator Evidence Consistency Pass V1

## Goal

Make existing operator-facing evidence language consistent across import and master-data surfaces.

This is a hardening pass, not a new workflow.

## Boundary

No new workflow is introduced.

No endpoint is added.

No backend behavior is changed.

No broad UI redesign is included.

No import, mapping, materialization, promotion, scoring, or auth semantics are changed.

## Shared Evidence Dictionary

Use the same operator words where the evidence already exists:

- `Go / Conditional Go / No-Go`
- `row evidence`
- `dry-run evidence`
- `sanitized evidence`
- `retry evidence`
- `dependency mapping`

Meaning:

- `Go`: current evidence is clean enough to continue the already-approved operator flow.
- `Conditional Go`: current evidence is inspectable but needs review before being treated as clean.
- `No-Go`: current evidence says the operator should stop and fix the blocking condition first.
- `row evidence`: row-level source, resolution, issue, lineage, or promoted entity proof.
- `dry-run evidence`: backend readiness evidence shown before the explicit live command.
- `sanitized evidence`: proof that can be stored or shared without tokens, secrets, raw credentials, or sensitive payloads.
- `retry evidence`: whether failed or retryable import rows can safely be retried.
- `dependency mapping`: whether unresolved external IDs block materialization or promotion.

## Existing Surfaces

Import batch detail:

- keep the existing `Operator decision evidence` panel,
- keep `Go / Conditional Go / No-Go` as the decision labels,
- make the summary use the shared dictionary terms.

Master data bootstrap:

- keep the existing row evidence and promotion dry-run panels,
- make the batch list copy mention row evidence and dry-run evidence together,
- make the dry-run panel copy explicitly say no live rows are promoted from the dry-run panel.

## Verification

Targeted guard:

```powershell
node --test scripts\operator-evidence-consistency-contract.test.mjs
```

Targeted frontend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- integration-surfaces.spec.ts
```

Release gate:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is the right kind of small hardening.

The project will not scatter from this pass because we are not opening a new operator engine, endpoint, or page. We are making the existing evidence surfaces speak the same language so the operator does not have to translate between import, dry-run, row evidence, and decision states.

The risk would be over-designing this into a second approval workflow. V1 deliberately avoids that.

## Next Logical Step

After this pass, keep new module work closed unless the intake interview proves the existing surface cannot carry it.
