# Product Readiness V1 Closeout

## Purpose

Close the current Product Readiness V1 pass after the audit-selected surfaces
were handled. This is a docs-only decision record. It does not change code, API
shape, auth, permissions, DB state, KPI/ranking scoring, import lifecycle,
competition state, CSS behavior, or user workflow semantics.

## Completed Surface Line

- Product Surface Audit V2 selected the next surfaces by repo/test evidence:
  Admin KPI Config, Store KPI / Rankings, and Integration Dashboard / Master
  Data.
- Admin KPI Config Row Context V1 improved repeated metric, ownership, and
  grading-band row accessibility and added targeted mobile boundedness evidence.
- Store Rankings Table Context V1 added a localized hidden table caption and
  targeted mobile boundedness evidence for `/store/rankings`.
- Master Data Personnel Row Context V1 added row-specific accessible labels and
  targeted mobile boundedness evidence for `/admin/master-data` personnel
  controls.

## Sokrates Triage

Claim:

- The current Product Readiness V1 pass should close here instead of opening
  Stage Builder / Competition by default.

Assumptions:

- The three audit-selected surfaces have now received the smallest useful V1
  improvements with targeted verification.
- The Stage Builder / Competition surface should only reopen if a fresh
  browser, pilot, or test evidence pass isolates a concrete product gap.
- A docs-only closeout is the safest way to preserve the decision trail before
  starting a new line of work.

Repo evidence:

- `admin-web/src/features/competitions/StageBuilderForm.tsx` is now below the
  earlier danger zone after previous model, template-section, and package-section
  splits.
- `docs/plans/technical-debt-resolution-roadmap-v1.md` already parks further
  Stage Builder frontend extraction unless a concrete product or reviewability
  trigger appears.
- `admin-web/e2e/competition-surfaces.spec.ts` covers competition list/detail,
  localization, stage creation, preset application, stage-package creation,
  package-plan save/submit/approve/execute/reject/edit/cancel/clone, template
  create/update/clone/deactivate, and read-only scoped visibility.
- Current Stage Builder work is close to package-plan payloads, submission
  state, review state, execution state, and template command behavior.

Counterargument:

- Stage Builder is still a complex page and can still benefit from future
  readability, accessibility, or mobile evidence work. Closing this pass does
  not mean the surface is perfect.

Risk:

- Continuing into Stage Builder now is MEDIUM/HIGH because the safe UI surface
  is adjacent to competition payload/state-machine behavior. A small visual
  change can easily become a command-flow or lifecycle change.
- Closing the pass as docs-only is LOW risk and keeps the next decision
  reversible.

Door:

- Docs closeout is a two-way door.
- Competition payload, package-plan lifecycle, score/finalization, execution,
  or state-machine changes are near one-way doors and remain out of scope.

Stop rules:

- Stop if a proposed Stage Builder fix touches submission payloads,
  package-plan lifecycle, stage state, review/execute/cancel semantics, scoring,
  finalization, backend repository behavior, API contracts, auth, permissions,
  DB state, or CSS-global behavior.
- Stop if a Product Readiness PR cannot be explained as one reviewable,
  revertible route-family improvement.

Verification ladder for this docs-only closeout:

1. Read the diff.
2. Run `git diff --check`.
3. Require GitHub checks and Codex no-major or thumbs-up before merge.

## Decision

Close the current Product Readiness V1 pass. Do not open Stage Builder /
Competition by default. Reopen it only with fresh, concrete evidence for a
readability, accessibility, mobile boundedness, or test-coverage gap that can be
fixed without touching package-plan payloads, command semantics, state-machine
behavior, scoring, finalization, backend repositories, API contracts, auth,
permissions, DB state, or CSS-global behavior.

## Parked High-Risk Backlog

Keep parked without a separate decision:

- command/write/auth/permission changes,
- DB migrations,
- API Gateway or service decomposition,
- external provider evidence without real secured inputs,
- JSON/source adapter work,
- import lifecycle, retry, promotion, and evidence-export semantics,
- KPI/ranking scoring or source-trust semantics,
- competition payload, package-plan lifecycle, score/finalization, execution,
  and state-machine behavior.

## Recommended Next Line

Do not continue broad UI polish from inertia. Pick the next line from fresh
evidence:

- if real staging/provider inputs exist, execute the external evidence closure
  path;
- if no external inputs exist, run a fresh route-level audit or pick a narrow
  pilot-facing product gap backed by browser/test evidence;
- if a concrete engineering blocker appears, use the technical debt roadmap to
  choose one isolated refactor or guardrail slice.
