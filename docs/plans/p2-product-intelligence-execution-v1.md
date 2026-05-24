# P2 Product Intelligence Execution V1

Status: active
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, engineer, or product owner deciding whether to add Daily
  Command Brief, command-chain intelligence, store performance replay, usage
  insight, or internal change visibility.

After reading, they should know which ideas are useful now, which are parked,
which source data is real, and what the smallest safe implementation slice is.

## Sokrates Decision

Claim:

- The project does not need more generic foundation work right now; it needs
  narrowly scoped product intelligence that turns existing Store Ops facts into
  clearer daily decisions.

Assumptions:

- UI redesign is intentionally parked until the user starts that phase.
- AI-generated advice is out of scope for now.
- Every insight must be traceable to existing backend data, generated API
  contracts, or documented evidence.

Repo evidence:

- Store Action V1B has persisted action-plan commands and live command proof.
- `/store/tasks`, `/store/home`, `/store/me`, rankings, workflow inbox, reports,
  import, data-quality, operations, and feedback surfaces already expose the
  raw signals needed for daily guidance.
- PR #492 closed the accidental `STORE_PERSONNEL` checklist route exposure and
  updated the route matrix.

Counterargument:

- A polished Daily Brief or Replay screen would be more impressive to users,
  but building it before the larger UI/content redesign would create rework.

Risk:

- LOW for this docs-only execution map.
- MEDIUM for read-only adapters, because bad prioritization can make real data
  look like advice.
- HIGH for writes, notifications, automatic coaching, or AI summaries.

Door:

- Two-way for docs and read-only presentation.
- One-way-ish for persisted action history, notification rules, or behavioral
  scoring because they shape operator trust and rollback cost.

Decision:

- Do not build UI now.
- Keep these ideas as a P2 product-intelligence line.
- When product code starts, begin with one read-only `/store/home` Daily
  Command Brief slice backed only by existing signals and source links.

## Current Classification

| Idea | Status | Why | First safe slice |
| --- | --- | --- | --- |
| Store personnel checklist exposure cleanup | closed | `STORE_PERSONNEL` should not open checklist execution/result queues directly. PR #492 blocks direct route access and preserves manager/region/VM/reporting access. | Done. Re-run route matrix/e2e if role visibility changes. |
| Daily Command Brief on `/store/home` | first_slice_merged | High value and understandable: "what should I pay attention to today?" The first read-only slice now uses existing source links and no generated advice. | Keep it source-linked; expand only with real pilot feedback. |
| Command Chain Intelligence | helper_ready | Useful for region/admin: show why a store needs attention and which source proves it. Daily Brief V1 supplies the first source vocabulary, and the first pure read-only reason helper exists. | Use `docs/plans/command-chain-intelligence-source-map-v1.md`; next code should wire the helper only into a minimal read-only surface if pilot feedback asks for it. |
| Store Performance Replay | surface_spec_ready | Strong "wow" idea, and the first event-source inventory plus pure mapper now separate factual events from unsafe claims before any UI work. The read-only surface spec defines the future UI contract without starting UI implementation. | Use `docs/plans/store-performance-replay-event-source-inventory-v1.md` and `docs/plans/store-performance-replay-readonly-surface-spec-v1.md`; next code before UI redesign should be pure view-model only. |
| Internal Change Visibility | ready_docs_only | Operators need to know what changed, but a live changelog feature is not necessary yet. | Maintain release/operator notes in docs/evidence; later expose read-only product copy if pilot asks. |
| Site usage vs performance correlation | parked_data_policy | The question is valid, but every login/session event can become noisy or sensitive. Existing auth/audit evidence is enough for now. | Define privacy/data policy and aggregate engagement metric before adding new tracking. |
| App-level error tracking | blocked_external | Useful for broad production, but P0 trust ops already blocks provider SDK work until provider, destination, redaction, owner, and smoke proof are accepted. | Follow `docs/plans/p0-trust-operations-execution-v1.md`. |

## Daily Command Brief V1

Purpose:

- Replace a dashboard full of disconnected cards with one factual operating
  brief for the signed-in role.

Non-goals:

- no AI,
- no scoring math changes,
- no new workflow state machine,
- no notification provider,
- no hidden prioritization that cannot cite a source,
- no redesign-heavy layout work before the UI phase.

Allowed source families:

- open Store Action plans and KPI follow-up candidates,
- workflow inbox items,
- assigned-store KPI exception/readiness signals,
- latest ranking and performance deltas already available through reports,
- checklist queue/results only for roles allowed by the route matrix,
- target approval or coverage gaps only for roles allowed by target/request
  scope,
- pinned feed/admin messages,
- data freshness and quality warnings from existing operations/data-quality
  evidence.

First safe code slice when approved:

1. Add a small pure frontend selector or read-model helper that accepts already
   fetched Store Action, workflow, KPI/reporting, feed, and freshness inputs.
2. Return a sorted list of brief items with:
   - title,
   - source family,
   - source route,
   - severity label,
   - stale/fresh indicator,
   - role visibility reason.
3. Render it on `/store/home` as read-only, with source links.
4. Add Playwright coverage for manager, personnel, and report-viewer/region
   visibility.

Stop before:

- creating new backend endpoints unless current frontend fetch shape becomes
  reviewably bad,
- changing source scores,
- exposing checklist queues to `STORE_PERSONNEL`,
- generating text advice,
- adding write buttons,
- changing landing route behavior.

Verification ladder:

1. Unit/pure selector tests if helper is extracted.
2. `npm.cmd --prefix admin-web run lint`.
3. `npm.cmd --prefix admin-web run build`.
4. Targeted `/store/home`, `/store/tasks`, and role visibility Playwright.
5. `npm.cmd run test:scripts` if docs/flow/route matrices change.

## Command Chain Intelligence

Purpose:

- Help region/admin understand the chain from raw signal to action:
  import/snapshot freshness -> KPI/ranking/checklist signal -> workflow/Store
  Action item -> owner/status.

Current source map:

- `docs/plans/command-chain-intelligence-source-map-v1.md` defines allowed
  source families, safe/unsafe claims, role/scope visibility, reason item
  shape, stop rules, and verification ladder.
- `docs/evidence/product-progress/2026-05-24-command-chain-reason-helper-v1.md`
  records the first pure helper slice: existing workflow, Store Action, and
  operations signal inputs can become source-linked reason items without a new
  route, backend endpoint, auth change, workflow change, or advice layer.

Use only after Daily Command Brief has stable source vocabulary. That condition
is now satisfied for docs/source-map work and the pure helper. Product UI should
still begin with a minimal read-only surface and no backend aggregator.

First safe slice:

- minimal read-only admin/region surface, only if pilot feedback asks for store
  attention reasons, using the existing pure helper and already-fetched
  data-quality, operations, workflow, Store Action, and reporting signals.

Stop before:

- automated escalation,
- cross-store ranking rule changes,
- alert provider behavior,
- support-only permission bypasses,
- new backend aggregation until a read-only surface proves the vocabulary works.

## Store Performance Replay

Purpose:

- Show a factual timeline of why a store/person changed over time.

Current source inventory:

- `docs/plans/store-performance-replay-event-source-inventory-v1.md` classifies
  event families as READY, PARTIAL, or PARKED and records the source id,
  timestamp, scope, route, and guardrail required before any timeline UI.
- `admin-web/src/features/store-performance-replay/event-candidates.ts` provides
  the first pure read-only mapper/test map for already-fetched rows. It creates
  sourced event candidates only; it does not fetch data, add routes, add
  persistence, or infer impact.
- `docs/plans/store-performance-replay-readonly-surface-spec-v1.md` defines
  the future read-only surface contract, role/scope omission rule, no-causality
  copy rules, states, and verification ladder without approving visible UI yet.

Candidate event sources:

- import batch created/completed/failed,
- snapshot run completed,
- KPI score/ranking period generated,
- target approval submitted/approved/returned,
- checklist completed/acknowledged,
- Store Action created/status changed/closed/canceled,
- pilot feedback submitted/classified.

First safe slice:

- Done as a pure mapper/test slice. Do not create a timeline UI until the mapped
  event list has stable IDs, timestamps, scope, source routes, and
  no-causality wording accepted by the UI/content phase.
- The next safe non-UI code slice, if needed, is a pure view-model adapter that
  accepts mapped candidates and existing route/scope visibility hints. Visible
  UI remains parked until UI/content direction starts.

Stop before:

- fabricating events from derived scores,
- mixing audit events with user-visible facts without redaction,
- adding a generic event bus.

## Internal Change Visibility

Purpose:

- Keep operators aware of what changed without making them read GitHub.

Current safe path:

- Continue using docs/evidence and PR summaries for operator-visible change
  notes.
- If pilot feedback asks for in-app release notes, start with a static,
  read-only list curated from accepted release notes, not commit logs.

Stop before:

- exposing internal commit messages,
- leaking branch names or private infrastructure details,
- turning release notes into a ticketing system.

## Usage Vs Performance Correlation

Question:

- Does daily site usage correlate with better personnel/store performance?

Honest answer:

- It is worth exploring later, but not the current priority. Raw login counts
  are easy to collect and easy to misread. A person may perform well without
  logging in, or log in often because they are stuck.

Safe future approach:

1. Use aggregate engagement, not every raw login event in product surfaces.
2. Separate "visited", "acted", "completed assigned work", and "read critical
   brief" instead of one login count.
3. Compare only after data policy, retention, consent/notice, and role-level
   visibility are decided.

Stop before:

- tracking raw sessions as performance evidence,
- showing individual login frequency to managers without policy,
- treating engagement as a score input.

## Next Recommendation

After the user's UI/content redesign direction starts, choose one of these:

1. Minimal Command Chain read-only surface if admin/region "why this store
   needs attention" visibility is the next pilot question.
2. Store Performance Replay read-only surface spec if the user wants a stronger
   executive story first and accepts no UI implementation before the visual
   redesign/content direction.
3. Daily Command Brief expansion only if real pilot feedback asks for more
   source families on `/store/home`.

Until then, keep the active project mode on controlled pilot execution and fix
only concrete P0/P1/P2 findings.
