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
| Daily Command Brief on `/store/home` | ready_next_after_ui_intake | High value and understandable: "what should I pay attention to today?" It can use existing Store Action, workflow, KPI, ranking, checklist, target, feed, and freshness signals. | Read-only brief model with source labels and no generated advice. |
| Command Chain Intelligence | parked_until_daily_brief | Useful for region/admin: show why a store needs attention and which source proves it. It depends on Daily Brief vocabulary first. | Docs/spec plus read-only admin/region summary using existing operations/data-quality signals. |
| Store Performance Replay | parked_until_event_inventory | Strong "wow" idea, but only safe if every timeline event has a reliable source and timestamp. | Inventory event sources across imports, snapshots, Store Action status, checklist completion, target approval, and feedback. |
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

Use only after Daily Command Brief has stable source vocabulary.

First safe slice:

- docs/spec or read-only admin/region panel that lists source-linked reasons for
  store attention, using existing data-quality and operations signals.

Stop before:

- automated escalation,
- cross-store ranking rule changes,
- alert provider behavior,
- support-only permission bypasses.

## Store Performance Replay

Purpose:

- Show a factual timeline of why a store/person changed over time.

Candidate event sources:

- import batch created/completed/failed,
- snapshot run completed,
- KPI score/ranking period generated,
- target approval submitted/approved/returned,
- checklist completed/acknowledged,
- Store Action created/status changed/closed/canceled,
- pilot feedback submitted/classified.

First safe slice:

- event-source inventory and test map. Do not create a timeline UI until the
  event list has stable IDs, timestamps, scope, and source routes.

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

1. Daily Command Brief read-only selector on `/store/home`.
2. Store Performance Replay event-source inventory if the user wants a stronger
   executive story first.
3. Command Chain Intelligence spec if region/admin flow becomes the next pilot
   focus.

Until then, keep the active project mode on controlled pilot execution and fix
only concrete P0/P1/P2 findings.
