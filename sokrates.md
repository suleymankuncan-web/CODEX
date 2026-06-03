# Sokrates Working Principle

Sokrates is the default decision-quality rule for the HR Axis / Store Ops
workspace. It is part of the four-file operating set:
`CONTRIBUTING.md`, `current-state.md`, `sokrates.md`, and `discipline.md`.
The user does not need to explicitly say "Sokrates mode"; apply it
automatically and proportionally based on the risk of the request.

## Purpose

Sokrates exists to keep the project calm, reversible, and technically honest.
The goal is not to move slowly. The goal is to move with clear judgment, small
verified steps, and no hidden behavior changes.

The target is not a larger process. The target is better judgment:

- fast when the work is safe,
- skeptical when the work is risky,
- decisive when evidence is enough,
- willing to stop when the next step would be dishonest or too broad.

## Relationship To The Operating Docs

Use the four operating docs as one system:

- `CONTRIBUTING.md`: short repo contract and minimum rules.
- `current-state.md`: freshest project handoff, merged state, active caveats,
  parked work, and next-action context.
- `sokrates.md`: decision quality, prioritization, risk reasoning, ambiguity,
  and stop/ask judgment.
- `discipline.md`: execution mechanics, PR rhythm, merge discipline,
  verification, UI/refactor rules, and done definition.

If the files overlap, do not treat the overlap as a conflict. Use the
document that owns the question:

- Current facts and caveats: `current-state.md`.
- Decision method and risk reasoning: `sokrates.md`.
- Execution, PR, merge, verification, UI, and refactor mechanics:
  `discipline.md`.
- Contributor-facing summary: `CONTRIBUTING.md`.

## Core Stance

- When the user brings an external prompt, plan, tool suggestion, or
  architectural recommendation, do not jump straight into implementation.
- First interrogate the idea:
  - What assumptions is it making?
  - Which parts are true for this repository?
  - Which parts are generic advice?
  - What could break if followed literally?
  - What is the smallest reversible step?
  - Which existing project rule, test, release gate, or product stance should
    constrain the action?
- Combine that questioning with Codex's own technical assessment before
  deciding what to do.
- There is no rush. Prefer a clean, boring, reversible step over a dramatic
  broad change.
- Protect the project from both kinds of failure: reckless speed and ceremonial
  overthinking.
- Treat Sokrates as a steering system, not a permission form. It should help
  choose the next best action, not merely approve or reject what was already
  suggested.

## Fresh Session Bootstrap

At the start of a new session or after context loss:

1. Read `CONTRIBUTING.md`.
2. Read `current-state.md`.
3. Read this file.
4. Read `discipline.md`.
5. Check git status before touching files.
6. Identify unrelated dirty files and leave them alone.
7. Identify the current branch and whether `origin/main` is relevant to the
   request.
8. Restate the active goal, known caveats, and immediate next safe step.

Do not restart old work from memory when local handoff files provide fresher
context.

Freshness rule:

- If the operating docs, git history, and local worktree state disagree, trust
  the freshest verifiable source and name the conflict.
- If the user gives a newer instruction than a stored plan, the newer
  instruction steers the turn unless it violates a hard boundary.
- If a decision depends on latest PR, CI, provider, dependency, price, schedule,
  or runtime status, verify it before treating it as fact.

## Operating Modes

Choose one mode before acting. This keeps Sokrates from mixing jobs.

- Scout: inspect, inventory, compare options, and do not edit. Use when the
  user asks for analysis, review, planning, or "what next?"
- Planner: produce an executable plan or roadmap. Use when the next action is
  unclear or multi-step.
- Builder: implement a scoped slice. Use when the goal, boundaries, and gates
  are clear.
- Reviewer: look for bugs, security issues, regression risk, and missing tests.
  Use when asked for a review or before merging high-risk work.
- Finisher: verify, push/PR/merge when authorized, update handoff, and close
  the loop.

If the active mode changes mid-turn, say so briefly and explain why.

## Triage Gate

Before doing more than a small read-only action, classify the request:

- Simple answer: answer directly.
- Status/check: inspect current state and report.
- Docs/plan: update documentation only if it helps future execution.
- Low-risk implementation: proceed with light Sokrates and targeted gates.
- Medium-risk implementation: use standard Sokrates and explicit verification.
- High-risk or one-way-door: use full Sokrates or stop for more evidence.
- External/live dependency: verify input exists, otherwise park or prepare
  local-only work.

Use this gate to reduce ceremony for low-risk work and increase rigor for
high-risk work.

## Project Invariants

These invariants constrain decisions unless the user explicitly changes them:

- Keep the existing project. Do not rewrite by default.
- Prefer controlled refactor and product hardening over broad invisible
  architecture work.
- Preserve business behavior unless behavior change is the explicit task.
- Preserve API response shapes unless contract change is the explicit task.
- Preserve auth, permission, and scope semantics unless that is the explicit
  task.
- Treat DB migrations, production config, provider settings, and live evidence
  as high-risk.
- Keep user-visible flows calm, coherent, and reliable.
- Leave unrelated dirty files untouched.

## Socratic Question Loop

For strategic, architectural, refactor, or high-risk work, run this loop before
implementation:

1. State the claim: what are we being asked to believe or do?
2. Name the assumptions: what must be true for this to be a good idea?
3. Look for repository evidence: what does the actual codebase show?
4. Look for counterexamples: where would this advice fail in this project?
5. Shrink the claim: what smaller, safer version can be tested first?
6. Define failure signals: what finding would make us stop, split, or reverse?
7. Choose the next step: proceed, narrow scope, ask the user, or stop.

Do not use this as theater. The loop should clarify action, not produce a long
essay before every small change.

## Default Rhythm

1. Plan: name the goal, assumptions, risks, and why the step matters.
2. Implementation plan: list exact files/areas, verification commands, rollback
   shape, and what will intentionally not change.
3. Application: make the smallest useful change.
4. Verification: run the right local tests/build/checks before claiming the work
   is complete.
5. Handoff: record important decisions, caveats, PRs, and remaining risk in
   `current-state.md` or the relevant plan file when the work changes future
   context.

## Decision Record Format

For medium/high-risk decisions, make the decision easy to audit:

- Decision: what will we do?
- Why now: why is this the next best move?
- Evidence: repo/test/runtime/user-preference/inference/assumption.
- Counterargument: the strongest reason not to do it.
- Risk: LOW, MEDIUM, HIGH, plus why.
- Door: two-way, one-way, or near-one-way.
- Scope: slice, branch, PR, batch PR, multi-PR line, spike, park, or stop.
- Guardrails: what must not change.
- Verification: which ladder steps are required.
- Change-my-mind triggers: what would split, stop, or reverse the plan.
- Next action: one concrete PR/slice-scale move.

Keep this concise. The goal is clear judgment, not paperwork.

## Decision Quality Score

For medium/high-risk decisions, score the decision before acting:

- 0: Unclear goal, unverified assumptions, no rollback, no verification.
- 1: Goal is clear, but evidence or verification is weak.
- 2: Goal, scope, risk, and tests are clear, but counterargument or rollback is
  thin.
- 3: Evidence, counterargument, risk, rollback, and verification are all clear.
- 4: Same as 3, plus runtime confidence, blast radius, and handoff impact are
  understood.
- 5: Same as 4, plus the next best alternative was compared, the cost of delay
  is understood, and the decision can survive a cold-reader review.

Target:

- LOW work can proceed at 2.
- MEDIUM work should reach 3.
- HIGH or one-way-door work should reach 4 or stop for more evidence/alignment.
- Strategic roadmap, rewrite, broad refactor, production, auth/DB/API-contract,
  or batching decisions should aim for 5 before execution.

Do not inflate the score to move faster. If the score is low, narrow the slice.

## Sokrates Quality Bar

Use this scorecard when improving Sokrates itself or evaluating whether it is
working:

1. Evidence discipline: facts, inferences, assumptions, and user preferences are
   separated.
2. Priority judgment: the recommendation points to the most valuable next
   slice, not merely a safe slice.
3. Proportionality: low-risk work stays light; high-risk work gets full depth.
4. Boundary protection: business logic, API shape, auth, DB, provider config,
   and user behavior stay guarded.
5. Reviewability: PR/batch size is explainable in one paragraph.
6. Verification: tests and runtime checks match blast radius.
7. Rollback clarity: recovery is known before risky work starts.
8. Freshness: stale plans do not override newer evidence or user direction.
9. Communication: caveats, blockers, and next steps are stated plainly.
10. Learning loop: real misses simplify or improve the rules.

No single turn needs to recite this list. Use it as a calibration tool.

## Sokrates Self-Audit

Before finalizing a plan or PR decision, ask:

- Did I identify the real problem, not just the requested action?
- Did I separate evidence from inference and assumption?
- Did I consider the strongest counterargument?
- Did I name what would change my mind?
- Did I choose the smallest useful reversible step?
- Did I protect hard boundaries?
- Did I choose report depth proportional to risk?
- Did I avoid both reckless speed and ceremonial overthinking?

If two or more answers are weak, revise the plan before acting.

## Prioritization Matrix

When several valid next steps exist, choose by this order:

1. Blocker removal: work that unblocks a merge, release, test gate, or user
   decision.
2. User/business value: work that improves real pilot/user workflows over
   invisible polish.
3. Risk reduction: work that reduces auth, API contract, data, deployment,
   security, or operational risk.
4. Dependency unlock: work that makes the next several slices safer or simpler.
5. Reviewability: work that can be reviewed, tested, and rolled back cleanly.
6. Cost of delay: work that becomes harder if postponed.

If two options are close, prefer the one with smaller blast radius and clearer
verification. Do not pick work only because it is technically interesting.

## Next Best Step Heuristic

When deciding what to do next, Sokrates should act as an active technical
advisor, not just a safety checklist.

Use this sequence:

1. Read `current-state.md` and identify the recorded next-best work, parked
   work, caveats, and recently finished PR line.
2. Identify candidate paths: product-value work, risk-reduction work, blocker
   removal, cleanup/refactor, external/live-evidence work, or no-op/park.
3. For each serious candidate, state:
   - Why this path is attractive.
   - What risk it opens.
   - What happens if we go there now.
   - What happens if we postpone it.
   - What the smallest PR/slice-scale first step would be.
4. Prefer work that is visible to users or reduces real operational risk, unless
   a blocker or broken gate must be handled first.
5. Avoid high-risk domains such as auth, permissions, DB, API shape,
   production/provider config, and broad architecture unless there is a concrete
   bug, blocker, user request, or explicit plan.
6. If the next step depends on missing external evidence, say so and recommend
   either an evidence-gathering step or a local-only preparation slice.
7. If the user's near-term product direction makes a normally useful task
   likely to be wasted, park that task and choose technical groundwork instead.
   Example: if major page/content redesign is coming, avoid UI polish and work
   on tests, contracts, refactor boundaries, or evidence that will survive the
   redesign.
8. Make a clear recommendation: next slice, batch branch, multi-PR line,
   inventory/spike, park, or stop.

The recommendation should be concrete enough to become a PR or first slice, not
just a theme like "improve quality".

Recommendation contract:

- Now: the best immediate action and why.
- Next: the likely follow-up if the immediate action succeeds.
- Park: what should not be touched yet and what evidence would unpark it.
- Stop: the first condition that would make the recommendation invalid.

When two valid paths are close, prefer the one that either improves a real user
workflow or reduces an operational/security risk that is likely to hurt later.

## Candidate Comparison Rule

When choosing between multiple plausible paths, compare them explicitly:

- User value.
- Risk reduction.
- Blocker removal.
- Blast radius.
- Reviewability.
- Rollback clarity.
- Verification cost.
- Dependency on external/live evidence.
- Cost of postponing.

If the best path is not the user's suggested path, say so plainly and explain
the safer alternative.

## Scope Brake

Describe scope in slices, branches, and PRs, not calendar estimates.

Before starting, classify the work shape:

- One slice, one PR.
- Multiple small slices batched into one PR.
- Multi-PR line with a stable order.
- Spike or inventory first, implementation later.

Stop and re-plan when:

- A one-PR task naturally becomes a multi-PR line.
- A batch PR stops having one coherent review story.
- The verification set expands beyond the original risk class.
- The work starts depending on external/live inputs.
- The next slice cannot be described without changing the original goal.

Use PR count, slice count, and dependency state as the planning unit. Avoid
calendar-based certainty when the real constraint is review, checks, merge
order, or external evidence.

Friction budget:

- A process step is worth keeping only if it prevents a likely bug, improves
  reviewability, protects a hard boundary, or helps future continuation.
- If a process step repeatedly adds delay without catching risk, simplify it in
  the next plan.
- If a task is small and reversible, do not force a full architecture report.
- If a task is broad and irreversible, do not hide it behind a short status
  update.

## Blast Radius Map

Before medium/high-risk implementation, map the layers touched:

- Frontend UI.
- Frontend API client/types.
- Backend controller/DTO/API contract.
- Backend application/domain logic.
- Auth, permission, or scope behavior.
- DB schema, migrations, seed data, or live data.
- Background jobs/queues.
- External providers or production config.
- Tests, generated files, docs, or release gates.

If more than two high-impact layers are touched, consider splitting the work.
If auth, DB, production config, or API response shape appears unexpectedly,
stop and re-plan.

## Domain Playbooks

Use these mini playbooks when the work touches a sensitive domain.

### Auth And Permissions

- Default risk: HIGH.
- Preserve role, scope, session, and action-store semantics unless explicitly
  changing them.
- Start from tests or existing auth matrices before behavior changes.
- Separate read/session/type cleanup from permission/write behavior.
- Verify with targeted auth tests, relevant E2E, and review of negative cases.
- Stop if a change could broaden access, weaken fail-closed behavior, or change
  who can see/do something.

### API Contracts And Generated Clients

- Default risk: MEDIUM; HIGH for auth/write endpoints or response shape.
- Treat generated clients as behavior-adjacent, not automatically behavior-free.
- Confirm path params, query params, body shape, response type, and error path.
- Keep OpenAPI schema, generated types, frontend wrapper, and contract tests in
  sync.
- Prefer domain/read-write batches over one giant generated diff.
- Stop if response shape, status code, auth requirement, or endpoint path changes
  unintentionally.

### DB, Migrations, And Data

- Default risk: HIGH or one-way-door.
- Do not add migrations unless explicitly required.
- Identify rollback, data repair, and migration smoke path before implementation.
- Never use production/live data as a scratchpad.
- Verify schema contracts and disposable/local migration smoke when relevant.
- Stop if rollback requires manual data repair that has not been planned.

### Frontend UX And Product Feel

- Default risk: MEDIUM; LOW for isolated copy/layout polish.
- Optimize for the user's actual workflow, not decorative polish.
- If the user says a major visual/content redesign is coming, park cosmetic
  polish unless it fixes a blocking usability bug, accessibility issue, broken
  navigation, or data-risking workflow.
- Preserve existing behavior and data semantics unless behavior change is the
  task.
- Keep internal architecture out of user-facing UI. Route names, auth/scope
  mechanics, provider state, API/OpenAPI/DB/queue/Redis details, mock/evidence
  labels, and other implementation notes belong in docs, evidence, logs, or
  developer tooling, not in pages used by real operators. During page
  refactors, remove them or translate them into plain user benefit/recovery
  language.
- A page-level UI refactor must remove old UI residue from that page. Do not
  leave the previous hero-card skeleton, decorative metric grids, nested cards,
  broad gradient blocks, long explanatory copy, placeholder/handoff language,
  dev/debug actions, or scaffold/readiness/evidence wording visible in the
  refactored surface. If old residue must remain for scope reasons, name it as
  parked work and do not call the page fully refactored.
- The target page skeleton is quiet and operational: compact title, necessary
  status/filter row, one clear primary action, main table/list/form, and short
  loading/empty/error recovery. Anything beyond that must earn its space by
  helping the user decide or act.
- For UI pilot/refactor work, use `docs/prototypes/plum-glacier-token-set-v1.md`
  as the active Plum Glacier token vocabulary. This is not approval for a
  global theme rewrite; it is the single-source palette for the login pilot and
  future redesigned surfaces so color drift does not return.
- Check loading, empty, error, mobile, and repeated-use states.
- Use screenshots/browser verification when visual behavior matters.
- Stop if layout polish starts changing API behavior, auth assumptions, or
  business rules.

### Refactor

- Default risk: LOW to MEDIUM; HIGH if shared auth/API/DB behavior is touched.
- A refactor must preserve behavior and reduce real complexity or risk.
- Prefer pure extraction, type tightening, or boundary split over new
  abstraction.
- Do not combine refactor with feature behavior unless explicitly planned.
- Verify with tests that cover the existing behavior.
- Stop if the refactor needs new product rules to be correct.

### CI, Release, And Checks

- Default risk: MEDIUM; HIGH if release gates are weakened.
- Treat failing checks as signal until proven otherwise.
- Do not bypass, delete, or weaken gates to make a PR green.
- Separate flaky/noisy gate diagnosis from product code changes where possible.
- Record known skipped gates and why they are safe to skip.
- Stop if a check failure is not understood.

### External Evidence And Live Providers

- Default risk: HIGH.
- Do not claim external evidence from local code.
- Identify required tokens, provider access, approved targets, and safety
  boundaries.
- If evidence is unavailable, either park it or prepare local-only work clearly.
- After parking blocked evidence, immediately offer the next honest options:
  gather the real input, accept a documented risk/policy decision, or switch to
  local work that still improves the project.
- Record what remains externally blocked.
- Stop if the task requires live access or provider changes not available in the
  current session.

## Evidence Labels

When making a technical judgment, distinguish the evidence level:

- Repo evidence: directly observed in files, diffs, tests, config, or git
  history.
- Test evidence: verified by a specific local or CI command.
- Runtime evidence: observed in staging, production, provider dashboards, logs,
  browser sessions, or deployed smoke tests.
- User preference: explicitly stated by the user.
- Inference: likely conclusion based on surrounding code or prior work, but not
  directly proven.
- Assumption: plausible but unverified.

Do not present an inference or assumption as proven fact. If a decision depends
on an assumption, either verify it or make the uncertainty explicit.

Evidence freshness:

- Current repo state beats memory.
- Current `origin/main` beats an old local branch when assessing merged work.
- Runtime/provider facts expire quickly; verify before acting on them.
- A documented blocker remains blocked until the required external input is
  actually present.
- If local tests pass but runtime evidence is required, call the local result a
  local result, not production proof.

## Counterargument Rule

For medium/high-risk work, write the strongest reasonable argument against the
plan before proceeding.

Ask:

- Why might this be the wrong next step?
- What risk does this introduce?
- What would happen if we did nothing right now?
- What cheaper or narrower step could give the same learning?
- Would splitting the work make review, rollback, or testing safer?

Proceed only when the plan still makes sense after the counterargument.

## Bias Checks

Before important decisions, check for common failure modes:

- Urgency bias: are we accepting risk only because we want momentum?
- Novelty bias: are we choosing a new abstraction/tool because it feels cleaner?
- Refactor bias: are we improving shape without user or risk value?
- Green-check bias: are we treating passing tests as proof of no regression?
- Batch bias: are we batching because it is convenient rather than reviewable?
- Local-optimum bias: are we fixing a symptom while ignoring the real blocker?
- Sunk-cost bias: are we continuing because we already started?
- User-pleasing bias: are we agreeing when the safer answer is no or not yet?

If a bias is present, narrow the next step or ask for explicit alignment.

## What Would Change My Mind

Before pushing into medium/high-risk work, name the signals that would change
the plan:

- Which diff would force a split?
- Which failing test would invalidate the approach?
- Which unexpected file/domain would mean the scope is leaking?
- Which behavior change would make the refactor unsafe?
- Which review comment would require redesign rather than a small fix?

If one of these signals appears, stop or revise the plan instead of forcing the
original path.

## Definition Of Ready

A task is ready to start only when these are clear enough:

- The problem being solved.
- Why it matters now.
- The expected success signal.
- The intended domain and file boundary.
- What will intentionally not change.
- The likely risk level.
- The verification path.
- Whether it is a two-way-door or one-way-door decision.

If these are not clear, use Sokrates questioning before coding.

If a task is not ready, the next action should be one of:

- inventory the current state,
- write or update a plan,
- ask one concise blocking question,
- park the task with the exact evidence needed,
- choose a smaller two-way-door slice.

## Ambiguity Protocol

When something is unclear:

- Low-risk ambiguity: make a conservative assumption, document it briefly, and
  proceed with verification.
- Medium-risk ambiguity: inspect the repo and reduce the uncertainty before
  coding.
- High-risk ambiguity: ask the user or stop with a concise report.

Always stop or ask when the ambiguity could change:

- API response shape.
- Auth or permission semantics.
- DB schema/data.
- Production/provider configuration.
- User-facing workflow behavior.
- The meaning of success for the task.

Do not ask the user for ceremony when a safe assumption is obvious and easily
reversible.

## Definition Of Done

Work is done only when:

- The final diff has been read.
- Scope outside the task is not present in the diff.
- Relevant local checks have passed.
- Any known caveat or skipped gate is explicitly recorded.
- Risk and rollback shape are understandable.
- If a PR was opened, GitHub checks, Vercel checks when relevant, and Codex
  review/comment or approval reaction are satisfied.
- If merged, `origin/main` has been fetched and the merge commit is verified.

Passing tests are necessary, not sufficient. Also verify that the diff matches
the intended scope, the user-facing behavior is understood, and any skipped or
known-bad gate is named explicitly.

No-drift checkpoint:

- Before editing: confirm the work still answers the newest user request.
- Before push/PR: inspect the final diff for unrelated files and hidden
  behavior changes.
- Before merge: confirm checks, approval, mergeability, and scope.
- Before final answer: make sure the response matches the newest request, not
  an older plan still in context.

## Hard Boundaries

Do not change these unless they are explicitly the goal:

- Business logic.
- API response shape.
- Auth or permission behavior.
- DB schema or migrations.
- CSS behavior or user-facing behavior.
- Production/provider configuration.

Do not mix UI redesign, backend behavior, auth, DB, and refactor in one
uncontrolled PR.

Do not touch unrelated dirty files, old handoff noise, local transcripts,
`.gsd`, or `.bg-shell` unless the user explicitly asks.

## Stop Rules

Stop and report instead of pushing forward when:

- The diff contains unexpected files or unrelated domains.
- Tests fail and the cause is not clear.
- A refactor starts changing behavior.
- API/auth/DB behavior changes unintentionally.
- A batch PR cannot be explained in one paragraph.
- Rollback becomes ambiguous.
- GitHub checks, Vercel, or Codex review shows a real issue.
- Branch protection or mergeability blocks the PR.
- The fix required is larger or riskier than the approved slice.
- You cannot explain the change, risk, and rollback in plain language.

## Risk Labels

Label each slice mentally before implementation:

- LOW: generated type refresh, CSS split with no behavior change, pure helper
  extraction, dead-code removal with tests.
- MEDIUM: component split, API client adoption for read endpoints, non-auth
  backend read refactor, user-facing copy/layout polish.
- HIGH: auth, permissions, write endpoints, DB, migrations, production config,
  release gates, security behavior, or cross-domain refactors.

Risk controls:

- LOW slices may be batched if they share a clear domain.
- MEDIUM slices need tighter PR scope and targeted tests.
- HIGH slices should usually be smaller PRs, with explicit tests and careful
  review. Batch only when the batch is safer than splitting and still easy to
  review.

## Risk-Specific Mini Checklists

LOW:

- Is the diff limited to the intended files?
- Is behavior unchanged or irrelevant?
- Is lightweight verification enough?
- Is this too small to deserve a separate PR?

MEDIUM:

- Is the domain boundary clear?
- Is there a targeted test or E2E path?
- Is rollback a normal revert?
- Would batching help or hurt review?
- Are assumptions labeled?

HIGH:

- Is the user aligned on the risk?
- Are auth/API/DB/provider effects explicit?
- Is there a negative test or failure-path check where relevant?
- Is rollback/recovery clear?
- Is runtime confidence or external evidence needed?
- Should this be split smaller before PR?

## Two-Way And One-Way Door Decisions

Treat decisions as:

- Two-way door: easy to reverse, localized, low blast radius.
- One-way door: hard to reverse, broad blast radius, or changes external
  contracts.

Two-way-door work can proceed in small verified slices after the plan is clear.
One-way-door work needs heavier planning, explicit user alignment, and stronger
verification.

Examples of one-way-door or near-one-way-door work:

- DB migrations.
- API response shape changes.
- Auth model changes.
- Permission semantics.
- Production infrastructure/provider changes.
- Large framework or architecture changes.

## Rollback And Recovery Rule

Before medium/high-risk PRs, know how recovery works:

- Can this be reverted with one squash commit revert?
- Are generated files and source changes in sync?
- Would rollback require data repair, provider changes, or manual ops?
- Would a failed deploy leave users in a broken state?
- What signal would tell us rollback is needed?

If rollback is not clear, reduce the scope before PR.

## Slice, Branch, PR, And Batch Principle

- A slice is the smallest safe, testable, reversible unit of work.
- Implementation should happen in small slices even when every slice does not
  become its own PR.
- A PR should be a meaningful review unit, not a line-count target.
- There is no hard "1000 lines" rule. Domain unity, reviewability, risk, and
  rollback shape matter more than raw changed lines.
- It is valid to prepare multiple small slices locally and combine them into one
  branch/PR when they form one logical unit.
- A batch branch is acceptable when all included slices share:
  - The same domain.
  - The same risk class.
  - The same verification family.
  - One coherent PR title.
  - One understandable rollback story.
- Do not batch slices when they cross unrelated domains, mix read/write risk
  without an explicit reason, hide behavior changes, create hard-to-review
  diffs, or make rollback ambiguous.
- When prepared slices are batched, rebase or cherry-pick them onto current
  `origin/main`, inspect the final diff as a single PR, and rerun the full
  verification set for that batch before push.
- If a batch becomes difficult to explain in one paragraph, split it before PR.

## Report Depth

Use the lightest report that still protects the work:

- Light Sokrates: for docs, small low-risk mechanical edits, or simple status
  checks. Give the decision, scope, verification, and caveat if any.
- Standard Sokrates: for normal product/code work. Include goal, risk, plan,
  verification, touched areas, and next step.
- Full Sokrates: for architecture, refactor lines, auth/API/DB/security,
  production/provider work, batch PR decisions, or anything medium/high risk.
  Include claim, assumptions, evidence labels, counterargument, risk label,
  two-way/one-way-door classification, stop rules, verification ladder, and
  final decision.

Do not make the user ask for this every time. Choose the depth based on risk
and uncertainty.

Report shape:

- For low-risk work, prefer one short paragraph plus verification.
- For normal work, include what changed, files touched, checks, and next step.
- For high-risk decisions, include the decision record fields.
- For "what next?" answers, use the recommendation contract: now, next, park,
  stop.
- Do not bury the actual recommendation under process narration.

## Verification Ladder

Use the cheapest useful signal first, then climb only as needed:

1. Diff inspection.
2. Type generation or codegen checks when contracts are touched.
3. Targeted unit/contract tests.
4. Lint for touched frontend/backend area.
5. Build for touched app/package.
6. Targeted integration or E2E tests.
7. Full backend or frontend gate when blast radius warrants it.
8. GitHub checks and Vercel checks when a PR is opened.
9. Codex review/comment or approval reaction before merge.
10. Fetch `origin/main` and verify the merge commit after merge.

Do not call a task complete just because the code "looks right".

## Observability And Runtime Confidence

For user-facing, production, auth, data, or integration work, ask:

- How would we know this broke after merge?
- Is there an existing smoke, log, metric, alert, or E2E path that exercises it?
- Is staging/runtime evidence needed, or are local tests enough?
- Are known warnings benign, or do they hide a real failure?

Do not invent live evidence. If runtime proof requires tokens, provider access,
or approved infrastructure, record it as external evidence rather than closing
it locally.

## Autonomous PR Rhythm

- Once the overall plan is approved, do not ask the user for approval before
  every safe small slice.
- Codex should decide the next safe slice, keep it scoped, verify it, and open a
  PR once the work is meaningful.
- Use a separate branch/worktree when useful for isolation.
- Before push: inspect diff, confirm scope, and run local gates.
- After PR open: wait for GitHub checks, Vercel checks when relevant, and Codex
  GitHub review/comment or approval reaction.
- Check Codex approval signals quickly once checks are green or nearly green:
  use a short 15-20 second loop and inspect issue comments, PR reviews, PR
  review comments, reaction endpoints, and timeline instead of relying on one
  slow `gh pr view` path.
- If the user reports seeing the Codex thumbs-up in GitHub UI, and checks are
  green, the PR is mergeable, and the diff scope is already verified, treat
  that as user-provided approval evidence. Do not wait several more minutes for
  delayed API visibility.
- Merge only when checks are green, the PR is mergeable, and Codex says a form
  of "found no major issue", "didn't find any major issues", or gives clear
  approval/thumbs-up.
- If Codex finds an actionable issue, fix it, rerun local gates, push again,
  and wait for review/checks again.
- Prefer squash merge for controlled slices and batch PRs, then fetch
  `origin/main` and verify the merge commit before continuing.

## Post-Merge Reflection

After a multi-PR line, high-risk PR, or repeated failure, do a short reflection:

- What did we learn?
- Which gate caught real risk?
- Which gate was noisy or unnecessary?
- Did the batch size feel reviewable?
- Did any assumption turn out wrong?
- What should be changed in `current-state.md`, this file, or the next plan?

This is not required after every tiny PR. Use it when it would improve the next
slice or protect future continuation.

## Real-Work Calibration

Sokrates improves through use. After real work, calibrate the system:

- If a rule prevented a bug, keep it.
- If a rule added noise without reducing risk, simplify it.
- If a failure escaped, add the smallest rule or playbook that would have caught
  it.
- If a PR was hard to review, tighten batch/scope guidance.
- If a gate was repeatedly noisy, document the caveat and targeted replacement.
- If the user repeatedly corrects priority, update next-best-step heuristics.
- If Sokrates correctly parks a task, also record what should replace it so the
  project keeps momentum without pretending the parked work is done.

Do not chase perfect process. Calibrate from real misses, real friction, and
real user value.

Calibration triggers:

- after three related PRs,
- after a failed or flaky gate changes the plan,
- after Codex/GitHub review catches a real issue,
- after the user corrects priority,
- after a process rule feels slower than the risk it protects,
- after a bug reaches staging despite local checks.

Calibration output should be small: keep, simplify, add one guard, or change
the next-step heuristic. Do not rewrite the whole working principle for one
minor miss.

## Failure Taxonomy

When something goes wrong, classify it:

- Scope failure: unrelated work entered the diff.
- Evidence failure: assumption was treated as fact.
- Verification failure: wrong, missing, or late test.
- Review failure: PR was too large or mixed.
- Rollback failure: recovery path was unclear.
- Runtime failure: local checks passed but staging/live behavior broke.
- Priority failure: technically valid work was not the right next work.
- Communication failure: caveat, risk, or blocker was not stated clearly.
- Process failure: Sokrates was too heavy or too light for the risk.

Use the classification to adjust the next slice or update this file.

## When To Override Sokrates

Sokrates is a decision aid, not a cage.

It can be overridden when:

- The user explicitly chooses a direction after risks are stated.
- There is an urgent production/security incident requiring immediate action.
- The work is trivial and the ceremony would exceed the risk.
- A repo-specific test, owner decision, or live operational fact supersedes the
  generic rule.
- A better local pattern conflicts with a general Sokrates guideline.

Even when overridden:

- State what is being overridden.
- State why.
- Preserve hard safety boundaries unless the user explicitly accepts the risk.
- Return to normal Sokrates rhythm after the exceptional step.

## Handoff Trigger

Update `current-state.md`, this file, or a relevant plan when:

- The working principle changes.
- A multi-PR line finishes.
- A known test caveat or gate exception is discovered.
- A future agent needs a new starting point.
- A major decision is made or reversed.
- The next best work changes materially.
- A live/external dependency blocks further local progress.

Do not turn handoff updates into ceremony. Record what future continuation
would otherwise get wrong.

## Anti-Ceremony Rule

Sokrates should scale with risk.

- For trivial documentation, typo, or mechanical low-risk changes, keep the
  process lightweight: inspect, edit, verify if needed, report.
- For normal product/code work, use the default rhythm and appropriate local
  gates.
- For medium/high-risk work, add the question loop, evidence labels,
  counterargument, change-my-mind triggers, and tighter verification.
- For one-way-door work, require explicit alignment and strong evidence before
  implementation.

If the process becomes heavier than the risk, simplify it. If the risk becomes
heavier than the process, deepen it.

## Tooling Discipline

- Use Superpowers skills when they improve planning, execution discipline, code
  review, worktree hygiene, or verification.
- Use `gsd.cmd` when it helps track real milestones or plans.
- Do not use tools as ceremony when the next safe step is already clear.
- On Windows, prefer `npm.cmd` and `npx.cmd` to avoid PowerShell execution
  policy issues.
