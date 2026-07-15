# Interaction And Responsive Contract

## Page Anatomy

Prefer this operational sequence:

1. Role-aware product shell.
2. Compact header with period/context controls.
3. Optional breadcrumb for multi-level scope.
4. Data-backed decision metric strip.
5. Compact search/filter/sort command row.
6. Main table, list, accordion, plan board, or workbench.
7. Detail drawer/sheet or focused dialog.
8. Pagination or bounded incremental history loading.

Adapt the anatomy to the workflow. Do not add empty layers only to reproduce the
sequence.

## Controls

- Use a compact liquid segmented switch for two or three closely related views.
- Use text-integrated sorting in desktop column headings. Show the active sort
  direction in the label rather than adding decorative icons.
- When column headings disappear on mobile, provide an equivalent compact sort
  selector.
- Keep search, filters, period selection, and column choices grouped as one
  command surface.
- Close popovers on outside click and Escape.
- Use visible focus, dialog focus trap, focus restoration, and body scroll lock.
- Respect `prefers-reduced-motion`.

## Tables And Dense Data

- Keep desktop columns proportionate to decision importance, not evenly spread.
- Keep related columns visually close, including visit/status and BM/VM scores.
- Convert tables to operational cards/rows on mobile. Do not rely on horizontal
  page scrolling as the default solution.
- Preserve sorting, status, and primary detail access after the mobile
  transformation.
- Use pagination for long active lists and bounded incremental loading for long
  audit timelines.

## Weekly Planning

- Show the current week as Monday-Saturday; Sunday is outside the planning grid.
- Use one `Haftayı Planla` entry point.
- Edit a draft in a focused dialog; allow multiple stores per day and the same
  store on different days.
- Apply the draft only through one final `Ziyaret Planını Kaydet` action.
- Show completed, waiting, missed, and in-progress visit/checklist outcomes.
- Report Viewer may inspect weekly plans but must not see mutation controls.

## Drawers And Timelines

- Use a right-side drawer for desktop detail and a full-width sheet/drawer on
  mobile.
- Preserve Living Store Record as a store-level chronological audit trail.
- Show actor snapshot, date, event, task assignment, resolution, and open state
  without duplicating the main operational page.
- Keep long histories bounded and load more without losing context.

## Viewports

Verify at minimum:

- 1440x900 desktop.
- 1024x768 compact desktop/tablet.
- 390x844 common mobile.
- 320px narrow mobile.

At every width require `scrollWidth <= clientWidth`, readable controls, visible
focus, reachable primary actions, and no overlap with sticky/floating controls.
