# UI Surface Recipes V1

Reader:

- an engineer, designer, product owner, or future agent applying
  `docs/process/ui-surface-standard-v1.md` to a concrete Store/Admin page.

This document turns the standard into repeatable page recipes. It is not a new
visual theme and does not change product workflow, API shape, DB schema, auth,
permission, scoring, import, queue, or provider behavior.

## Recipe Selection

Before creating page-local markup, choose the closest recipe:

| Need | Recipe |
| --- | --- |
| Premium Store/Admin operation page | Operational command surface |
| Date filter | Date filter |
| Month/year period | Period filter |
| Table controls | Table toolbar |
| Main records table | Data table |
| Drill-in or audit view | Detail drawer |
| Confirm or submit action | Action dialog |
| Empty result | Empty state |
| Load failure | Error state |
| KPI or count summary | Metric strip |
| Export or secondary commands | Command group |

If no recipe fits, still start from shadcn primitives and semantic tokens.

## Operational Command Surface

Use this recipe for dense Store/Admin pages where the user reviews a period,
store set, person set, or approval package before acting.

Page order:

1. Compact page header with one clear title and useful subtitle.
2. Primary command group on the right.
3. Optional decision band for total amount, period state, or package state.
4. Two to four metric cards.
5. Toolbar with period, search, and status filters.
6. Main accordion/table/list area.
7. Drawer or sheet for detail/edit.
8. Dialog for package submit or blocking confirmation.
9. Reference table only when it helps verify a rule.

Surface rules:

- Keep font weights calm. Do not make every label bold.
- Metric cards use one small meaningful lucide icon.
- Statuses use `Badge`; repeated action buttons are avoided.
- Clickable object names open detail/edit when possible.
- A boolean review state, such as `Kontrol edildi`, is separate from
  correction or approval state.
- The submit action is package-level when the workflow is package-level.
- If required review is incomplete, confirmation explains what remains.
- Mobile turns the main rows into readable cards without horizontal scroll.

Product copy examples:

- `Kontrol edilmeli`
- `Kontrol edildi`
- `Kontrol bekleyen mağaza`
- `Dönem gönderimi`
- `Kontrol tamamlanmadı`
- `Onaya gönder`
- `Kontrole dön`

## Date Filter

Use shadcn `Button`, `Popover`, and `Calendar`.

- Use `Calendar` for one date.
- Use `Calendar mode="range"` for a range.
- Show the selected date or range in the trigger button.
- Keep quick choices, if needed, as `ToggleGroup` or compact `Button` variants.
- Do not use raw date text inputs unless the workflow specifically needs typed
  entry.
- Do not use raw period numbers such as `202605` as the primary UI.

Product copy:

- `Tarih`
- `Tarih araligi`
- `Bugun`
- `Bu ay`
- `Uygula`
- `Temizle`

## Period Filter

Use explicit month and year controls for monthly Store/Admin data.

- Month is a Turkish month label.
- Year is a visible four-digit year.
- Keep previous periods selectable when data exists.
- Show the active period near the table or summary.
- If export uses the same period, place export in the same toolbar.

Product copy:

- `Donem`
- `Ay`
- `Yil`
- `Haziran 2026`
- `Excel indir`

## Table Toolbar

Use a compact toolbar above the table.

Standard order:

1. Search, if useful.
2. Primary filter.
3. Secondary filter.
4. Period/date filter.
5. Export or refresh.

Use shadcn `Input`, `Select`, `Button`, `DropdownMenu`, `Popover`, and
`Calendar` as needed. Single-choice toolbar filters such as `Durum`, `Rol`,
`Mağaza türü`, and `Onay durumu` use shadcn `Select`, not native `<select>`.

Avoid explanatory text such as row count prose or data-source notes. Put counts
in the table footer: `1-15 / 42 kayit`.

## Data Table

Use `Table` or the existing shared table primitive.

- Header labels are short nouns.
- Row actions are right aligned.
- Prefer an action menu when there are more than two row actions.
- Use `Badge` for status, not page-local pill classes.
- Use one row height rhythm per page.
- Do not put long helper paragraphs above the table.

Common columns:

| Data | Column label |
| --- | --- |
| Store | `Magaza` |
| Personnel | `Personel` |
| Region manager | `Bolge muduru` |
| Status | `Durum` |
| Period | `Donem` |
| Amount | `Tutar` |
| Action | `Aksiyon` |

## Detail Drawer

Use `Sheet` or `Drawer` for drill-in details that keep page context.

- Drawer title names the object.
- Top row contains the most important status and identifiers.
- Detail content uses grouped sections with short labels.
- Footer contains one primary action and secondary close/cancel action if
  needed.
- Do not repeat the whole page header inside the drawer.

Use a dialog instead when the user must make a focused decision before
continuing.

## Action Dialog

Use `Dialog` for forms and non-destructive decisions. Use `AlertDialog` for
destructive or irreversible decisions.

- Title states the action.
- Description explains user impact in one short sentence.
- Form fields use shadcn form/input primitives.
- Primary action uses `Button variant="default"`.
- Cancel uses `Button variant="outline"` or `ghost`.
- Disable submit while saving.
- Show validation near the field, not as a long paragraph.

## Empty State

Use `Empty` or a shared empty-state primitive.

Empty copy should answer:

1. What is missing?
2. What can the user do?

Good examples:

- `Bu donem icin kayit yok.`
- `Filtreleri degistirerek tekrar deneyin.`
- `Onaya gonderilmis prim bulunmuyor.`

Avoid:

- backend/source/provider explanations,
- internal access or scope wording,
- fake metric placeholders.

## Error State

Use `Alert` for inline errors and a retry `Button` when recovery is available.

Error copy:

- `Veri alinamadi.`
- `Tekrar dene`
- `Daha sonra tekrar deneyin.`

Do not expose raw API, DB, provider, token, route, or stack details on product
screens. Developer details belong in logs, diagnostics, or evidence files.

## Metric Strip

Use a compact row of 2-4 data-backed metrics only when they help a decision.

Each metric includes:

- one meaningful lucide icon,
- label,
- value,
- optional trend/status,
- optional scope label if business-relevant.

The icon is mandatory for every prototype and production metric card. Keep it
small, token-colored, and tied to the metric meaning.

Avoid decorative metric cards, oversized icon boxes, and repeated status-like
icons. If the metric does not change the user's next decision, remove it.

## Command Group

Group page commands by priority:

- one primary action,
- secondary actions as `outline`,
- low-emphasis table or toolbar actions as `ghost`,
- overflow actions in `DropdownMenu`.

Use lucide icons only for metric cards and fast recognition: export, refresh,
filter, calendar, search, edit, delete, close, upload, download. Do not add
icons just to fill space.

## Prototype To Product Checklist

Before product implementation:

- target route, component, and data contract are known,
- role and scope behavior is unchanged,
- controls map to shadcn or shared primitives,
- colors use semantic tokens,
- raw `tw:bg-[#...]`, `tw:text-[#...]`, and `tw:border-[#...]` are absent from
  changed production UI unless explicitly parked,
- product copy avoids implementation/evidence language,
- loading, empty, error, access, and mobile states are accounted for,
- old route-specific classes and old page skeleton residue are removed or
  explicitly parked,
- PR states `Contract Impact`.

## Action Feedback Checklist

Before closing a Store/Admin mutation or export UI change:

- every explicit mutation has one success feedback path,
- every explicit mutation has one error feedback path,
- action feedback uses `actionToast`,
- pages and feature components do not import `sonner` directly,
- no page-local `Toaster` is introduced,
- passive load, refresh, navigation, tab changes, filter changes, and autosave
  do not fire toasts,
- inline load failures remain inline,
- undoable actions keep one recovery affordance,
- no duplicate inline success banner and toast appear for the same action,
- drawer, sheet, sticky footer, and Pilot Feedback overlap are checked when
  relevant,
- toast copy uses correct Turkish characters and stays short.

## Review Prompt

Use this when reviewing a Store/Admin page refactor:

```text
Check this UI against docs/process/ui-surface-standard-v1.md and
docs/process/ui-surface-recipes-v1.md. Focus on shadcn component selection,
semantic tokens, restrained lucide icon usage, product copy, page anatomy,
loading/empty/error/access states, mobile overflow, and old UI residue.
Do not suggest workflow, API, auth, DB, scoring, queue, or provider changes
unless the diff explicitly touches that contract.
```
