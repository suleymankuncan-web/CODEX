# Checklist Visit Elapsed Polish Evidence

Date: 2026-07-07
Branch: `codex/checklists-visit-elapsed-polish-v1`
Finding: PRA-20260707-05

## Scope

- Align checklist filter controls so search/select fields and `Filtreleri sıfırla` share the same vertical rhythm.
- Keep the existing `Ziyaretten Geçen Süre` visit column readable inside the visit table.
- Preserve checklist filtering, start/continue, completion, acknowledgement, and BM/VM visibility behavior.

## Root Cause

- The reset button used a shorter intrinsic height than the filter fields, so the toolbar read as uneven even though the controls were in the same grid row.
- The visit table already had the elapsed-days data cell, but the grid allocation gave the new elapsed column limited room and could make the right-side action area feel compressed.

## Non-goals

- No checklist workflow changes.
- No BM/VM count semantics changes.
- No API, DB, auth, scoring, task generation, or acknowledgement behavior changes.
- No broad checklist redesign.

## Verification

- PASS: `npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts`
  - 29 tests passed.
  - Vite proxy warnings appeared for unmocked Store Actions prefetch calls, but the command exited 0.
- PASS: `npm.cmd --prefix admin-web run test:e2e -- store-checklists-contracts.spec.ts`
  - 1 test passed.
