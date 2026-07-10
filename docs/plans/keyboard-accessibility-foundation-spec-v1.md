# Keyboard And Accessibility Foundation Specification V1

Status: approved through project-wide remediation plan; implementation pending
Shelf: active plan
Author: Codex
Owner: Product owner
Date: 2026-07-10
Target pull request: PR-7
Change type: frontend semantics, focus behavior, and bounded accessibility evidence

## 1. Findings And Repo Evidence

### A11Y-01 — Master Data selection is pointer-owned

`master-data-control-center-tables.tsx` assigns selection through `onClick` on
four table-row families. A `tr` is not a native interactive control, has no
meaningful accessible name, and is not reachable by ordinary Tab navigation.
The visible `Open` and `Fix` buttons inherit selection only because their click
bubbles to the row. Audit history already uses native buttons and is the safe
local precedent.

### A11Y-02 — Repeated navigation has no bypass link

Admin and Store shells expose named `main` landmarks, but neither shell has a
skip link, stable main target id, or programmatically focusable destination.
Keyboard users must traverse the repeated sidebar before every route body.

### A11Y-03 — No bounded automated accessibility seed exists

The frontend has no axe dependency or Playwright axe fixture. Existing browser
tests cover layout, role visibility, copy, and workflow behavior, but do not
fail on a critical WCAG violation in a stable protected shell or Master Data
state.

## 2. Goals

- Give every Master Data table selection path a native, row-specific control.
- Preserve valid table header/body/cell relationships.
- Make pointer, Enter, and Space activation resolve the same selected record.
- Keep independent nested actions from selecting a row through event bubbling.
- Let keyboard users bypass Admin and Store navigation and move focus to the
  active main landmark.
- Establish a deliberately bounded axe seed without claiming whole-product
  WCAG conformance.

## 3. Non-goals

- No visual redesign, table virtualization, dialog rewrite, or navigation
  restructure.
- No API, OpenAPI, query, mutation, authorization, role, DB, or workflow change.
- No repository-wide axe rollout and no claim that all WCAG A/AA findings are
  closed.
- No auth/prototype skip-link requirement; the first slice covers the two
  protected shells with repeated navigation.
- No replacement of existing shadcn/project primitives.

## 4. Master Data Interaction Contract

- Issues, stores, personnel, and import rows must not rely on `tr onClick` for
  activation.
- Each row receives one native `button` in its decision/action cell. The
  accessible name combines the action and source-provided row name, for example
  `Open IstinyePark Demo Store`.
- The button exposes the selected state with `aria-pressed` and retains the
  existing `data-selected` row styling.
- Enter and Space use native button semantics; no manual key-code emulation is
  added.
- Existing audit-history buttons remain native and receive selected-state and
  row-specific naming parity where missing.
- A future independent link/menu/button inside a row must not select the row.
  The selection callback belongs only to the explicit selection control.
- Column headers receive `scope="col"`. No `role="button"` is added to `tr`,
  and no button is nested inside another interactive element.
- Focus-visible styling uses existing Admin command tokens and remains visible
  against selected and unselected row backgrounds.

## 5. Skip-Link And Main-Focus Contract

- One shared protected-shell skip-link component is rendered before repeated
  Admin or Store navigation.
- Its label is owned by the existing typed localization dictionary in Turkish
  and English.
- The link is visually hidden until keyboard focus and uses existing shell
  tokens for contrast and focus indication.
- Admin and Store `main` landmarks use the same stable target id because only
  one protected shell renders at a time.
- The target has `tabIndex={-1}`. Activating the skip link updates the URL
  fragment, scrolls to the main landmark, and moves programmatic focus there.
- Route transitions do not steal focus automatically; this PR changes only the
  explicit user-requested skip action.

## 6. Bounded Axe Seed

- Add `@axe-core/playwright` as a frontend development dependency with the lock
  file updated by the package manager.
- Scan only two deterministic states in the first slice:
  - Store Home with a stable mocked Store Manager session;
  - loaded Admin Master Data issues state with stable mocked data.
- Restrict the scan to WCAG 2 A/AA tags and assert that violations whose impact
  is `critical` equal zero.
- The failure output includes rule id, impact, help text, and affected targets.
- Do not disable rules to obtain green. A rule may be excluded only by a new
  evidence-backed spec amendment explaining why the state is not applicable.
- The seed is a regression floor, not evidence of full WCAG 2.1 AA conformance.

## 7. Acceptance Criteria

### AC-01 — Native row selection

Given a loaded Master Data table with at least two rows, when a keyboard user
Tabs to the second row's named control and presses Enter or Space, then the
second record becomes selected, its detail state updates once, and the table
row retains valid semantics.

### AC-02 — Nested action isolation

Given a selected row and an independent nested action, when that action is
activated, then its own behavior runs and the selected row id does not change.

### AC-03 — Skip to main

Given either protected shell, when the first-focus skip link is activated, then
the visible focus target is the named `main` landmark and the repeated sidebar
has been bypassed.

### AC-04 — Localization

Given Turkish or English locale, the skip link and new product-owned accessible
names use the selected locale while source-provided store/personnel/import names
remain unchanged.

### AC-05 — Automated regression floor

Given the two deterministic browser states, when the bounded axe scan runs,
then critical WCAG 2 A/AA violations equal zero and no rule is silently disabled.

### AC-06 — Existing behavior

Existing Master Data selection/detail, edit, import, mobile, route-role, Admin
shell, and Store shell tests remain green. Network requests and payloads do not
change.

## 8. Verification

- RED then GREEN Playwright tests for Tab, Enter, Space, selected state,
  row-specific names, and nested-action isolation.
- Admin and Store skip-link focus tests in Turkish and English.
- Bounded axe test for the two named states.
- Existing `master-data-surfaces.spec.ts`, relevant integration/admin routing
  tests, and protected shell tests.
- Frontend lint, build, unit/script tests, root guards, and one canonical release.

## 9. Contract Impact

Contract Impact: intentionally unchanged.

- API/OpenAPI: none.
- Auth/permission/role visibility: none.
- Database/migrations: none.
- Query keys, requests, mutations, and payloads: none.
- Product data and source labels: none.

## 10. Rollback And Stop Rules

Rollback is one PR revert: restore prior row markup, remove the shared skip link
and focus target attributes, remove the bounded axe test/dependency, and restore
the lock file together.

Stop implementation if:

- a table action's real behavior cannot be distinguished from selection;
- valid table markup would require a broad table-component rewrite;
- axe exposes a critical violation outside the two owned states that needs a
  separate visual/auth/workflow change;
- focus handling starts changing route-transition behavior;
- any API, auth, DB, or workflow contract would need to change.
