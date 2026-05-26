# Store Surfaces Redesign Implementation Plan V1

Date: 2026-05-26

Scope: redesign the next ten Store pages after the Store Me reference line.
This plan extends PR #527, which records the mandatory page-redesign stack:
`shadcn/ui`, Tailwind v4 utilities/tokens, and `lucide-icons/lucide`.

Hard guardrails:

- Preserve existing API calls, auth checks, route guards, mutations, and data
  semantics.
- Do not add DB migrations, backend behavior, or new provider/runtime
  assumptions.
- Do not show route, auth, provider, API, DB, evidence, staging, mock, or
  handoff language in user-facing page copy.
- Keep role-aware navigation and route availability aligned.
- Use real page data; hide or simplify sections that only show placeholder
  values.

## Page Analysis

| Order | Page | Roles / persona | Current real data | Main issue | Implementation direction |
| --- | --- | --- | --- | --- | --- |
| 1 | `/store/tasks` | `STORE_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER`; personnel blocked by shell | workflow inbox, store action plans, checklist and approval prefetch signals | route/status preview chips, oversized metric grid, boundary copy | compact action cockpit: queue stats, role scope, action-plan list, inbox rows, shadcn buttons/cards/badges |
| 2 | `/store/checklists` | region, visual merchandiser, super admin, checklist readers; personnel blocked | mobile checklist today, checklist acknowledgements, mutations for visit and acknowledgement | strong data model but custom old command skin | keep behavior; wrap hero/toolbar/tabs/panels in Plum Glacier shadcn surface and remove old shell residue |
| 3 | `/store/approvals` | store manager creates target/workforce requests; region manager approves; read-only fallback | target requests, personnel, position options, returned workforce requests, mutations | ledger works but metrics/header are custom and dense | keep workbench logic; redesign header/metrics/panel shell with shadcn cards, badges, buttons |
| 4 | `/store/kpis` | store manager, region manager, super admin, report viewer through Store route | live KPI rows, closed snapshots, KPI config, score breakdown | too many panels, old metric cards, some source/contract language | create compact KPI cockpit: mode control, score strip, checklist impact, contribution rows, risk rows |
| 5 | `/store/rankings` | personnel, store manager, region manager, super admin | ranking summary, store/personnel leaderboards, filters, detail drawer | Plum layout exists but custom controls/table; mobile density needs consistency | preserve ranking model; move controls/table actions to shadcn input/select/button/table and keep compact rows |
| 6 | `/store/home` | all Store personas, including visual merchandiser | role-aware nav, checklist summary, workflow inbox brief | some placeholder pending metrics and route-connected copy | make landing data-led: role action summary, today's brief, real checklist/inbox counts, no fake KPI snapshot |
| 7 | `/store/feed` | all Store personas and visual merchandiser | visible feed posts, post scope, pin/challenge metadata | route chips and custom cards | compact announcement list with shadcn cards/badges/buttons; destination shown as action, not raw route |
| 8 | `/store/personnel/:employeeId` | same Store Me guard, profile mode by employee id | Store Me performance model for selected employee | wrapper only; no separate surface | keep as Store Me detail wrapper; document as already covered by Store Me redesign |
| 9 | `/store/targets` | region/reporting users through store nav | no store-native target data; links to admin targets | placeholder/handoff/boundary page with raw route copy | replace with clean bridge card: what can be done now, primary action to target flow, no internal boundary copy |
| 10 | `/store/reports` | region/reporting/store manager report roles | no store-native report summary; links to admin reports | placeholder/handoff/boundary page with raw route copy | replace with clean bridge card: current report access, primary action to reports, no internal boundary copy |

## Implementation Slices

1. Shared Store redesign primitives:
   - Add `input` and `skeleton` shadcn components.
   - Add Store page primitives for header, section, metric card, info grid,
     status badge, empty/loading states, and action links.

2. Simple page conversion:
   - Convert `/store/targets`, `/store/reports`, and `/store/feed` first.
   - Remove current route, data-boundary, next-step, handoff, and raw destination
     text from visible copy.

3. Action cockpit conversion:
   - Convert `/store/tasks` around existing workflow and Store Action data.
   - Keep Store Action plan creation/update components unchanged.

4. Store landing conversion:
   - Convert `/store/home` so visible metrics are real or omitted.
   - Remove route-connected/scaffold language and fake KPI snapshot values.

5. Complex surface conversion:
   - Convert the outer shells for `/store/checklists`, `/store/approvals`,
     `/store/kpis`, and `/store/rankings` without changing mutations or API
     models.
   - Keep detailed form/table internals where rewriting them would change
     workflow behavior; replace only visual containers and controls that are
     safe.

6. Verification:
   - `git diff --check`
   - `npm.cmd --prefix admin-web run lint`
   - `npm.cmd --prefix admin-web run build`
   - targeted Store E2E if the local environment can run it
   - desktop/mobile browser smoke for `/store/tasks`, `/store/checklists`,
     `/store/approvals`, `/store/kpis`, `/store/rankings`, `/store/home`,
     `/store/feed`, `/store/targets`, and `/store/reports`

Known release caveat:

- PR #527 was blocked because GitHub Actions did not create the expected
  `release-rehearsal` context, even though Vercel and Codex review passed. The
  next PR/branch should verify whether Actions runs are restored before merge.
