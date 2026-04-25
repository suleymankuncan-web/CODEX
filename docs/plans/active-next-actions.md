# Active Next Actions

## Purpose

This is the short working list for the next practical steps. It keeps the project from scattering into many half-started ideas.

## Current Position

As of 25 April 2026, the competition package planning flow has:

- saved drafts
- edit/cancel/history
- decision-ready approval gate
- approve/return decision lock
- approved-only execute
- returned-plan clone as new draft
- backend and frontend release checks

## Rules For Picking The Next Item

- Use the feature intake interview before new workflow/data/permission work.
- Prefer the smallest next feature that strengthens the current module.
- Do not open a large new module if the current module has an unfinished control surface.
- Keep API status/audit codes stable; improve UI language through labels.

## Ordered List

### 1. Package Plan Source Visibility
- Priority: `P1`
- Why: cloned drafts should clearly show where they came from.
- Scope:
  - show source plan info in history and/or card metadata
  - keep source and clone audit trail readable
  - avoid schema changes unless truly needed
- Suggested verification:
  - backend audit tests
  - competition Playwright smoke

### 2. Package Plan Pre-Approval Preview
- Priority: `P1`
- Why: before approval, HR should see a compact final decision summary.
- Scope:
  - stage dates
  - team templates
  - store counts
  - warnings/coverage if available
- Suggested verification:
  - Playwright decision-ready UI test

### 3. Stage Package Template Variants
- Priority: `P1`
- Why: league + final is only the first tournament structure.
- Scope:
  - configurable stage package presets
  - first-half league / second-half final style packages
  - longer open-ended tournament plans later
- Gate:
  - run feature intake interview before implementation

### 4. Store/Region Competition Experience Polish
- Priority: `P1`
- Why: admin can build competitions; store and region users need clearer read experiences.
- Scope:
  - scoped competition detail readability
  - contribution explanations
  - ranking/coverage copy
- Suggested verification:
  - store competition Playwright smoke
  - region read-only smoke

### 5. Turkish UI Localization Foundation
- Priority: `P1`
- Why: product default will be Turkish, and current competition UI copy is still English.
- Scope:
  - typed frontend label dictionary or selected i18n foundation
  - start with competition/store surfaces
  - keep API enum/audit codes untranslated
- Reference:
  - `docs/plans/ui-localization-strategy.md`

### 6. Real IdP Staging Evidence
- Priority: `P1`
- Why: auth is stable locally, but production confidence needs real provider evidence.
- Scope:
  - fill provider readiness checklist
  - run PKCE login/logout smoke
  - store sanitized evidence only
- References:
  - `docs/plans/phase-7-provider-readiness-checklist.md`
  - `docs/plans/phase-7-auth-evidence-template.md`

### 7. Global Audit Feed Consideration
- Priority: `P2`
- Why: audit trails exist per feature, but operators may later need one cross-module feed.
- Scope:
  - decide if global audit feed is needed
  - avoid building until a real operator workflow requires it

## Recommended Next Move

Do `Package Plan Source Visibility` next. It is small, close to the work just completed, and improves trust in the clone-as-draft flow without opening a new large module.
