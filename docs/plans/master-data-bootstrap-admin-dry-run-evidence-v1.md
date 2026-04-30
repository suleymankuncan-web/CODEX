# Master Data Bootstrap Admin Dry-Run Evidence V1

Date: 30 April 2026

Status: `implemented`

## Purpose

Make master-data promotion safer for operators before a real baseline file is promoted.

The backend already owns promotion readiness. This step exposes that existing row-level readiness evidence in the admin review surface so HR/Admin can inspect what would happen before pressing the live promotion command.

## What Changed

- `/admin/master-data/:batchId` now shows a `Promotion dry-run evidence` panel.
- The panel renders backend `promotion-readiness` rows.
- Each row shows:
  - row number
  - source store code
  - source employee code
  - promotion readiness
  - promoted entity evidence
  - block reason evidence
- The panel explicitly states: `Backend readiness only. No rows are promoted from this panel.`

## Boundaries

- No backend endpoint was added.
- No migration was added.
- No promotion command behavior changed.
- No scoring/import/materialization logic changed.
- No automatic approval or promotion path was opened.

## Why It Matters

Promotion is a live-write operation into `ops.store`, `ops.employee`, and assignment history. The operator should see the backend dry-run result before executing it.

This keeps the control model clean:

1. Validate batch.
2. Review row evidence.
3. Review promotion dry-run evidence.
4. Promote only if backend readiness is clean.

## Verification

- TDD red Playwright test failed first because the dry-run panel did not exist.
- Frontend build passed.
- Targeted Playwright passed:

```powershell
npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts -g "admin master data bootstrap surface exposes personnel promotion evidence"
```

- Official root release gate passed:

```powershell
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is a good small step. It does not invent a new workflow; it makes the existing backend decision visible before a risky live write.

The next real jump should still wait for true store/personnel baseline files. Until then, this panel gives us better operational control without creating fake data or premature automation.

## Next Logical Step

When true baseline master data exists, run a controlled staging/admin review smoke:

1. stage the baseline batch,
2. validate,
3. inspect dry-run evidence,
4. promote only a scoped pilot batch,
5. capture sanitized evidence.
