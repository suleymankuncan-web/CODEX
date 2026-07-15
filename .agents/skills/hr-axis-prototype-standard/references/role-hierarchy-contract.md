# Role Hierarchy Contract

Role visibility is a data boundary, not a CSS variation. Derive metrics, rows,
filter counts, plans, audit records, and drawer content from one scoped source.

## Report Viewer

- Show company -> region managers -> stores.
- Allow region accordion/drill-down, store scores, weekly visit plans, checklist
  outcomes, task state, and audit history.
- Keep the entire surface read-only.
- Do not render plan, save, checklist-start, task mutation, or submit controls.
- Do not change the role to Region Manager during drill-down.

## Region Manager

- Show only the assigned region and its stores.
- Preserve operational visit planning, BM/VM checklist flow, task follow-up,
  store audit history, filters, sorting, and pagination.
- Keep plan/checklist/action counts consistent with the same region scope.

## Store Manager

- Show only the assigned store.
- Show its visits, checklist results, tasks, and audit history.
- Do not show another store, region totals, company totals, BM/VM region visit
  planning, or BM/VM checklist-start controls.
- Add Store Manager mutations only when the real product contract assigns them.

## Prototype Role Switcher

- A role switcher is allowed only as a prototype comparison tool.
- Reset open drawers, dialogs, filters, pagination, week offset, and selection
  when switching roles.
- Remove the switcher in production; production role comes from the session and
  must be enforced by API/authorization boundaries.
