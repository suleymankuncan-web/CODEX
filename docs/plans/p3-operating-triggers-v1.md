# P3 Operating Triggers V1

Status: active
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, engineer, operator, or product owner deciding whether a
  low-priority operating idea should become real work.

After reading, they should know which P3 items are intentionally trigger-only,
what event promotes each item, and what must not be built speculatively.

## Sokrates Decision

Claim:

- P3 work is not low-value; it is low-urgency until a real trigger appears.

Assumptions:

- The project is in controlled pilot execution mode.
- Broad UI redesign, broad production, and new modules remain parked.
- P0/P1/P2 work has already mapped the trust, operator-support, and product
  intelligence lines.

Evidence:

- Release gates, repo hygiene, system-flow, route-role matrix, pilot evidence,
  and readiness docs already guard the core operating flow.
- P3 items are mostly cadence, policy, or monitoring questions that become
  useful only when real pilot or production pressure appears.

Counterargument:

- Writing these down can feel bureaucratic. The alternative is worse: future
  sessions rediscover the same "should we do this now?" questions and risk
  opening random work.

Risk:

- LOW for this docs-only trigger map.
- MEDIUM if future agents treat trigger-only rows as permission to implement.

Door:

- Two-way for docs and checklists.
- One-way-ish if a trigger introduces dependency upgrades, migration policy, or
  broad support commitments without owner acceptance.

Decision:

- Keep all P3 items parked until their trigger occurs.
- When a trigger occurs, open one narrow PR with one owner, one verification
  ladder, and one rollback story.

## Trigger Matrix

| P3 item | Why it matters | Trigger to open | First safe slice | Stop before |
| --- | --- | --- | --- | --- |
| Migration policy refresh | Prevent schema-change fear and release drift. | A DB migration touches auth, scoring, import, Store Action, checklist, or workforce lifecycle tables; or release smoke catches migration uncertainty. | Update migration runbook/evidence checklist; run fresh DB smoke if schema changed. | Changing migration executor or production DB policy without owner acceptance. |
| Dependency cadence | Avoid surprise breakage from stale frontend/backend packages. | Security advisory, Node/Playwright/Vite/Nest major change, or release gate dependency pain. | Inventory outdated packages and propose batch groups. | Broad dependency upgrade without a rollback plan and CI evidence. |
| Browser/device support matrix | Keep pilot UX expectations honest. | Pilot expands beyond known desktop/mobile browsers or reports device-specific breakage. | Document supported browser/device set and one smoke route list. | Full visual redesign or device lab work without user starting UI phase. |
| Evidence automation index | Make evidence repeatable without faking live proof. | Same evidence command is manually repeated three times or a release is blocked by "which smoke do I run?" confusion. | Add index/runbook mapping existing commands to evidence outputs. | Treating mocks/local checks as provider or protected-user evidence. |
| Freeze windows | Reduce release risk during live pilot moments. | Pilot sessions become scheduled, customer-facing, or operationally sensitive. | Document release freeze / emergency exception rules. | Blocking urgent P0 fixes or inventing a heavy release bureaucracy. |
| Manual override policy | Keep support actions from becoming hidden admin powers. | A real support request needs correction, rerun, unblock, or operator override. | Decision doc: allowed roles, audit, source of truth, rollback, and evidence. | Adding bypass UI or DB write tools without audit and owner approval. |
| Pilot triage cadence | Keep feedback moving without overreacting. | There are recurring pilot sessions or more than five open pilot findings. | Define weekly or per-session triage ritual and status labels. | Turning pilot feedback into a full ticketing system before needed. |
| Mutable Norm Kadro / staffing baseline | Prevent staffing planning from becoming shadow workforce config. | Business owner asks to edit staffing baselines, produce recommendations, or generate Store Actions from headcount gaps. | Docs/spec for ownership, source data, approval path, and read-only preview. | DB writes, auto actions, payroll/scheduling, or labor-policy logic without separate go/no-go. |
| Protected performance rerun | Keep staging/broad-readiness claims current. | Auth/provider/env/readiness profile changes, broad-production request, or real pilot latency complaint. | Run existing protected performance/load smoke with role-specific tokens and sanitized output. | Sharing raw tokens or treating public-only smoke as protected evidence. |
| App-level error tracking provider | Improve broad-production diagnosis. | Broad production is requested or current platform logs are insufficient for incident diagnosis. | Follow P0 trust operations provider/destination/redaction/owner decision. | Adding SDK/provider config without accepted redaction and owner path. |

## Operating Rule

P3 items should not compete with concrete pilot blockers.

Promote a P3 item only when:

1. the trigger is real and dated,
2. the owner is known,
3. the expected artifact is clear,
4. the verification ladder fits the risk,
5. the PR can be described in one paragraph.

## Verification Ladders

Docs-only P3 slices:

1. `git diff --check`
2. `npm.cmd run test:scripts`

Dependency or migration slices:

1. targeted package/build/migration smoke,
2. impacted backend/frontend tests,
3. root release gate if runtime code or schema changed.

Provider/protected evidence slices:

1. runbook first,
2. real input from owner/user/provider,
3. sanitized smoke output,
4. explicit Go / Conditional Go / No-Go decision.

## Non-Goals

- No new product module.
- No broad UI redesign.
- No DB migration.
- No provider config.
- No auth/permission semantics change.
- No hidden support bypass.
- No production Go claim.

## Next Recommendation

Leave P3 parked. The next real work should still come from controlled pilot
sessions, P0/P1 blockers, or an explicitly chosen read-only Daily Command Brief
slice after the UI/content direction starts.
