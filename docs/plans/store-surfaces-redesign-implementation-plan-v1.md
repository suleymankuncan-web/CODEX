# Store Surfaces Redesign Implementation Plan V1

Date: 2026-05-26

Status: active intent matrix for the multi-PR Store UI refactor line.

Scope: all active `/store/*` routes, with `/store/incentives` explicitly parked
as a future product-expansion intake surface.

This plan supersedes the earlier ten-page redesign note by adding the full
Store Page Intent Matrix required before implementation. It extends the Store
Me reference line and the merged Store UI stack decision:

- `shadcn/ui` components for production page redesigns,
- Tailwind v4 utilities/tokens,
- `lucide-icons/lucide` for icons,
- Plum Glacier as the active Store refactor pilot language, not a global theme
  rewrite.

## Hard Guardrails

- Preserve existing API calls, auth checks, route guards, mutations, scoring,
  ranking sort, approval state machines, and user workflow semantics.
- Do not add DB migrations, backend behavior, API response-shape changes, or new
  provider/runtime assumptions in a UI refactor PR.
- Do not show raw route, auth, scope, provider, API, DB, evidence, staging,
  mock, token, queue, Redis, or handoff/debug language in user-facing page copy.
- Keep role-aware navigation and direct-route availability aligned.
- Do not invent data. If a page has no real API/model/config source for a
  module, use a loading, empty, access, or honest bridge state instead.
- Keep screens clean and premium: compact hierarchy, precise alignment, useful
  status, restrained visual energy, no generic admin-table feel.
- Do not confuse premium with decorative. Every visible module must help the
  user understand status or act.
- `/store/incentives` is parked for later product shaping. Do not productize it,
  add it to toolbar navigation, or infer incentive calculations in this line.

## Source Evidence

Primary route and role evidence:

- `admin-web/src/app/store-shell.tsx`
- `admin-web/src/app/store-navigation.ts`
- `admin-web/src/features/auth/role-permission-preview.ts`
- `docs/evidence/system-flow/store-placeholder-route-decision-v1.md`
- `docs/plans/role-scope-drift-guard-v1.md`
- `admin-web/e2e/store-surfaces.spec.ts`
- `admin-web/e2e/checklist-today-surfaces.spec.ts`

Reference UI/data evidence:

- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `admin-web/src/pages/store-my-performance-model.ts`
- `admin-web/src/pages/store-my-performance-plum-dashboard.tsx`
- `admin-web/src/pages/store-surface-primitives.tsx`
- `docs/prototypes/plum-glacier-token-set-v1.md`

## Store Page Intent Matrix

### `/store`

- Intent: Store shell entry route.
- Persona: all non-VM Store shell personas; visual merchandiser-only users are
  redirected to `/store/checklists`.
- Toolbar: not a toolbar item; `/store/home` is the canonical home item.
- Real sources: route shell state, auth summary, resolved Store persona.
- Main action: route to the correct first Store surface.
- States: setup-required, verifying, rejected, guarded route fallback.
- Fake-data risk: low if it stays as routing/shell only.
- Current UI risk: shell still imports one legacy `ScreenState` for rejected
  auth mode, but the Store sidebar and command shell are the active reference.
- Store Me pattern: keep role-aware shell and compact navigation.
- Do not change: shell auth decision, VM landing redirect, route guard behavior.

### `/store/home`

- Intent: role-aware Store command home that tells the user what needs attention
  today.
- Persona: personnel, store manager, region manager, visual merchandiser.
- Toolbar: all personas that can enter the Store shell, except VM lands here
  only through direct route redirect rules.
- Real sources: auth scope summary, role-aware Store navigation, workflow inbox
  for managers/reporting roles, checklist acknowledgements for checklist
  readers, mobile checklist today for region/VM/super-admin field visit users.
- Main action: open the user's most relevant Store surface for the resolved
  persona.
- States: workflow/checklist loading and error are reflected in the daily brief;
  no independent write state.
- Fake-data risk: medium. Static "KPI" or route-connected labels must not become
  fake performance summaries.
- Current UI risk: already on Store primitives, but copy and metrics need a
  tighter data-only pass.
- Store Me pattern: compact first viewport, short data-led daily brief, no broad
  explanatory pools.
- Do not change: persona resolution, workflow inbox read, checklist read
  enablement, VM redirect policy.

### `/store/checklists`

- Intent: checklist field visit, result acknowledgement, and checklist history
  cockpit.
- Persona: region manager, visual merchandiser, store manager, super admin,
  report/checklist readers where authorized; personnel blocked by route guard.
- Toolbar: manager, region manager, visual merchandiser when
  `canOpenStoreChecklists` allows it.
- Real sources: `getMobileChecklistToday`, `getChecklistAcknowledgements`,
  checklist response save/start/complete commands, acknowledgement command.
- Main action: region/VM start or complete an assigned-store checklist; store
  manager acknowledges completed results.
- States: list loading/error, visit draft/dirty state, autosave, command notice,
  result modal, acknowledgement mutation error.
- Fake-data risk: low if all summaries stay derived from mobile today and
  acknowledgement rows.
- Current UI risk: strong workflow model, but several local checklist atoms and
  command classes remain visually custom and should be wrapped in the Store
  primitive/shadcn language without changing behavior.
- Store Me pattern: compact role-aware top strip, mobile-first dense lists,
  clear progress/status chips.
- Do not change: checklist scoring, template selection rules, BM/VM role
  boundaries, acknowledgement semantics, autosave/complete command behavior.

### `/store/tasks`

- Intent: store action cockpit and shared inbox surface for operational follow
  up.
- Persona: store manager and super admin for persisted action-plan controls;
  report viewer can have read-only task visibility where documented; personnel
  blocked by shell.
- Toolbar: store manager; region manager currently does not get this nav item;
  direct route uses `storeTasksAllowed`.
- Real sources: `getWorkflowInbox`, `listStoreActionPlans`, checklist
  acknowledgement prefetch, store approvals prefetch tasks.
- Main action: inspect workflow items, create/update/close/cancel Store Action
  plans where role allows it, open source surfaces for checklist/approval work.
- States: access denied, inbox loading/error, action-plan list pagination,
  detail disclosure, mutation pending/error states in Store Action controls.
- Fake-data risk: medium. Action candidates must stay derived from real inbox
  items or persisted plans.
- Current UI risk: already on Store primitives and shadcn button/input, but
  metric density and row hierarchy need a compact premium pass.
- Store Me pattern: "today's work" card language, concise status/rank-like
  summary, no fake coaching.
- Do not change: workflow inbox status, Store Action lifecycle, assigned-store
  command scope, source-domain ownership.

### `/store/kpis`

- Intent: store KPI interpretation and score contribution surface.
- Persona: store manager, region manager, super admin, report viewer; route is
  guarded by reporting access.
- Toolbar: store manager and region manager via Store navigation when allowed.
- Real sources: `getKpiConfig`, `getStoreKpiHighlights`, `getReportingSnapshotRuns`,
  `getKpiReport`, `getStoreScoreBreakdown`.
- Main action: understand live or closed-period KPI status, source semantics,
  checklist impact, contribution, and risk rows.
- States: config/live/snapshot/closed/breakdown loading and errors, live vs
  closed mode, no snapshot, no store scope, no data rows.
- Fake-data risk: high if score/threshold/risk language is inferred outside the
  KPI config and reporting rows.
- Current UI risk: converted to Store primitives but still large, panel-heavy,
  and dense. Needs cockpit compression, not scoring reinterpretation.
- Store Me pattern: KPI cards combine value, target/progress, contribution, and
  status in one compact rhythm.
- Do not change: KPI score math, benchmark policy, score caps, config behavior,
  snapshot selection semantics.

### `/store/me`

- Intent: personal performance cockpit.
- Persona: store personnel and store manager for self view.
- Toolbar: personnel and store manager when `me` is allowed.
- Real sources: `getMyPerformance`, `getKpiConfig`, closed snapshot runs, live
  period data.
- Main action: understand own score, KPI contribution, rank context, trend, and
  data-driven "Bugun Yapilacaklar" items.
- States: live/closed mode, daily/monthly period selection, loading, missing
  supporting metadata, no-data responses.
- Fake-data risk: low after the Store Me reference line if future changes keep
  using `store-my-performance-model.ts`.
- Current UI risk: reference standard; only regressions should be fixed here.
- Store Me pattern: this is the pattern source.
- Do not change: performance API contract, date-period fallback behavior,
  ranking interpretation, KPI config mapping.

### `/store/personnel/:employeeId`

- Intent: personnel detail performance profile for an employee selected from
  rankings or another allowed context.
- Persona: store performance roles with route access; effectively Store Me in
  `profileMode="personnel"`.
- Toolbar: not a toolbar item; detail route only.
- Real sources: `getPersonnelPerformance`, `getKpiConfig`, closed snapshot runs,
  route params and optional live period query params.
- Main action: inspect one employee's performance without changing their data.
- States: same as Store Me plus employee route-param reset and period fallback.
- Fake-data risk: low if it remains a wrapper over Store Me model.
- Current UI risk: no separate surface; covered by Store Me redesign.
- Store Me pattern: inherited directly.
- Do not change: employee id routing, period query handling, profile reset key.

### `/store/rankings`

- Intent: store/personnel leaderboard with scoped or privileged visibility.
- Persona: store personnel, store manager, region manager, super admin.
- Toolbar: personnel, store manager, region manager where allowed.
- Real sources: `getRankings`, cached `ranking-v1` fallback, available periods,
  store/personnel leaderboard rows, backend access flags.
- Main action: compare rank, filter privileged views, open allowed personnel
  performance detail.
- States: access denied, ranking loading/error, empty ranking, cached fallback
  while fetching, pagination/filter/sort/detail states.
- Fake-data risk: high if frontend invents ranking completeness, Turkey
  reference, metric mini-rank, or score explanation outside backend contract.
- Current UI risk: Plum custom layout exists but not fully shadcn/Store
  primitive aligned; mobile density and controls should be harmonized.
- Store Me pattern: compact rank strips, clear period context, concise metric
  contribution display.
- Do not change: backend sort params, global/detail access flags, top-100 vs
  full scope semantics, personnel detail authorization.

### `/store/feed`

- Intent: visible announcements/challenge posts for the current Store user.
- Persona: all Store personas, including visual merchandiser.
- Toolbar: all persona nav sets include feed.
- Real sources: `getVisibleFeedPosts`, feed post scope, pin/challenge metadata,
  target route/link data.
- Main action: read visible posts and open the provided destination action when
  a post has one.
- States: loading, feed error with retry, empty feed, destination absent.
- Fake-data risk: low if cards render only actual posts.
- Current UI risk: already Store primitive/shadcn based; verify destination is
  shown as an action and not as raw route language.
- Store Me pattern: compact list, clear status badges, no decorative feed cards.
- Do not change: visibility filtering, feed link target ownership, admin feed
  publishing semantics.

### `/store/competitions`

- Intent: read-only scoped competition visibility for store users.
- Persona: store manager and store personnel.
- Toolbar: currently not in role navigation; direct route remains available
  through shell guard.
- Real sources: `listCompetitions`, `getCompetition`, scoped store
  contributions, latest scores, warnings, competition display/readability
  helpers.
- Main action: inspect visible competitions, contribution rows, scores, and
  warnings.
- States: access denied, list loading/error with retry, empty list, detail
  loading/error with retry, no latest scores/contributions/warnings.
- Fake-data risk: medium. It must remain read-only and scoped; no challenge or
  incentive claims beyond API rows.
- Current UI risk: clear old UI remnant. It uses `dashboard-primitives`, raw
  `panel`, `page-stack`, `control-button`, and `hero-panel` classes.
- Store Me pattern: compact read summary, deliberate metrics, shadcn buttons and
  badges, no raw route metric.
- Do not change: competition list/detail APIs, scope filtering, admin competition
  stage/template/write flows.

### `/store/approvals`

- Intent: store-facing approval/request workbench.
- Persona: store manager creates target distribution, seller-code, and
  offboarding requests; region manager approves target requests; report/admin
  roles may have documented read-only or list access.
- Toolbar: store manager and region manager only when
  `canListTargetDistributionRequests` passes.
- Real sources: target distribution requests/personnel, workforce position
  options, store employees, rejected seller-code and offboarding requests, and
  create/approve/resubmit mutations.
- Main action: submit target/workforce requests, approve allowed target
  requests, edit/resubmit returned workforce requests.
- States: access persona fallback, multiple query loading/error states, form
  validation, create/approve/resubmit pending/error/success notices.
- Fake-data risk: high if request counts or readiness summaries are not derived
  from queries.
- Current UI risk: outer shell is on Store primitives but workbench internals
  still contain custom panel and form structures. Workflow risk is high.
- Store Me pattern: compact sections and status hierarchy, but forms should use
  shadcn only where behavior remains unchanged.
- Do not change: target approval semantics, workforce lifecycle side effects,
  action-store scope, validation rules, mutation payloads.

### `/store/settings`

- Intent: real utility route for browser-local language preference.
- Persona: authenticated Store users, including visual merchandiser.
- Toolbar: common settings item.
- Real sources: browser-local localization preference through
  `LanguageToggle`; no backend profile/settings contract.
- Main action: change language preference.
- States: local preference state only; no backend loading/error.
- Fake-data risk: medium if it claims account/profile persistence.
- Current UI risk: clear old UI remnant. It uses `dashboard-primitives`, legacy
  `store-command-utility-*`, `store-command-panel`, and raw route boundary copy.
- Store Me pattern: clean utility card, concise preference state, no route/data
  boundary wording.
- Do not change: localization storage behavior or add backend profile writes.

### `/store/targets`

- Intent: honest bridge to the current target workflow until a store-native
  target read model is scoped.
- Persona: region/reporting users through role-aware Store nav.
- Toolbar: region manager when `targets` is allowed.
- Real sources: no store-native target data on this route; primary action links
  to `/admin/targets`; product classification lives in the placeholder decision
  doc.
- Main action: open the current target workflow.
- States: no API loading/error; bridge/empty state only.
- Fake-data risk: high if it invents target health, target detail, or write
  semantics.
- Current UI risk: already Store primitive based, but user-facing copy must avoid
  internal boundary/route wording.
- Store Me pattern: compact bridge with one primary action and clear current
  capability.
- Do not change: target request/approval workflow, admin target ownership,
  scoring reference behavior.

### `/store/reports`

- Intent: honest bridge to current report access until a store-native report
  summary is scoped.
- Persona: region/reporting/store manager report roles.
- Toolbar: region manager and allowed report roles.
- Real sources: no store-native report summary on this route; primary action
  links to `/admin/reports`; product classification lives in the placeholder
  decision doc.
- Main action: open current report workflow.
- States: no API loading/error; bridge/empty state only.
- Fake-data risk: high if it invents report summaries or scoring changes.
- Current UI risk: already Store primitive based, but user-facing copy must avoid
  internal boundary/route wording.
- Store Me pattern: compact bridge with one primary action and no fake metric
  cards.
- Do not change: report reads, export behavior, KPI/ranking/report semantics.

### `/store/incentives`

- Intent: parked product expansion intake/foundation, not a live incentive
  engine.
- Persona: direct route can render for Store shell users, but it is intentionally
  not a toolbar item in this line.
- Toolbar: do not add.
- Real sources: auth session and role labels only; no payout, rule lookup,
  approval outcome, recalculation, or incentive summary API exists.
- Main action: none for this refactor line; keep existing route stable for
  future shaping.
- States: locale/foundation behavior covered by existing Store e2e.
- Fake-data risk: very high. Do not infer payouts, rewards, formulas, badges,
  or progress.
- Current UI risk: old UI remnant remains by explicit product exception.
- Store Me pattern: not applied until incentives are scoped as a product slice.
- Do not change: route existence, parked classification, or toolbar absence.

## Batch PR Plan

The work must not be delivered as one large PR. Use `discipline.md` slice rules:
same domain, risk class, verification, and rollback story may be batched; mixed
risk must be split.

1. **Intent matrix batch**
   - Scope: this document and optional handoff pointers only.
   - Risk: LOW, docs-only.
   - Gate: `git diff --check`, `npm.cmd run test:scripts`.

2. **Legacy remnant batch**
   - Scope: `/store/competitions` and `/store/settings`.
   - Risk: LOW/MEDIUM frontend UI; no business behavior changes.
   - Gate: admin-web lint/build plus targeted `store-surfaces` tests for
     competitions/settings/locale.

3. **Bridge/utility batch**
   - Scope: `/store/targets`, `/store/reports`, and settings follow-up only if
     needed.
   - Risk: LOW frontend UI.
   - Gate: utility page Store e2e and mobile visual check.

4. **Operational read batch**
   - Scope: `/store/home`, `/store/kpis`, `/store/rankings`, `/store/feed`.
   - Risk: MEDIUM frontend UI because KPI/ranking copy must remain source-bound.
   - Gate: targeted Store e2e for home/KPI/ranking/feed plus lint/build.

5. **Workflow-heavy batches**
   - Scope: `/store/checklists` and `/store/approvals`.
   - Risk: MEDIUM/HIGH because visible UI is close to mutations and role/action
     scope.
   - Gate: page-specific targeted e2e, lint/build, and broader Store e2e if
     shell/role behavior changes.
   - Split checklists and approvals unless the actual diff is only shared
     shell/primitive cleanup.

6. **Final consistency batch**
   - Scope: old class/component/copy search, desktop/mobile visual QA,
     current-state update, release gate.
   - Risk: LOW/MEDIUM depending on diff.
   - Gate: `npm.cmd --prefix admin-web run check:release` and GitHub/Vercel
     checks before merge.

## Implementation Rules For Later Batches

- Start each batch from fresh `main`.
- Read this matrix before editing page code.
- Search the target files for:
  - `dashboard-primitives`,
  - `hero-panel`,
  - `metric-grid`,
  - `panel`,
  - `control-button`,
  - `store-command-utility`,
  - route/auth/API/DB/evidence/staging/mock/handoff copy.
- Prefer existing `store-surface-primitives` only when they already compose
  shadcn correctly; otherwise add or adjust small primitives rather than
  scattering local markup.
- For forms, preserve payload, validation, and mutation timing first; shadcn
  form conversion is allowed only when behavior stays identical.
- For charts and dense tables, mobile readability is the baseline.
- If real data does not exist, remove the module or show an honest empty/bridge
  state. Do not fill gaps with demonstration values.

## Stop Rules

Stop and ask for product scope before:

- adding a new Store-native target, report, or incentive read model,
- changing any API contract or generated client shape,
- changing auth/permission or route-guard semantics,
- changing KPI scoring, ranking sort, checklist weight, target approval, or
  workforce request behavior,
- turning `/store/incentives` into a live product surface,
- adding motivational/coaching copy that is not derived from real KPI/action
  state.
