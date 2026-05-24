# Usage Performance Correlation Policy V1

Status: data_policy_ready
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, product owner, HR/operator stakeholder, or engineer deciding
  whether to relate site usage to store/personnel performance.

After reading, they should know which engagement signals are acceptable, which
claims are unsafe, what privacy boundaries apply, and what the first safe code
slice would be if this becomes active later.

## Sokrates Decision

Claim:

- Comparing application engagement with store/personnel outcomes is a valid
  question. Raw login counts are not a safe or fair performance signal.

Assumptions:

- The project may later want to learn whether people who read/action their
  assigned work perform differently from people who never use the app.
- AI is out of scope.
- UI redesign is parked.
- Auth/session evidence exists for controlled pilot, but that does not mean
  individual usage tracking is ready for product surfaces.

Repo evidence:

- The app already has authenticated routes, role/scope assignments, Store
  Action commands, workflow items, Daily Command Brief, and reporting/KPI
  read-models.
- Current evidence discipline already forbids raw tokens, cookies, provider
  subjects, and private payloads in docs.
- `docs/plans/p2-product-intelligence-execution-v1.md` parks usage/performance
  correlation until a data policy exists.

Counterargument:

- Login counts are easy to collect, but they are easy to misuse. A high login
  count may mean confusion, not engagement. A low login count may be normal if
  the person's role has fewer assigned tasks.

Risk:

- LOW for this docs-only policy.
- MEDIUM for aggregate engagement reports.
- HIGH for individual usage surveillance, manager scorecards, disciplinary
  use, or feeding engagement into performance scores.

Door:

- Two-way for docs and aggregate exploratory analysis.
- One-way-ish for individual tracking because trust and privacy damage are hard
  to undo.

Decision:

- Do not add usage tracking now.
- Do not treat login frequency as performance evidence.
- If this becomes active, start with aggregate engagement categories and
  explicit privacy/retention rules before writing code.

## Product Question

Allowed question:

> Are teams that read and act on their assigned operational work more likely to
> have timely closures, fewer stale tasks, or better official KPI outcomes?

Disallowed shortcuts:

- "Who logs in the most?"
- "Who logs in the least?"
- "Low login means low performance."
- "High login means high engagement."
- "Engagement caused performance improvement."

## Engagement Signal Vocabulary

Use separated signal families. Do not collapse them into one "login score".

| Signal | Meaning | Safe use | Unsafe use |
| --- | --- | --- | --- |
| `visited` | A user authenticated and reached an allowed app route. | Aggregate adoption trend by role/store/region. | Individual performance judgment. |
| `read_brief` | A user opened a sourced brief or critical operating surface. | Measure whether important information is being seen. | Claiming the user understood or acted. |
| `opened_source` | A user followed a source link from a brief/replay/support surface. | Measure source-linked investigation. | Treating clicks as quality work. |
| `acted` | A user completed an allowed command such as Store Action create/status/close/cancel or checklist acknowledgement where permitted. | Compare assigned work closure and app-assisted execution. | Mixing different command types into one score. |
| `completed_assigned_work` | Existing domain state shows assigned work was completed. | Compare operational completion with app usage windows. | Claiming app usage caused completion. |
| `ignored_or_stale` | Assigned work stayed stale past an existing domain threshold. | Identify training/support friction. | Punitive ranking without context. |

## Outcome Vocabulary

Allowed outcome families:

- official snapshot-based KPI/ranking outcomes,
- Store Action closure timeliness,
- workflow inbox aging,
- checklist completion/acknowledgement where the role matrix allows it,
- target approval/coverage timeliness,
- import/snapshot freshness as context, not personnel performance.

Disallowed outcome families:

- raw login frequency as a score,
- private browsing behavior,
- provider session internals,
- unapproved productivity surveillance,
- AI-inferred motivation, intent, or blame.

## Minimum Privacy Rules

Before any implementation:

1. Define who can see aggregate engagement.
2. Define whether individual engagement is visible at all. Default: no product surface for individual login frequency.
3. Define retention. Default proposal: keep raw event material out of product
   surfaces; use aggregate windows such as 7, 30, and 90 days.
4. Do not store or expose raw Clerk tokens, cookies, provider subjects, IPs,
   user agents, or private payloads.
5. Keep role/scope visibility aligned with application DB assignments.
6. Add a notice/training explanation before using engagement in pilot
   discussions.

## Analysis Rules

Any future correlation analysis must:

- use aggregate cohorts before individual rows,
- segment by role, assigned store, region, and task availability,
- compare like with like,
- use time windows and lag periods,
- separate adoption from action completion,
- report uncertainty and sample size,
- say "associated with" instead of "caused by",
- keep engagement out of KPI/ranking scoring unless a separate explicit policy and owner decision exists.

## First Safe Future Slices

Slice A, docs/evidence only:

1. Select pilot question and audience.
2. Define aggregate grain: company, region, store, role, or anonymous cohort.
3. Define retention and redaction.
4. Define stop conditions for privacy or misuse.

Slice B, code only after Slice A is accepted:

1. Add a pure aggregation helper fed by existing sanitized events or domain
   completion records.
2. Emit aggregate counts by role/store/date window, not raw per-login product
   rows.
3. Add tests proving no tokens, cookies, provider subjects, IPs, or user agents
   are accepted or emitted.
4. Keep the output read-only and separate from performance scoring.

Slice C, visible surface only after pilot need:

1. Show aggregate adoption/acted/completed trends.
2. Include sample size and "association only" copy.
3. Hide individual usage frequency unless a separate owner-approved policy
   explicitly allows it.

## Stop Rules

Stop if the work:

- tracks every login as product evidence without policy,
- exposes individual login frequency to managers,
- changes performance/KPI scoring,
- implies app usage caused performance,
- stores tokens, cookies, provider subjects, IPs, or private payloads,
- creates a hidden surveillance surface,
- bypasses role/scope/action-store visibility,
- starts UI before the user starts UI/content direction,
- changes auth, API response shape, DB schema, provider config, or user
  workflow without explicit scope.

## Verification Ladder

Docs-only:

1. `git diff --check`
2. `npm.cmd run test:scripts`

Future aggregate helper:

1. unit tests for accepted/rejected fields and aggregation grain,
2. privacy guard test for forbidden fields,
3. `npm.cmd --prefix admin-web run lint`,
4. `npm.cmd --prefix admin-web run build`,
5. `npm.cmd run test:scripts`.

Visible surface:

1. aggregate helper gates,
2. targeted Playwright for role visibility and copy,
3. mobile viewport check,
4. evidence note showing no individual surveillance claim,
5. Codex review before merge.
