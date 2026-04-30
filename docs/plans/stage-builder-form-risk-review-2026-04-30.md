# StageBuilderForm Risk Review - 30 April 2026

## Purpose

Review `admin-web/src/features/competitions/StageBuilderForm.tsx` as a frontend maintainability risk without changing production code or redesigning the UI.

This is not a refactor plan and not a new feature plan.

No application behavior was changed by this review.

## Current Shape

Observed file:

- `admin-web/src/features/competitions/StageBuilderForm.tsx` - 2009 lines

The file currently owns multiple related competition admin workflows:

- single stage draft creation
- stage format preset application
- reusable team template creation
- template library list/edit/clone/deactivate
- stage package draft creation
- stage package plan save/update/submit/approve/reject/clone/cancel/execute
- stage package plan audit/history display
- query invalidation and mutation feedback for those workflows

This means the file is large because it is carrying a real workflow cluster, not because it is obviously dead or random code.

## Green Signals

- No `TODO`, `FIXME`, `HACK`, `console.log`, `debugger`, `test.only`, or `as any` markers were found in the file.
- Form controls mostly use visible labels around inputs/selects/checkboxes.
- Action buttons use explicit disabled states during validation or pending mutation states.
- The file uses existing competition API functions and typed payloads instead of ad hoc request objects.
- Competition admin and store-facing coverage exists in `admin-web/e2e/competition-surfaces.spec.ts`.

Observed e2e coverage includes:

- admin competitions surface live score/warnings
- admin creates a competition stage with team store assignments
- admin applies a stage format preset before creating a stage
- admin creates a league then final stage package from templates
- admin saves, submits, approves, and executes a stage package plan
- admin rejects a submitted stage package plan
- admin edits, inspects, and cancels a stage package plan draft
- admin creates a team template and applies it to a stage team
- admin views inactive templates and deactivates active templates
- admin updates and clones competition team templates
- region manager competition surface stays read-only and scoped
- store competition surface renders scoped contribution details

## Risks

### P1 - File Ownership Density

The file combines too many admin workflows in one physical component. Future competition changes could become hard to review because a small UI change may sit next to unrelated plan approval, template lifecycle, and stage creation code.

This is a maintenance risk, not an immediate production bug.

### P1 - Mutation/Invalidation Coupling

The parent component owns several React Query mutations and repeated invalidation rules for package plans, audits, and templates.

Risk:

- future changes may miss one invalidation path,
- feedback states may become harder to reason about,
- unrelated lifecycle actions can appear coupled because they live beside each other.

### P2 - Admin UI Workflow Density

The screen exposes several powerful actions in one surface: create stage, create template, manage template lifecycle, create package, save plan, submit, approve, reject, execute, cancel, and view audit history.

Risk:

- future production UI polish could require a clearer step-by-step layout,
- reversible pilots should be preferred over a broad redesign.

### P2 - Large E2E Companion File

`admin-web/e2e/competition-surfaces.spec.ts` is also large. It is meaningful coverage, but the competition surface now has enough behavior that future frontend changes should preserve or split tests deliberately.

## No-Go Decisions

- Do not refactor `StageBuilderForm.tsx` just because it is large.
- Do not redesign the competition admin UI before backend/data contracts and real operator usage are steadier.
- Do not split all helper functions/components in one pass.
- Do not extract generic abstractions that hide competition business rules.
- Do not change route behavior, permissions, or API contracts during a hygiene-only pass.

## Recommended Future Split Order

If a future competition UI change touches this area, split in small guarded slices:

1. Extract `TemplateBuilderSection` and `TemplateLibrarySection` into a local feature folder only if template behavior is being changed.
2. Extract `StagePackageBuilderSection` only if package plan UX or lifecycle behavior is being changed.
3. Consider a small local hook for package-plan mutations only after a real duplicated invalidation issue appears.
4. Split `competition-surfaces.spec.ts` only by stable user journeys, not by arbitrary line count.

Each split should be mechanical first, with targeted Playwright coverage and root release gate afterwards.

## Decision

Status: `planned_investment`

This is not active debt that should interrupt the backend/data foundation work.

The file deserves respect because it holds a real, tested competition workflow. The safe move is to avoid adding more unrelated behavior to it and revisit it only when competition admin UI changes are actually needed.

## CODEX DURUST YORUM

This file is a pressure point, but not a reason to panic.

It is large because the competition module grew through controlled, tested slices. That is better than a beautiful-looking split with weak behavior coverage.

The real risk is future impatience: if new competition ideas keep getting added here without a UI/domain split plan, it can become a slow screen to change. Today, the correct decision is to record the boundary, stop here, and keep bigger feature work behind the intake gate.

## Recommended Next Move

Do not refactor this file now.

If external evidence is still unavailable, the next local risk review should be a backend repository boundary review for one large repository file, or the project should wait for real staging/source/master-data evidence before opening new product depth.
