# Internal Change Visibility Operating Model V1

Status: operating_model_ready
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, pilot moderator, support operator, product owner, or engineer
  deciding how to explain project changes without asking operators to read
  GitHub.

After reading, they should know when a change needs an operator note, which
fields every note must carry, what must stay private, and when in-app release
notes are still not allowed.

## Sokrates Decision

Claim:

- Internal Change Visibility is useful now as a curated operating/evidence
  discipline, not as a new product module or in-app changelog.

Assumptions:

- Controlled pilot users need to know what changed when it affects their work,
  route visibility, evidence posture, or support instructions.
- UI redesign is parked.
- PR titles, commit messages, branch names, raw logs, and provider internals are
  not operator-ready content.
- Every change note must be tied to a merged PR, evidence file, plan, runbook,
  or verified release check.

Repo evidence:

- `current-state.md`, `docs/README.md`, `docs/plans/active-next-actions.md`,
  and the evidence shelf already provide project handoff structure.
- Product-progress evidence files already explain meaningful user-facing or
  operating changes in plain language.
- PR #499 and PR #500 show the current need: they are valuable future product
  intelligence work, but operators should not mistake them for visible UI.

Counterargument:

- A visible in-app "What's new" page could help later, but building it now would
  add UI work during the parked redesign phase and risks leaking internal
  implementation detail.

Risk:

- LOW for docs-only notes.
- MEDIUM for a future static in-app release note surface, because audience and
  privacy mistakes can confuse operators.
- HIGH for automatic commit-log release notes, provider-log exposure, or user
  notification behavior.

Door:

- Two-way for docs/evidence notes.
- One-way-ish for in-app notifications because noisy or wrong change messages
  reduce operator trust quickly.

Decision:

- Maintain operator-facing change visibility through curated docs/evidence for
  now.
- Do not add an in-app changelog until a pilot user or UI/content phase asks for
  it.
- Future in-app release notes must be static, curated, read-only, and sourced
  from accepted operator notes, not commits.

## Change Note Contract

Every operator-facing change note must answer:

1. What changed?
2. Who cares?
3. What can the user do differently now?
4. What did not change?
5. Which evidence proves it?

Required fields:

| Field | Meaning |
| --- | --- |
| Date | Calendar date of the accepted change or evidence note. |
| Audience | `pilot_moderator`, `support_operator`, `super_admin`, `hr_admin`, `region_manager`, `store_manager`, `store_personnel`, `report_viewer`, or `engineering`. |
| Category | `visible_behavior`, `route_scope`, `product_intelligence`, `readiness`, `support`, `docs_only`, `bugfix`, or `parked_decision`. |
| Plain summary | One or two sentences without branch names or implementation jargon. |
| Operator action | What the reader should do, if anything. Use `none` when it is informational. |
| Evidence | PR number, evidence file, plan, runbook, local gate, or provider proof. |
| Not changed | Explicitly name important behavior that did not change. |
| Risk/rollback | Whether this is reversible docs-only, read-only code, or behavior. |

## Audience Rules

- Pilot moderators get route, session, evidence, and known-friction notes.
- Support operators get troubleshooting, diagnostics, runbook, and incident
  posture notes.
- Store/region/admin users get only changes that affect what they can see, do,
  or trust.
- Engineering can see source docs and PRs, but operator notes should still be
  readable without code context.

Do not show a note to an audience if it would expose a forbidden route, private
payload, provider detail, secret, or internal-only role model.

## Allowed Sources

Allowed:

- merged PR URL or number,
- current-state entry,
- plan/runbook/evidence document,
- sanitized local gate output,
- sanitized staging/provider evidence,
- accepted owner decision.

Not allowed:

- raw commit logs as user-facing copy,
- branch names as product context,
- raw audit payloads,
- raw tokens, cookies, provider subjects, database URLs, Redis URLs, or private
  personal data,
- speculative future work as if already shipped.

## Publication Rhythm

Create or update an operator change note when:

- a visible route, role, or scope behavior changes,
- a pilot blocker is fixed or parked,
- a support/runbook procedure changes,
- a readiness posture changes,
- a new product-intelligence concept becomes ready for future UI intake,
- a broad feature is explicitly parked to avoid confusion.

Do not create a note for:

- purely internal refactors with no operator/support implication,
- dependency or formatting churn,
- speculative ideas that have no accepted decision,
- every small commit in a batch PR.

## Current Output Location

Use product-progress evidence for accepted notes:

```text
docs/evidence/product-progress/2026-05-24-internal-change-visibility-v1.md
```

This is not a runtime changelog. It is a curated handoff/evidence source for
pilot communication and future static release-note intake.

## Future In-App Release Notes

Allowed only if all conditions are true:

- user starts UI/content direction or pilot feedback asks for in-app change
  visibility,
- notes are curated from accepted operator change notes,
- the surface is read-only,
- no commit log, branch name, provider detail, or private infrastructure text is
  shown,
- role/audience filtering is explicit,
- there is a clear empty state and no notification spam.

First safe future code slice:

1. Add a static release-note data fixture generated manually from accepted
   operator notes.
2. Render it inside an existing support/admin context, not as a new broad
   product module.
3. Add targeted Playwright for audience visibility and no private text.

## Stop Rules

Stop if the work:

- wants to send notifications,
- exposes commit logs or branch names to operators,
- adds an in-app surface before UI/content direction,
- leaks provider/internal infrastructure details,
- implies a docs-only plan is shipped runtime behavior,
- mixes support-only notes with store-user notes without audience filtering,
- changes auth, API response shape, DB, provider config, CSS, or user workflow.

## Verification Ladder

Docs-only:

1. `git diff --check`
2. `npm.cmd run test:scripts`

Future static in-app notes:

1. docs-only gates,
2. `npm.cmd --prefix admin-web run lint`,
3. `npm.cmd --prefix admin-web run build`,
4. targeted Playwright for visibility, empty state, and private-text absence,
5. final local adversarial review and mergeability confirmation; do not request
   or await GitHub Codex review while the owner-disabled policy is active.
