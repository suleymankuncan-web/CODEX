# UI Surface Standard V1

Reader:

- an engineer, designer, product owner, or future agent creating or refactoring
  HR Axis / Store Ops Store/Admin product UI.

After reading, they should be able to:

- choose the right shadcn component before writing custom UI,
- keep every page in the same visual/product family,
- avoid internal implementation copy on user screens,
- keep lucide icons useful rather than decorative,
- verify that a page refactor is standard-compliant before PR.

## Scope

This standard applies to:

- Store and Admin product pages,
- prototype-to-product implementation,
- user-facing modals, drawers, filters, forms, tables, dashboards, and toolbars,
- UI primitives or route-level surface foundations,
- visual QA for approved prototypes.

It does not change business workflow, API shape, DB schema, auth/permission,
scoring, queue/import lifecycle, provider configuration, or production rollout
posture by itself.

## Authority

Use this order when standards appear to overlap:

1. Business/auth/API/DB/workflow contract.
2. `discipline.md` and `docs/process/product-experience-principles.md`.
3. This UI Surface Standard.
4. Project shadcn components and Tailwind v4 tokens.
5. Taste-skill / Resend design-system discipline as quality references.

Resend/design-skills is a design-system discipline reference, not a brand copy
source. Borrow semantic token, component catalog, composition, and audit
thinking; do not copy Resend visuals wholesale.

## Operating Stack

Production Store/Admin UI uses:

- shadcn/ui source components under `admin-web/src/components/ui`,
- Tailwind v4 with the project `tw:` prefix,
- semantic tokens instead of raw color values,
- lucide icons only where icons help recognition or scan speed,
- shared Admin/Store surface primitives where the page belongs to those shells,
- taste-skill as an anti-slop pass, not as permission to override product
  contracts.

## Component Selection

Before adding or refactoring any user-facing control:

1. Check whether an existing shadcn component covers the need.
2. If yes, use the component and its built-in variants/sizes.
3. If one component is not enough, compose shadcn primitives.
4. If the needed primitive is not installed, plan a small setup slice.
5. Write custom markup/CSS only after a shadcn component or composition is not a
   fit, and explain why in the PR.

Common mappings:

| Need | Standard component |
| --- | --- |
| Action | `Button`, icon-button pattern, `DropdownMenu` for overflow |
| Date filter | `Calendar` / date picker composition |
| Date range | `Calendar mode="range"` in `Popover`, `Sheet`, or `Drawer` |
| Month/year period | explicit month/year controls, not raw `202605` input |
| Form | `Field`, `Input`, `InputGroup`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`, `InputOTP` |
| 2-7 choices | `ToggleGroup` |
| View sections | `Tabs` |
| Status | `Badge` |
| Page/section message | `Alert` |
| Toast | `sonner` |
| Loading | `Skeleton` or `Spinner` |
| Empty state | `Empty` or a shared empty-state primitive |
| Data | `Table`, `Card`, `Avatar`, `Progress`, `Chart` when useful |
| Overlay | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `Popover`, `Tooltip`, `HoverCard` |
| Navigation | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination` |

`className` on shadcn components is for layout and small composition. Do not
override component color, typography, radius, or shadow page by page.

## Button Standard

All production actions should use the project shadcn `Button` unless a real
native-button exception is documented.

Variant meaning:

| Variant | Use |
| --- | --- |
| `default` | Primary action, usually one per section or command cluster |
| `outline` | Secondary action |
| `secondary` | Selected/active low-emphasis filled state |
| `ghost` | Low-emphasis row, toolbar, or icon-adjacent action |
| `destructive` | Destructive or risky action |
| `link` | Text-link affordance only |

Avoid:

- raw `<button>` elements,
- `control-button` and old route-specific button classes,
- `Button className="tw:bg-[#...]"` color overrides,
- page-local button palettes.

If a button looks wrong, fix the token or `Button` variant contract instead of
patching the page.

## Icon Standard

Lucide is the single icon language when icons are needed. It is not a rule to
add icons everywhere.

Good icon use:

- sidebar navigation,
- icon-only buttons with accessible labels/tooltips,
- recognizable actions such as search, calendar/date, filter, export, refresh,
  upload, download, edit, delete, close, and external link,
- one supporting icon in alert, empty, error, success, or loading states,
- dense table/action-menu contexts where text would be too wide.

Avoid:

- icons on every card heading,
- decorative large icon boxes in metric cards,
- icons in every table cell or every status badge,
- icons on buttons where the text is already clear,
- repeating the same signal with both icon and badge color,
- using icons to make a sparse page look fuller.

Decision rule: if the icon does not make the action faster to recognize or the
state easier to scan, leave it out.

## Page Anatomy

Store/Admin pages should feel like one product family. Prefer this anatomy:

1. Product shell and role-aware navigation.
2. Compact page header with clear title and optional useful subtitle.
3. Necessary status/filter row.
4. Summary metrics only when data-backed and decision-relevant.
5. Main table/list/form/workbench.
6. Clear loading, empty, error, access, and recovery states.
7. Detail drawer/dialog only when evidence or action controls need focus.

Avoid operational hero pages, nested cards, oversized headings, decorative
gradients, repeated summary cards, and filler explanation blocks.

## Token And Color Standard

Use semantic color by intent:

- primary/plum: main action and brand emphasis,
- accent/cyan: special highlight,
- info/blue: links and informational affordance,
- success/warning/danger: state,
- neutral: surfaces, text, and borders.

Do not introduce route-specific color recipes or hard-coded TSX colors such as:

- `tw:bg-[#...]`,
- `tw:text-[#...]`,
- `tw:border-[#...]`,
- Tailwind default palette shortcuts used as product colors.

Route-specific CSS may handle layout or complex responsive structure; it must
not invent a parallel button, badge, card, or status color language.

## Product Copy Standard

User-facing copy must sound like product language, not implementation notes,
evidence, or debug commentary.

UI copy is allowed only when it:

1. names what the user is looking at,
2. helps the user decide what matters,
3. makes the next action or recovery path clear.

Avoid implementation/evidence language on product screens:

- "Her satir ... kaydini temsil eder"
- "Gercek veri"
- "Guvenli veri kaynagi"
- "Oturumdaki yetkili ..."
- "Sayfa basina en fazla ..."
- "... disi kayitlar burada gorunmez"
- "Kaynak gerekli"
- "Henuz veri kaynagi yok"
- "Liste ... kaynagindan okunur"
- "Mock", "staging", "API", "DB", "scope", "permission", "contract",
  "evidence", "provider", "token", "route", or similar internal terms.

Rewrite system explanations into user outcomes:

| Avoid | Prefer |
| --- | --- |
| Her satir bolge mudurune tanimli bir magazadir. Magaza disi kayitlar burada gorunmez. | Sorumlu oldugunuz magazalar. |
| Her satir gercek bir talep kaydini temsil eder; liste sayfa basina en fazla 15 kayit gosterir. | Bolgenizdeki talepler ve onay durumlari. |
| Guvenli veri kaynagi henuz yok. | Veri bulunamadi. |
| Magazaya git yok. | Aksiyon yok. |
| Oturumdaki yetkili magaza listesinden okunur; yetkisiz magaza gosterilmez. | Sorumlu magazalariniz listelenir. |

Microcopy rules:

- A subtitle under a section heading is optional. Remove it if it repeats the
  heading, explains system plumbing, or does not help a decision.
- Table helper text describes business meaning, not the data model or
  pagination mechanics.
- Pagination details belong in table footer controls, e.g. `1-15 / 42 kayit`,
  not in prose.
- Empty state copy says what is missing and what the user can do next. It does
  not mention missing backend sources or internal safety checks.
- Permission and security behavior is expressed as a user outcome, not as
  scope/auth wording.
- Keep copy short, Turkish, concrete, and free of placeholder/filler phrases.

## Prototype To Product

Approved prototypes are implementation contracts for the scoped surface.

When moving prototype to product:

- preserve layout, palette, density, row/card rhythm, status tones, modal/drawer
  model, labels, and interaction flow,
- remove demo-only controls such as role switchers or fake helpers,
- map every visible value and action to real API/model/config/state data,
- preserve role/scope/permission behavior,
- record every intentional visual deviation with a production reason.

A standalone HTML prototype is not production-ready if it relies on separate
hard-coded styling instead of the same component/token logic expected in
production.

## Done Criteria

A UI surface refactor is done only when:

- shadcn-eligible controls use shadcn components or have an explicit exception,
- buttons, badges, inputs, overlays, date controls, empty/loading/error states,
  and toolbars follow this standard,
- icon use is intentional and restrained,
- section titles, helper text, empty states, badges, and buttons use product
  language,
- raw hex and route-local styling are absent from changed production UI unless
  explicitly justified,
- desktop/mobile states are checked when layout-sensitive,
- old UI remnants are removed or explicitly parked,
- the PR states what did not change.
