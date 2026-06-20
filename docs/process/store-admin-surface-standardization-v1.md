# Store/Admin Surface Standardization V1

Status: active
Shelf: process

## Reader And Action

Reader:

- future engineer, agent, product owner, or UI reviewer creating or refactoring
  a Store/Admin product surface.

After reading, they should be able to:

- produce a Store/Admin prototype or production page that matches the approved
  HR Axis surface language,
- keep prototype and production copy/data structures aligned,
- identify which prototype elements are visual-only and which require a real
  backend contract before production,
- review a UI PR for surface consistency without re-reading the full project
  history.

## Decision

The Region Manager incentives command-center prototype is now the canonical
Store/Admin operational surface reference.

This does not mean every page becomes an incentives page. It means future
Store/Admin prototypes should use the same surface discipline:

- compact, premium, operational layout,
- calm typography with controlled font weights,
- small meaningful lucide icons,
- restrained metric cards,
- shadcn-first controls,
- product copy instead of implementation copy,
- desktop and mobile parity,
- production-bound component mapping from the start.

## Surface Shape

Use this default structure for new Store/Admin prototypes unless the product
workflow clearly needs another shape:

1. Product shell and role-aware navigation.
2. Compact top context row when useful.
3. Page header with title, short useful subtitle, and one primary action group.
4. Optional decision band for high-value command pages.
5. Metric strip with two to four data-backed cards.
6. Compact filter toolbar.
7. Main list, table, accordion, or workbench.
8. Detail/edit drawer or sheet.
9. Confirmation dialog for package or submit actions.
10. Reference table only when it helps the user verify a rule.

Avoid:

- marketing hero layouts,
- oversized decorative cards,
- heavy headings inside dense panels,
- long explanatory paragraphs,
- separate visual languages per route,
- prototype-only copy that cannot be carried into production.

## Visual Contract

Typography:

- Page title is strong but not oversized.
- Metric values are prominent; metric labels and notes stay lighter.
- Section headings are compact.
- Table and drawer labels are scannable, not bold everywhere.
- Do not use page-specific font-weight inflation to make the page feel premium.

Metric cards:

- Every metric card has exactly one meaningful lucide icon.
- Icon is small, centered, and tied to the metric meaning.
- The value is the strongest element.
- Notes are short and decision-oriented.
- Metric cards do not become decorative tiles or second status badges.

Color:

- Use semantic intent: primary/plum, accent/cyan, success, warning, danger,
  neutral.
- Store Command / Plum Glacier energy is allowed, but it must be controlled.
- Do not create route-local palettes, raw hex recipes, or one-off badge colors.

Density:

- Operational pages should feel rich because the data hierarchy is clear, not
  because the page has extra decoration.
- First viewport should show the user's next decision.
- Mobile must preserve the same decision hierarchy without horizontal scroll.

## Component Contract

Production uses project shadcn components and Store/Admin primitives. A
standalone HTML prototype is acceptable only when every visible control has a
known production component mapping.

Default mappings:

| Surface need | Production component direction |
| --- | --- |
| Primary and secondary actions | `Button` variants |
| Status | `Badge` |
| Metric strip | Store/Admin metric primitive plus lucide icon |
| Dropdown filter | `Select` with trigger, value, content, group, and item |
| Month/year period | Popover or explicit month/year control; no raw period number |
| Search | `Input` or input-group composition |
| Main data | `Table`, accordion/collapsible, or Store/Admin list primitive |
| Detail edit | `Sheet` or `Drawer` |
| Confirm submit | `Dialog` or `AlertDialog` |
| Progress | `Progress` |
| Boolean review state | `Checkbox` or button/checkbox composition with persisted state |

Do not build custom production controls that only imitate shadcn components.
If a component looks wrong, fix the primitive or token contract instead of
patching one page.

## Copy And Data Contract

Prototype copy is a production contract unless explicitly marked as
prototype-only.

Use product language:

- `Primler`
- `Dönem`
- `Dönem gönderimi`
- `Kontrol edilmeli`
- `Kontrol edildi`
- `Kontrol bekleyen mağaza`
- `Düzeltme yapılan kayıt`
- `Onaya gönder`
- `Kontrole dön`
- `Final prim tutarı`
- `Hedef gerçekleşme`

Avoid user-facing implementation language:

- route, auth, scope, provider, contract, token,
- API, DB, OpenAPI, queue, Redis,
- mock, staging, evidence,
- "gerçek veri", "güvenli veri kaynağı", "kayıt temsil eder",
- pagination or data-source prose in section descriptions.

No inside/outside mismatch:

- The prototype title, filters, statuses, empty/error language, drawer labels,
  and confirmation text should be the same language production uses.
- If production needs different copy because of role, permission, missing data,
  or backend contract, record the deviation before implementation is called
  complete.
- Do not approve a prototype with polished copy and then ship a production page
  with debug, source, scope, or placeholder copy.

## Incentives Reference Contract

For Region Manager incentives, the approved behavior is:

- Region Manager reviews store incentive outcomes by period.
- Store review and incentive correction are separate states.
- A store can be marked `Kontrol edildi` even when no correction is made.
- `Kontrol edildi` is persisted immediately; it is not local UI state.
- Period submission is package-level, not store-by-store approval.
- If stores remain unchecked, submit confirmation shows `Kontrol tamamlanmadı`.
- When all stores are checked, the period package can be sent to admin review.
- Store Manager view is not an approval workflow; it shows earned incentives.
- Dealer and franchise stores do not see incentives.

Production needs real model/API support for:

- store-period review status,
- reviewer user,
- review timestamp,
- correction drafts and notes,
- period package submission,
- admin review status.

Until that contract exists, the prototype behavior must not be claimed as
production-complete.

## Standardization Process

Use this process whenever a Store/Admin prototype is requested.

1. Read the target route, current component, model/API shape, and role behavior.
2. Choose the page recipe from the UI surface recipes.
3. Use the canonical Store/Admin surface reference for density, typography,
   metrics, icons, toolbar, drawer, status, and mobile rhythm.
4. Write a component map before building the prototype.
5. Keep prototype copy production-ready.
6. Mark any missing backend/model field as contract-discovery, not as fake UI.
7. Build the prototype with shadcn-equivalent controls or a real React/shadcn
   slice.
8. Verify desktop and mobile overflow.
9. When approved, promote the prototype as an implementation contract.
10. During production, map every visible value and action to real data.
11. Preserve role/scope/permission behavior.
12. Record intentional deviations with production reasons.

## Acceptance Check

A Store/Admin surface is standard-compliant only when:

- the page matches the approved operational surface rhythm,
- controls are shadcn or shared primitives,
- native select is absent from product toolbar filters,
- metric cards include one meaningful lucide icon each,
- product copy has no internal implementation terms,
- prototype and production labels/statuses match,
- every visible metric/status/action has a real data source or a documented
  future contract,
- mobile has no horizontal scroll,
- detail and submit flows use drawer/sheet/dialog patterns,
- old UI skeletons, route-specific palettes, and debug copy are removed.
