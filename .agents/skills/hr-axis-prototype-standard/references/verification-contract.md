# Prototype Verification Contract

Do not call an HR Axis prototype ready until fresh evidence covers the relevant
items below.

## Mechanical

- Run the prototype's production build.
- Run targeted interaction or component tests when present.
- Confirm console error count is zero in the exercised flows.
- Confirm every edited skill with `quick_validate.py`.

## Visual And Responsive

- Inspect desktop and mobile in a real browser.
- Check 1440x900, 1024x768, 390x844, and 320px when layout-sensitive.
- Assert `document.documentElement.scrollWidth <= clientWidth`.
- Check sticky/floating controls, drawer width, dialog scroll, table-to-card
  transformation, and text overlap.

## Interaction

- Exercise metric filters and prove result counts/order change.
- Exercise desktop heading sorts and mobile equivalent sorts.
- Exercise period/view filters, pagination, accordion/drill-down, drawer, and
  weekly plan when present.
- Check outside-click, Escape, focus trap, focus restoration, and scroll lock
  for overlays.
- Check loading, empty, error, access, and partial-data states.

## Role Safety

- Report Viewer renders no mutation controls.
- Region Manager retains the accepted operational workflow.
- Store Manager exposes only one assigned store.
- Role switching clears prior-role transient state in prototypes.

## Production Translation

- Remove fixture data and demo role switching.
- Map every visible metric, status, and action to a real source.
- Use shared semantic tokens and production components.
- Compare desktop and mobile screenshots with the approved prototype.
- Report `Prototype parity: PASS` only after material visual parity is proven;
  otherwise report `BLOCKED` with exact differences.
