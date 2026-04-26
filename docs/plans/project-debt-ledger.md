# Project Debt Ledger

## Purpose

This document counts the current project debt without mixing completed work, blocked external dependencies, and future product investments.

Rule:

- Completed means implemented, verified, documented, and committed.
- Blocked external means the local project is ready, but a real outside environment or credential is required.
- Watchlist means do not build yet; first confirm a real operator workflow.
- Strategic investment means important future product work, not a silent debt to rush today.

## Snapshot

Date: 26 April 2026

Current count:

- Closed active debts: 21
- Superseded before overbuilding: 1
- Blocked external dependency: 1
- Watchlist decision item: 1
- Strategic investment backlog: 3
- Silent untracked quality debt in the active gate: 0

## Closed Active Debts

These are counted as paid because they have implementation or documentation evidence and were committed.

1. Package Plan Source Visibility
2. Package Plan Pre-Approval Preview
3. Operational Feed V1
4. DM/CONFIG Boundary Note
5. Store/Region Competition Experience Polish
6. Turkish UI Localization Foundation V1
7. Local Keycloak Real-Provider And Action Evidence
8. PostgreSQL UUID DTO Validation Contract
9. Staging Auth Smoke Guard And Runbook
10. Official Release Check Gate
11. Staging Auth Evidence Operator Checklist
12. Staging Auth Evidence JSON Guard
13. Daily Closure Ranking V2 Explainability
14. Score Meaning V1
15. KPI Source Semantics V1
16. Store Score Threshold Language V1
17. KPI Interpretation Governance V1
18. KPI Config Editor Governance Preview V1
19. Ranking Completeness Segment Readiness V1
20. Shared Inbox Maturity V1
21. Store UX TR-First Copy V1

## Superseded Before Overbuilding

1. Competition Format Registry V1

Decision:

- Do not build a second ranking/scoring engine for simple UPT/ATV challenges in V1.
- Use Operational Feed challenge posts to announce the challenge.
- Let existing profile/ranking/summary surfaces show the performance truth.

This is a good deletion, not lost work.

## Blocked External Dependency

### Real IdP Staging Evidence

Status: `blocked_external`

Why it is not counted as completed:

- Real staging IdP registration values are not available in the repo.
- Real staging smoke credentials are not available in the repo.
- Seeded staging assigned/unassigned store IDs are not confirmed in a real staging DB.

What is already ready:

- `npm.cmd run smoke:auth:staging`
- `npm.cmd run smoke:auth:staging:action`
- `npm.cmd run guard:auth:evidence`
- operator checklist
- evidence template
- JSON guard against raw token/code/verifier/secret leakage

Completion command when external inputs exist:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

Exit criteria:

- PKCE login/logout passes against real staging IdP.
- `/api/auth/session` returns expected role, read scope, and action scope.
- assigned-store action returns success.
- unassigned-store action returns `403`.
- guarded evidence passes and is stored sanitized.

## Watchlist Decision Item

### Global Audit Feed Consideration

Status: `watchlist`

Decision:

- Do not build a global audit feed until an operator workflow proves it is needed.
- Existing feature-level audit trails are enough for current delivery.

Trigger to promote:

- HR/Admin needs one cross-module chronological event stream for real support, approval review, or incident investigation.

## Strategic Investment Backlog

These are important future product investments. They are not counted as hidden debt today because the current system is still deliberately growing from controlled foundations.

1. Real ingest connector and real payload contract
2. KPI config governance implementation: versioned config, effective dates, rollback, snapshot anchoring
3. Full production UI/design-system pass and complete EN/TR localization expansion

UI status note:

- A production UI/design-system strategy note now exists.
- Broad UI redesign is intentionally deferred.
- Future UI changes should be small reversible pilots until the backend/data foundation is stronger.

## Repo Hygiene Note

Current repo hygiene is not counted as active debt in this ledger because:

- `.gitignore` exists.
- generated `node_modules` and `dist` directories are ignored, not tracked.
- module and root release gates pass.

Still monitor:

- avoid committing local `.env` files
- avoid committing generated `dist` output
- keep `current-state.md` as handoff state, not a permanent product spec

## CODEX Honest View

The project is not debt-free in the sense that there is nothing left to build. It is debt-controlled.

The dangerous kind of debt would be:

- hidden auth assumptions
- unguarded release process
- second scoring engine
- unclear feed vs competition ownership
- raw auth evidence handling
- store-facing mixed-language trust gaps

Those have been actively reduced. The remaining work is mostly planned product depth, one real external staging proof, and a future coordinated visual/localization investment. That is a healthy place to be.

## Next Logical Step

If staging provider and seeded DB values are available, run the guarded staging action smoke.

If they are not available, the next local step should be chosen from strategic investments through the feature intake gate. Because broad UI polish is intentionally deferred, the strongest local backend candidate is now real ingest connector and payload contract intake. If real payload details are unavailable, move to KPI config governance implementation planning.
