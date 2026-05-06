# Pilot Readiness Evidence Consolidation V1 Design

## Purpose

Create one current pilot decision evidence note that maps the existing 5-6 May 2026 staging evidence to the Pilot Readiness Gate V1 requirements.

The goal is not to approve broad production rollout. The goal is to make the controlled staging/internal pilot decision easy to review, repeat, and pause if a No-Go trigger appears.

## Current Context

The project already has live staging evidence for the controlled pilot path:

- four Clerk pilot personas and role/scope route smoke,
- ranking privacy smoke for privileged, store-manager, and store-personnel boundaries,
- protected API smoke after the auth refresh fix,
- accepted temporary master-data baseline,
- March 2026 Power BI KPI import and materialization evidence,
- existing `Conditional Go` decision notes.

These notes are useful but spread across multiple files. A reviewer currently has to read several documents to understand why the pilot is no longer the 1 May No-Go, and why it is still not a broad production Go.

## Proposed Artifact

Create:

- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`

This note will be the current operator-facing consolidation. It will include:

- environment and commit,
- final decision: `Conditional Go` for controlled staging/internal pilot,
- gate matrix for the five Pilot Readiness Gate V1 evidence areas,
- evidence file references for each gate item,
- accepted restrictions,
- remaining limits,
- No-Go triggers,
- next operational checklist.

## Guard

Create:

- `scripts/pilot-readiness-consolidation-contract.test.mjs`

The guard will assert that the consolidation note:

- exists at the canonical path,
- records `Conditional Go`,
- references the required evidence files,
- includes the five gate areas,
- preserves the no-secret evidence policy,
- blocks broad production rollout,
- keeps JSON adapter work future-only,
- records no direct Supabase client access without RLS/policy work.

The guard will also require `current-state.md` and `docs/plans/pilot-readiness-gate-v1.md` to link the consolidation note so future context resumes do not miss it.

## Scope

Allowed:

- add the consolidation evidence note,
- add the guard script,
- update `current-state.md` guarded reference/recent evidence,
- update `docs/plans/pilot-readiness-gate-v1.md` current evidence notes,
- run root script tests and pilot stabilization checks.

Not allowed:

- change backend behavior,
- change frontend behavior,
- change auth/scope semantics,
- edit live staging data,
- add JSON/source-specific adapter work,
- approve broad production rollout,
- record raw tokens, cookies, passwords, provider subjects, full JWTs, database secrets, or personal national-id evidence.

## Decision Semantics

The consolidation must say:

- Controlled staging/internal pilot: `Conditional Go`.
- Broad production rollout: not approved.
- Current master data: accepted temporary pilot baseline, not final source of truth.
- March 2026 Power BI import: accepted historical validation data, not proof of future monthly operations.
- Auth/scope: sufficient for controlled test-mode pilot users, with logout/expired-token and real mailbox onboarding still remaining before broad rollout.

## Verification

Run:

```powershell
node --test scripts\pilot-readiness-consolidation-contract.test.mjs
npm.cmd run check:pilot-stabilization
npm.cmd run test:scripts
git diff --check
```

Expected:

- consolidation guard passes,
- pilot stabilization gate passes,
- root script tests pass,
- whitespace check has no errors. Windows CRLF conversion warnings are acceptable.

## Non-Goals

This slice does not create new pilot behavior. It consolidates evidence for the current decision.

This slice does not replace the existing detailed evidence files. It points to them and records the current decision in one place.

This slice does not close the remaining broad-rollout risks: RLS/policy design for direct Supabase access, real mailbox-backed user onboarding, logout/expired-token evidence, final master-data source, future month import operations, UI polish, and measured performance review.
