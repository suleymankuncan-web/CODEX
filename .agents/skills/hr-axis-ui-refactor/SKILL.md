---
name: hr-axis-ui-refactor
description: Guides HR Axis / Store Ops user-facing UI refactors. Use when changing login, page shells, hero cards, old UI remnants, Plum Glacier styling, loading states, or visual QA for this project.
---

<objective>
Keep HR Axis / Store Ops UI refactors calm, product-facing, and visually consistent. This skill applies the project-specific UI discipline without re-deriving it from the long conversation.

It is for user-facing surfaces only. It does not change business workflow, auth semantics, API shapes, database schema, or provider configuration unless the user explicitly asks for that separate scope.
</objective>

<quick_start>
Before editing:

1. Read `current-state.md`.
2. Read the UI/UX section of `discipline.md`.
3. For every HR Axis Store/Admin prototype, read and apply
   `.agents/skills/hr-axis-prototype-standard/SKILL.md` and all references it
   requires. If Plum Glacier production mapping is relevant, also read
   `docs/prototypes/plum-glacier-token-set-v1.md`.
4. For production Store/Admin page work that touches route structure, Admin
   CRUD/workbench behavior, or large TSX files, read
   `docs/process/frontend-feature-and-admin-architecture-v1.md`.
5. Inspect the target component and CSS before proposing or patching.
6. State the exact surface, what will not change, and the verification gate.
</quick_start>

<workflow>
1. **Classify the slice.** Decide whether the request is free-design prototype,
   production UI, visual bugfix, or theme/token cleanup.

   Free-design prototype mode is the default when the user is still exploring
   visual direction. Production primitives, shadcn/ui, Tailwind `tw:` utility
   mapping, component maps, and production parity rules are OFF, but the
   canonical `hr-axis-prototype-standard` visual/interaction grammar is ON.
   Do not force production architecture into the creative pass. First make the
   best visual/product prototype within the HR Axis family; translate it later
   only after the user approves the direction.

2. **Audit old-surface remnants.** Search the target surface for hero cards, metric-card filler, nested cards, long explanatory copy, debug/dev actions, internal architecture words, stale brand marks, old foundation colors, and mobile bottom/overflow artifacts.

3. **Protect user-facing language.** Remove or translate internal terms such as route, auth, scope, provider, contract, token, evidence, mock, staging, API, DB, OpenAPI, queue, and Redis from product screens. Keep such wording only in docs, evidence, or developer tooling.

4. **Use the project shell.** Prefer small headings, necessary status/filter rows, one clear primary action, and the main table/list/form. Avoid landing-page hero composition for admin or store work surfaces.

5. **Keep route and feature ownership clear.** For production Store/Admin
   refactors, keep route files orchestration-first. Move API wrappers,
   query-key helpers, view-model mapping, formatting, table/list columns,
   drawer internals, and feature-only UI into the owning feature folder. Admin
   pages should behave like operational list/detail/edit workbenches, not
   dashboards.

6. **Keep tokens coherent.** When using Plum Glacier, avoid mixing the old cream/teal foundation look into the redesigned surface. Treat the token set as active for login and future refactor pilots, not as permission for a broad global rewrite.

7. **Verify visually and mechanically.** Run the smallest relevant lint/build/test gate. For layout-sensitive work, check desktop and mobile viewports and refresh/loading states. Search the changed files for removed old classes or internal copy when that was part of the ask.

   **Approved prototype parity is not optional.** If the user has approved a
   prototype and asks to implement/move it into a page, the production page must
   show that prototype, not a similar adaptation. Treat "birebir", "tam
   implement", "sayfaya gecir", and equivalent wording as: reproduce the
   approved layout, density, color rhythm, spacing, typography, card/table row
   rhythm, icon treatment, status tones, copy, drawer/modal model, and
   interaction flow in the target route. Functional correctness alone is not
   completion.

8. **Report the root cause.** If fixing a visual remnant, name whether it came from asset markup, CSS, fallback/loading state, global background, route transition, or stale shell structure.
</workflow>

<design_system_stack>
HR Axis UI work has two separate modes:

- **Free-design prototype mode.** No production component stack is mandatory.
  Apply `hr-axis-prototype-standard` for typography, color, density,
  interaction, responsive behavior, and role hierarchy. Use whatever isolated
  HTML/CSS/React composition best exposes the desired workflow while staying in
  that product family. Keep the prototype isolated from production routes.
- **Production translation mode.** After the user approves a prototype and asks
  to ship it, map the accepted surface into the production codebase. In that
  phase, project components, tokens, accessibility, role/scope, API contracts,
  and maintainability matter again, but they must not distort the approved
  visual surface without an explicit reason.
- **HR Axis refactor rules are the authority.** Business workflow, role/scope,
  auth, API, DB, scoring, queue, and provider behavior stay unchanged unless
  explicitly scoped.
- **Taste-skill is the anti-slop quality pass.** It checks density, hierarchy,
  copy, mobile fit, and whether the surface feels premium without decoration.
- **Resend/design-skills is a discipline reference, not a brand copy source.**
  Borrow the semantic token, component catalog, pattern, and audit mindset; do
  not copy Resend brand visuals wholesale into HR Axis.
</design_system_stack>

<component_selection_standard>
This section applies only to production translation and direct production UI
work. It does not apply to free-design prototypes.

Before building or refactoring a production user-facing UI element, run this
selection order:

1. Check whether an existing shadcn/ui component covers the need.
2. If yes, use the component and its built-in variants/sizes.
3. If one component is not enough, compose shadcn primitives.
4. If the needed primitive is not installed, consider a small setup slice using
   the project's shadcn CLI discipline.
5. Only write custom markup/CSS after a shadcn component or composition is not a
   fit, and document why.

Do not build local ad hoc versions of controls that shadcn already provides.
Common mappings:

- Action: `Button`, `IconButton` pattern, or `DropdownMenu` for overflow.
- Date filter: `Calendar` / date picker composition; range uses
  `mode="range"`; month/year period uses explicit month/year selection, not a
  raw numeric input like `202605`.
- Form: `Field`, `Input`, `InputGroup`, `Textarea`, `Select`, `Checkbox`,
  `Switch`, `RadioGroup`, `Slider`, or `InputOTP`.
- Dropdown filter: `Select` with `SelectTrigger`, `SelectValue`,
  `SelectContent`, `SelectGroup`, and `SelectItem`. Native `<select>` is
  allowed only for an explicitly documented browser-native exception.
- Option set: `ToggleGroup` for 2-7 choices; `Tabs` for view sections.
- Status: `Badge`; page/section message: `Alert`; toast: `sonner`.
- Loading: `Skeleton` or `Spinner`; empty state: `Empty`.
- Data: `Table`, `Card`, `Avatar`, `Progress`, `Chart` where appropriate.
- Overlay: `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `Popover`,
  `Tooltip`, or `HoverCard`.
- Navigation: `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`,
  `Pagination`.

`className` on shadcn components is for layout and small composition only. Do
not override component color, typography, radius, or shadow page-by-page.
</component_selection_standard>

<action_feedback_standard>
Production Store/Admin pages use one global HR Axis action feedback layer.

Rules:

- Use `actionToast` from `admin-web/src/lib/action-toast.ts` for user-triggered
  mutation results.
- Do not import `sonner` directly from pages or feature components. Direct
  Sonner imports belong only in the project wrapper/helper files.
- Do not create page-local `Toaster` instances, custom toast systems, or
  duplicate success/error banners for the same action.
- Show toast only after explicit user actions such as save, submit, approve,
  return, import, export, retry, pin, unpin, archive, complete, or resolve.
- Do not toast passive page load, passive refresh, navigation, tab/filter
  changes, autosave field edits, or readonly browsing.
- Keep page-level load failures as stable inline error states with retry when
  recovery is available. A broken page should not rely on a disappearing toast.
- Keep undoable actions recoverable. Use a Sonner action or retain the existing
  inline undo affordance, but do not show both for the same action.
- Keep copy short, Turkish, and action-specific: `Kaydedildi`,
  `Düzeltme kaydedildi`, `Kontrol edildi`, `Onaya gönderildi`, `Onaylandı`,
  `İade edildi`, `Excel indirildi`.
- Error toasts use the existing user-facing error mapper and a short Turkish
  fallback. Do not expose raw API, DB, route, token, UUID, stack, or provider
  details.
- Verify desktop and mobile placement. Toast must not block right drawer/sheet
  footers, sticky action bars, or the floating Pilot Feedback control.

Before closing a PR that changes action feedback, run or document:

- direct Sonner import search,
- duplicate local notice search on migrated pages,
- one relevant mutation success path,
- one relevant mutation error path when practical,
- drawer/mobile overlap check when a Sheet or Drawer can be open.
</action_feedback_standard>

<prototype_gate>
Store/Admin prototyping is now two-phase.

1. **Free-design prototype first when exploring.** If the user asks for a
   prototype, visual direction, or "let's try", build the strongest isolated
   visual prototype without production stack constraints. Apply the canonical
   `hr-axis-prototype-standard`; no production component map is required before
   the first visual pass.
2. **Taste pass still applies.** The prototype must avoid generic dashboard
   slop, unclear hierarchy, bad copy, decorative filler, mobile overflow, and
   incoherent spacing. This is a visual/product quality gate, not a component
   gate.
3. **Production translation happens later.** Only after the user approves the
   free-design prototype and explicitly asks to implement it, produce a mapping
   from the accepted visual surface to production components, CSS, data fields,
   and workflow states.
4. **Do not silently downgrade approved visuals.** If production primitives,
   route shell, shadcn defaults, or existing CSS would materially change the
   accepted surface, create or adjust the implementation layer rather than
   forcing the prototype into old primitives.
5. **Canonical grammar is mandatory, workflow cloning is forbidden.** Command
   Canvas fixes the HR Axis typography, color, density, interaction, responsive,
   and role-hierarchy quality bar. Region Manager incentives and Store KPIs may
   inform their own workflows, but no reference forces unrelated page content.
</prototype_gate>

<shadcn_lab_reference>
Use the external shadcn lab at `D:\hr-axis-shadcn-lab` only during production
translation or direct production UI work when a needed shadcn component is not
installed in HR Axis yet.

The lab contains the full upstream shadcn component catalog and builds
independently from the production repo. It is a reference for component APIs,
composition, required providers, and interaction patterns.

Important boundaries:

- Do not import production code from the lab.
- Do not copy lab files blindly into HR Axis.
- HR Axis production components live under
  `D:\store-ops-workspace\admin-web\src\components\ui`.
- HR Axis uses Tailwind prefix `tw:`; the lab uses upstream classes without the
  prefix. Convert through the project shadcn CLI/component discipline when
  promoting a component.
- Prefer the HR Axis component when it already exists; use the lab to inspect
  missing primitives or correct composition.
</shadcn_lab_reference>

<button_standard>
This section is production-only. Free-design prototypes may use custom buttons
and interaction styling.

Production actions should use the project shadcn `Button` component unless a
real native button exception is documented.

Default meaning:

- `default`: primary action, usually one per section or command cluster.
- `outline`: secondary action.
- `secondary`: selected/active low-emphasis filled state.
- `ghost`: low-emphasis row, toolbar, or icon-adjacent action.
- `destructive`: destructive or risky action.
- `link`: text-link affordance only.

Avoid raw `<button>` elements, legacy `control-button` classes, route-specific
button classes, and `Button className="tw:bg-[#...]"` color overrides. If an
action looks wrong, fix the token or `Button` variant contract instead of
patching the page.

Buttons do not get icons automatically. Add a lucide icon only when it improves
recognition, scan speed, or space efficiency. When used inside `Button`, icons
must follow shadcn's `data-icon="inline-start"` / `data-icon="inline-end"`
pattern and component sizing rules.
</button_standard>

<icon_standard>
Lucide icon use is deliberately restrained.

Good icon use:

- Sidebar navigation and compact route affordances.
- Icon-only buttons with accessible labels/tooltips.
- Recognizable actions such as search, calendar/date, filter, export, refresh,
  upload, download, edit, delete, close, and external link.
- One restrained icon in a metric card or metric strip item only when it
  improves scan speed or the accepted design includes it.
- A single supporting icon in alert, empty, error, success, or loading states.
- Dense table/action-menu contexts where text would be too wide.

Avoid:

- Adding icons to every card heading.
- Decorative or oversized metric-card icon boxes.
- Icons in every table cell or every status badge.
- Icons on buttons where the text is already fully clear.
- Repeating the same semantic signal with both icon and badge color.
- Using icons to make a sparse page look fuller.

Metric-card rule for production translation: use a meaningful icon only when it
improves scan speed or the accepted prototype includes that visual language. It
is not mandatory in free-design prototypes.

Decision rule: if the icon does not make the action faster to recognize or the
state easier to scan, leave it out.
</icon_standard>

<page_and_token_consistency>
Every new or refactored Store/Admin surface should feel like one product family.

- Use a shared page anatomy: page shell, compact page header, necessary
  status/filter row, summary metrics only when data-backed and carrying one
  meaningful metric treatment when useful, main table/list/form, and clear
  loading/empty/error/access states.
- Keep typography calm: no page-specific font-weight inflation, oversized hero
  type, negative tracking, or inconsistent heading rhythm.
- Keep color semantic: primary/plum for main action, accent/cyan for special
  highlight, info/blue for links and informational affordances, success/warning/
  danger for state, neutral for surfaces/text/borders.
- Route-specific CSS may handle layout or complex responsive structure, but not
  invent a parallel color/button/badge/card language.
- Approved free-design prototypes do not need to be created from production
  components. When moving to production, preserve the accepted visual surface
  first, then decide whether to use existing components, new primitives, or
  scoped CSS.
</page_and_token_consistency>

<product_copy_standard>
User-facing copy must sound like a product, not implementation notes, evidence,
or debug commentary.

UI copy is allowed only when it does at least one of these:

1. Names what the user is looking at.
2. Helps the user decide what matters.
3. Makes the next action or recovery path clear.

Avoid implementation/evidence language on product screens, including:

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

- Bad: "Her satir bolge mudurune tanimli bir magazadir. Magaza disi kayitlar
  burada gorunmez."
  Good: "Sorumlu oldugunuz magazalar."
- Bad: "Her satir gercek bir talep kaydini temsil eder; liste sayfa basina en
  fazla 15 kayit gosterir."
  Good: "Bolgenizdeki talepler ve onay durumlari."
- Bad: "Guvenli veri kaynagi henuz yok."
  Good: "Veri bulunamadi."
- Bad: "Magazaya git yok."
  Good: "Aksiyon yok."
- Bad: "Oturumdaki yetkili magaza listesinden okunur; yetkisiz magaza
  gosterilmez."
  Good: "Sorumlu magazalariniz listelenir."

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
  scope/auth wording. Use "Bu islem icin yetkiniz yok" instead of explaining
  scope/session/provider details.
- Keep copy short, Turkish, concrete, and free of placeholder/filler phrases.
</product_copy_standard>

<store_ui_principles>
Use these principles for Store Ops redesigns, especially `/store/*` surfaces:

- **Data before decoration.** A redesign is not complete if the page only looks better. KPI values, coaching/to-do copy, ranking, status, trend, and score breakdown must come from real data, existing config, or an explicit empty/fallback state.
- **No forced stack during exploration.** Free-design prototypes do not have a
  mandatory shadcn/Tailwind/lucide/Store primitive stack. Production Store
  redesigns may use those tools when they preserve the approved design and make
  implementation safer.
- **Role-fit is part of UI quality.** Toolbars, actions, links, and page modules must match the resolved user role. Do not show pages or actions that are not assigned to the active Store role.
- **Use existing pages as evidence, not a cage.** Store/me, Store KPIs, and
  incentives can show what has worked, but they must not force every new surface
  into the same structure.
- **Keep operational screens compact.** Remove long explanatory copy, oversized cards, filler pools of information, and duplicated labels. Prefer scannable cards, concise status rows, clear tables/lists, and one obvious next action.
- **Aim for clean and premium.** Store screens should feel modern, polished, and a little distinctive, not like a generic admin table. Use strong hierarchy, calm spacing, crisp alignment, refined iconography, and restrained visual effects to create a premium feel without sacrificing operational clarity.
- **Design mobile first for dense data.** Charts and trend sections must remain understandable on mobile. Use compact ranges, checkpoints, summaries, and responsive layout rather than large desktop-first graph blocks.
- **Do not confuse premium with decorative.** Visual energy is welcome, but not at the cost of fake data, ornamental filler, hidden workflows, excessive animation, or cards that exist only to look impressive. Every visible module must help the user understand status or act.
- **Make added metrics deliberate.** Store/Bolge/Turkiye rankings, KPI percentages, score points, and target progress must have clear hierarchy and alignment. Do not append them as loose badges or unrelated footer data.
- **No half-converted surfaces.** A page is not considered redesigned while it still contains old UI language, old component primitives, stale shell pieces, or visual remnants from the previous system.
- **Approved prototypes are contracts.** When the user approves an HTML/prototype and asks to move it into production, implement the prototype structure directly: layout, palette, density, row/card rhythm, status tones, modal/drawer model, labels, and interaction flow. Remove demo-only role switchers or fake prototype helpers, but do not leave the old page dressed in the new colors. Any deviation required by real data, role scope, permission, accessibility, responsiveness, or missing backend contract must be recorded in evidence.
- **"Birebir" means visible parity.** The user expects to open the production
  route and see the approved prototype's surface, not a functionally equivalent
  page. If an existing AdminSurface/StoreSurface primitive changes the approved
  rhythm materially, extend or compose the primitive to preserve parity instead
  of silently accepting the drift.
- **Prototype copy is production copy.** Do not let prototypes use polished
  product labels while production ships internal/source/scope/debug wording.
  Titles, filters, statuses, metric labels, drawer labels, empty/error states,
  and confirmation copy must carry through unless a production reason is
  documented before closeout.
</store_ui_principles>

<anti_patterns>
- Do not patch over an old remnant without finding its source.
- Do not replace a page with a decorative hero when the product task is operational.
- Do not introduce broad theme rewrites while fixing one page.
- Do not leave "temporary" debug/status copy visible to users.
- Do not claim prototype parity from a visually similar but structurally different implementation.
- Do not treat prototype parity as a follow-up after functional delivery when
  the request was to implement the prototype. It is part of the same definition
  of done.
- Do not claim the UI is fixed without checking the state where the user saw the issue, especially mobile, refresh, loading, or staging.
- In production translation, prefer shared accessible controls when they
  preserve the accepted surface. In free-design prototypes, custom controls are
  allowed.
- Do not use raw hex colors, route-specific button classes, or page-local status
  palettes in production UI.
- Do not add lucide icons as decoration or to every repeated element.
- Do not show implementation/evidence copy such as "gercek veri", "guvenli veri
  kaynagi", "her satir ... temsil eder", "oturumdaki yetkili", or pagination
  mechanics in section descriptions.
</anti_patterns>

<success_criteria>
The refactor is done only when:

- The target surface matches the requested product framing.
- Free-design prototypes are not judged by shadcn coverage. Production
  translation records which controls become shared components and which remain
  scoped.
- Buttons, badges, inputs, overlays, date controls, empty/loading/error states,
  and toolbars follow the shared component standard.
- Icon use is intentional and restrained, not decorative filler.
- Metric cards have a deliberate visual treatment. Icons are optional unless
  the accepted design uses them.
- Section titles, helper text, empty states, badges, and buttons use product
  language; internal system/evidence wording is absent from user-facing UI.
- If an approved prototype is the source, desktop and mobile screenshots materially match that prototype or every intentional deviation is documented with a production reason.
- If an approved prototype is the source, the final report must say
  `Prototype parity: PASS` only after screenshots or equivalent browser visual
  inspection prove material desktop/mobile parity. Otherwise say
  `Prototype parity: BLOCKED` and name the exact differences.
- Old UI remnants named by the user are removed at source or explicitly parked.
- Internal architecture/debug copy is absent from user-facing UI.
- Relevant desktop/mobile/loading or refresh states have been checked.
- The final message includes the files changed, verification run, and any residual risk.
</success_criteria>
