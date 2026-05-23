# Docs Library Metadata Standard V1

Status: active
Shelf: architecture
Last verified: 2026-05-23

## Reader And Action

Reader:

- a future agent, engineer, or product owner adding or updating long-lived
  project documentation.

After reading, they should know how to mark important docs so a cold reader can
tell whether a document is active, closed, parked, blocked, superseded, or
historical.

They should also know when a doc belongs in the library index, when it belongs
only in a domain shelf, and when it should stay as supporting evidence.

## Decision

Use lightweight metadata for important docs. Do not turn every note into a form.

Required for new shelf indexes, roadmap/control docs, go/no-go decisions, and
domain source documents:

```md
Status: active | guarded | closed | parked | blocked_external | superseded | historical
Shelf: operating | pilot | readiness | architecture | domain | evidence | historical
Use when:
Do not use when:
Last verified:
```

Optional when useful:

```md
Supersedes:
Superseded by:
Source of truth:
Verification:
```

## Status Meanings

- `active`: current source for decisions or execution.
- `guarded`: active and protected by tests or release checks.
- `closed`: completed and useful as reference, but not the next task.
- `parked`: intentionally not active until a trigger appears.
- `blocked_external`: needs real provider, token, data, or owner input.
- `superseded`: replaced by a newer decision.
- `historical`: kept for reconstruction, not for direction.

## Shelf Meanings

- `operating`: daily handoff, work discipline, and current next actions.
- `pilot`: controlled staging/internal pilot execution.
- `readiness`: release, provider, recovery, incident, and production posture.
- `architecture`: project shape, growth rules, contracts, and boundaries.
- `domain`: area-specific source documents and decision maps.
- `evidence`: proof files that support claims but do not choose direction by
  themselves.
- `historical`: reconstruction material that should not steer new work unless
  an active document points to it.

## Scope

Apply metadata first to:

- library and shelf indexes,
- controlled pilot execution docs,
- production/readiness decisions,
- feature-growth templates,
- architecture and source-of-truth boundaries,
- evidence registers,
- future docs that may otherwise be confused with active direction.

Do not bulk-edit every old file just to add metadata. Old files should be
marked when they are touched for a real reason or when an active doc needs to
supersede them.

## Guard Policy

The docs library guard should protect discoverability, not bureaucracy.

Guard:

- the main documentation library exists,
- active operating docs link to it,
- required shelf indexes exist,
- domain shelf docs declare a status,
- evidence register exists and keeps evidence safety rules,
- broad production remains separate from controlled pilot.

Do not guard:

- every possible evidence file,
- every old plan,
- wording that changes naturally during future pilot work,
- one-off scratch notes.

## Change Rule

When a doc changes active direction:

1. Update the doc itself.
2. Update the library index if a cold reader should start from it.
3. Update `current-state.md` only if future sessions need it immediately.
4. Update `docs/plans/active-next-actions.md` only if the next practical work
   changes.
5. Add or adjust a script guard only when drift would create real confusion.

## PR Checklist

Before merging a docs-library change:

- Reader and post-read action are clear.
- Status and shelf are explicit for important docs.
- The doc is linked from the narrowest useful shelf.
- Active direction is not hidden inside evidence-only notes.
- Parked or blocked work names its trigger.
- Superseded docs point to the newer decision when known.
- No raw token, cookie, password, provider secret, database URL, or Redis URL is
  recorded.
- `git diff --check` and the docs/script guard pass when applicable.

## Stop Rules

Stop and split the change when:

- a docs-only PR starts changing code, config, API, auth, DB, CSS, provider
  behavior, or user-facing workflow semantics;
- the library index becomes a dumping ground instead of a starting map;
- an evidence note is used to claim live readiness without real input;
- old historical docs are being bulk-edited without an active reader need;
- one PR mixes unrelated shelf taxonomy, product decisions, and runtime
  behavior.
