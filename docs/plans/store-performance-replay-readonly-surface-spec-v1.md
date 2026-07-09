# Store Performance Replay Read-Only Surface Spec V1

Status: surface_spec_ready
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, engineer, or product owner deciding whether Store Performance
  Replay is ready for a visible read-only surface.

After reading, they should know the user question, source contract, role/scope
rules, copy rules, states, verification ladder, and the exact line where the
work must stop before it becomes UI redesign, analytics, or invented advice.

## Sokrates Decision

Claim:

- Store Performance Replay can become a useful executive/operator story only if
  every row stays factual, sourced, scoped, and non-causal.

Assumptions:

- UI/content redesign is still parked.
- AI narrative and automatic recommendations are out of scope.
- The pure mapper at
  `admin-web/src/features/store-performance-replay/event-candidates.ts` is the
  current source vocabulary for future view-model work.
- The source inventory at
  `docs/plans/store-performance-replay-event-source-inventory-v1.md` remains
  the source-family readiness reference.

Repo evidence:

- PR #498 created the event-source inventory.
- PR #499 created a pure mapper that accepts already-fetched rows and emits
  safe event candidates with stable ids, strict timestamps, source routes,
  readiness, and redaction notes.
- Current route/scope work already treats route visibility and assigned-store
  action scope as application authorization boundaries, not UI suggestions.

Counterargument:

- A visible timeline would be more impressive now, but it would create rework
  during the later visual/content redesign and could overstate causality before
  real pilot users react to the story format.

Risk:

- LOW for this docs-only surface spec.
- MEDIUM for a future read-only view-model or visible timeline, because labels,
  ordering, and missing links can create false interpretation.
- HIGH for timeline persistence, causality labels, alerts, AI summaries, or
  treating engagement/action activity as performance proof.

Door:

- Two-way for docs and pure read-only view-model helpers.
- One-way-ish for visible history and operator trust if the timeline implies a
  false cause or exposes a source outside scope.

Decision:

- Do not build the Replay UI yet.
- This spec makes the future surface ready for implementation intake after the
  user starts UI/content direction or pilot feedback explicitly asks for the
  replay story.
- The next code slice, if chosen before UI redesign, should still be a pure
  view-model adapter only.

## Product Question

Store Performance Replay answers:

> What happened around this store or person over time, and which existing
> system source proves each fact?

It must not answer:

- why performance changed,
- who is at fault,
- which action caused a KPI movement,
- what the operator should do next,
- whether site usage caused performance.

Those require separate analysis, policy, or product decisions.

## Surface Contract

Input:

- `readonly StorePerformanceReplayEventCandidate[]`

No surface should fetch raw audit logs directly. If data is missing, the surface
should say evidence is unavailable or stay empty. It must not invent placeholder
events.

Required row fields:

- `id`
- `occurredAt`
- `sourceFamily`
- `sourceId`
- `sourceRoute`
- `scope`
- `title`
- `safeSummary`
- `readiness`
- `redactionNotes`

Ordering:

1. descending `occurredAt`,
2. `ready` before `partial` only when timestamps are equal,
3. stable source-family and id tie-breaks.

Default limits:

- initial render: 50 events,
- warning before showing more than 100 events,
- virtualized list or paged grouping before broad historical ranges.

## Role And Scope Rules

Every event must pass both event-level scope and source-route visibility before
it is shown.

| Actor | V1 visibility | Notes |
| --- | --- | --- |
| `SUPER_ADMIN` | company, region, store, and pilot/operator context | Can see all source families allowed by the current app role matrix. |
| `HR_ADMIN` | company and HR/admin scoped views | Safe for import, snapshot, reports, target, workflow, Store Action, and feedback sources allowed by route guards. |
| `REGION_MANAGER` | assigned region/store scope | Must not see company-wide sources outside assigned scope. |
| `STORE_MANAGER` | assigned store scope | Can see store tasks/actions, allowed approvals, rankings, and checklist facts only where the route matrix already allows it. |
| `STORE_PERSONNEL` | parked for Replay V1 | Do not expose checklist queues or management replay. A future personal replay needs its own data policy and route matrix check. |
| `REPORT_VIEWER` | read-only report/store scope | No command buttons and no hidden management action sources. Source links must stay read-only. |

If the actor cannot open `sourceRoute`, the event is omitted unless a safe
role-specific route alternative exists. Do not show a disabled deep link to a
forbidden source.

## Source Family Display Rules

| Source family | Display posture | Allowed copy | Forbidden copy |
| --- | --- | --- | --- |
| `snapshot` | primary freshness anchor | "snapshot completed", "reporting period generated" | "performance changed because of snapshot" |
| `store_action` | human follow-up fact | "action opened/closed/cancelled" | "action improved score" |
| `target` | planning/approval fact | "request submitted/approved" | "target caused ranking movement" |
| `import` | data-arrival context | "import recorded with status" | "store performance impacted by import" |
| `kpi_ranking` | derived official period context | "KPI/ranking period available" | "rank movement event" without before/after official snapshots |
| `checklist` | operational completion context | "checklist created/completed/acknowledged" | "checklist score explains performance" |
| `workflow` | aggregation pointer | "needs attention" plus source link | treating inbox item as the primary source fact |
| `pilot_feedback` | operator/pilot context | "feedback submitted/classified" | store or personnel performance claim |

## UI Shape For Later

This is a future implementation guide, not approval to build UI now.

Recommended regions:

1. Context header: selected company/region/store/person, date range, and a
   "factual timeline, no causality claim" label.
2. Filter row: date range, source family, readiness, scope, and source-route
   visibility.
3. Timeline list: timestamp, source-family label, title, safe summary, source
   route action, readiness chip, redaction note indicator.
4. Evidence drawer: source id, source route, scope keys, redaction notes, safe
   claim, unsafe claim.
5. Empty state: "No sourced replay events for this scope and period."

Accessibility and mobile:

- Timeline rows must be keyboard reachable.
- Source actions must have clear accessible names.
- Long source ids and route labels must wrap or truncate without horizontal
  page overflow.
- Mobile should group by day and avoid side-by-side columns.

## States

Loading:

- Show source-family skeletons only after the owning page already has data
  loading behavior.

Empty:

- Say no sourced events exist for the selected scope/date range.
- Offer filter reset only if filters are active.

Partial evidence:

- Show `partial` events with muted readiness copy and redaction notes.
- Do not promote partial rows to executive summary.

Error:

- Reuse the owning page error boundary or query error state.
- Do not show stale events as fresh facts.

## First Safe Future Slices

Slice A, still no UI:

1. Add a pure `toReplayTimelineViewModel` helper beside the mapper.
2. Accept only `StorePerformanceReplayEventCandidate[]` plus actor visibility
   hints supplied by existing route/scope helpers.
3. Return grouped, display-ready rows with no fetches and no behavior changes.
4. Unit test role omission, grouping, empty state data, and no-causality copy.

Slice B, only after UI/content direction:

1. Add a small read-only surface inside an existing reports/store detail
   context.
2. Use only already-fetched or explicitly passed mapped candidates.
3. Add targeted Playwright for role visibility, source links, empty state,
   mobile wrapping, and no command buttons.

Stop before:

- new backend endpoint,
- DB migration,
- raw audit log UI,
- generic event bus,
- command/write buttons,
- AI narrative,
- causal impact labels,
- hidden role/scope widening,
- broad dashboard redesign.

## Verification Ladder

Docs-only:

1. `git diff --check`
2. `npm.cmd run test:scripts`

Pure view-model helper:

1. `npm.cmd --prefix admin-web run test:scripts`
2. `node --test scripts/file-size-guard.test.mjs`
3. `npm.cmd --prefix admin-web run lint`
4. `npm.cmd --prefix admin-web run build`
5. `npm.cmd run test:scripts`

Visible surface:

1. all pure helper gates,
2. targeted Playwright for the owning route,
3. mobile viewport screenshot/browser check,
4. route/scope matrix evidence update if visibility changes,
5. final local adversarial review and mergeability confirmation; do not request
   or await GitHub Codex review while the owner-disabled policy is active.

## Go / No-Go

Go for docs and pure helper work when:

- rows are source-linked,
- no source route is shown outside role/scope,
- no row claims causality,
- no new endpoint or migration is needed,
- tests cover malformed timestamps, missing links, and forbidden sources.

No-Go when:

- the user has not started UI/content direction and the work wants visible UI,
- a row has no stable source id or strict timestamp,
- the actor cannot open the source route,
- the copy implies "because", "caused", "improved due to", or blame,
- raw audit payloads, provider subjects, tokens, cookies, or secret-like ids
  would be exposed.
