# Clerk Persona Evidence Status V1

## Scope

This historical note closed the feasible local-only part of Milestone 7 before
fresh real-token inputs were available in the system-flow readiness line.

It does not create Clerk users, capture tokens, run a fresh authenticated
staging smoke, change provider config, change auth mappings, change DB state,
or approve broad production rollout.

## Status Update - 2026-05-22

This blocker note is superseded by fresh live Clerk evidence in
`docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md`.

The later evidence reused the existing staging-only pilot Clerk accounts,
captured fresh local-only bearer tokens, verified four persona sessions/routes,
ran store-manager assigned/unassigned action-scope proof, and reran deployed
readiness with a real token. No raw token, Clerk cookie, password, provider
subject, or session storage dump was recorded.

## Status Update - 2026-05-23

The 2026-05-22 live evidence is now refreshed by
`docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`.

The newer pass first refreshed protected evidence for the available pilot
accounts, then upgraded the run to the full five-persona matrix after
`HR_ADMIN` and `REPORT_VIEWER` staging-only Clerk aliases were created and
bound through the approved app auth-admin API path. The final pass verified
real Clerk sessions for `SUPER_ADMIN`, `HR_ADMIN`, `STORE_MANAGER`,
`STORE_PERSONNEL`, and `REPORT_VIEWER`, reran same-session route allow/deny
checks, proved report-viewer `/store/tasks` is read-only, proved the
store-manager assigned/unassigned action-scope read path, and ran deployed
readiness plus backend protected load with real role-specific tokens.

No raw token, Clerk cookie, password, auth code, full provider subject, full
session storage, or private user/employee/store ID was recorded.

## Sokrates Decision

Decision:

- Do not fabricate Clerk evidence.
- Recognize the existing controlled staging Clerk persona evidence already in
  the repo.
- Record that the earlier session could not produce a fresh Clerk persona smoke
  because the required local-only bearer token and store-scope inputs were
  absent at that time.

Why:

- The runbook requires real staging Clerk sessions and local-only token input.
- That earlier shell did not have the required token or store-scope environment
  variables.
- Existing May 2026 evidence is meaningful for controlled staging/internal
  pilot posture, but it is not a fresh rerun and it is not broad production
  approval.

Evidence:

- `docs/plans/clerk-persona-staging-evidence-runbook-v1.md` defines the
  approved persona, token handling, smoke commands, evidence shape, and
  Go/Conditional Go/No-Go rules.
- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md` records real Clerk
  test-account route smoke for Super Admin, Region Manager, Store Manager, and
  Store Personnel personas.
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md` records
  ranking privacy evidence across the same controlled persona set.
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`
  keeps the broader decision at Conditional Go for controlled staging/internal
  pilot and No-Go for broad production rollout.
- The earlier shell preflight showed no `AUTH_SMOKE_BEARER_TOKEN`,
  `AUTH_SMOKE_ASSIGNED_STORE_ID`, `AUTH_SMOKE_UNASSIGNED_STORE_ID`,
  `AUTH_SMOKE_API_BASE_URL`, `READINESS_BEARER_TOKEN`,
  `READINESS_FRONTEND_URL`, `READINESS_BACKEND_URL`, or
  `BACKEND_LOAD_BEARER_TOKEN` values available.
- `npm.cmd --prefix admin-web run smoke:auth:staging:token-scope` failed
  closed with `AUTH_SMOKE_BEARER_TOKEN is required`, which is the correct
  behavior without a real local-only Clerk token.

Counterargument:

- A fresh automated Clerk token/action smoke would be stronger than this status
  note. That is true, but running it without a real staging token would create
  false evidence.

Risk:

- LOW for this docs-only status note.
- MEDIUM for future fresh staging smoke execution because it touches real auth
  sessions and protected endpoints.
- HIGH for provider config changes, role/scope widening, direct DB mutation to
  force a pass, or broad production approval.

Door:

- This note is a two-way door.
- Real provider/session evidence and auth/provider configuration changes are
  not casual two-way work.

Stop rule:

- Stop if a future smoke needs copied raw token evidence, full provider
  subjects, personal data, screenshots with session storage, widened scope, or
  direct DB edits made only to force the smoke to pass.

## Current Evidence Classification

| Evidence area | Status after 2026-05-22 live evidence | Accepted for | Not accepted for |
| --- | --- | --- | --- |
| Full five-persona Clerk route smoke | Freshly rerun in `clerk-persona-live-evidence-2026-05-23.md` | Controlled staging/internal pilot role evidence | Broad production rollout |
| Ranking privacy smoke | Existing controlled staging evidence from 2026-05-06 | Store-manager/store-personnel ranking privacy posture | Full auth/session edge coverage |
| Token-scope action smoke | Freshly rerun for store manager in `clerk-persona-live-evidence-2026-05-23.md` | Assigned/unassigned action-scope proof for the pilot store-manager persona | New-account onboarding proof |
| Deployed readiness auth/session | Freshly rerun with a real token in `clerk-persona-live-evidence-2026-05-23.md` | Staging auth/session readiness for the pilot token path | Broad production rollout |
| Backend protected load | Freshly rerun with role-specific tokens in `clerk-persona-live-evidence-2026-05-23.md` | Sampled controlled-pilot protected route health | Broad production latency/SLO approval |
| Clerk persona runbook | Complete enough to execute when inputs exist | Next operator execution guide | Evidence by itself |

## Historical Fresh Rerun Blockers

These were the required inputs before the fresh Milestone 7 rerun. They were
resolved for the current five pilot personas by reusing existing staging Clerk
test accounts where available, creating the missing staging-only HR/report
aliases through Clerk test-mode sign-in, binding them through the approved app
auth-admin API path, and collecting local-only template bearer tokens. They
still apply to any new account onboarding or non-pilot persona evidence.

- staging Clerk persona credentials through the approved secret channel,
- local-only `AUTH_SMOKE_BEARER_TOKEN` captured from an authenticated staging
  browser session,
- `AUTH_SMOKE_API_BASE_URL`,
- `AUTH_SMOKE_EXPECTED_ROLE`,
- `AUTH_SMOKE_ENVIRONMENT`,
- assigned and unassigned store IDs for action-scope proof,
- optional `READINESS_BEARER_TOKEN` for deployed readiness auth/session smoke.

No raw values should be committed, pasted into chat, or stored in docs.

## Decision

Milestone 7 earlier local-only result:

- Controlled Clerk persona evidence exists historically for the pilot route and
  privacy posture.
- Fresh current-session Clerk persona evidence is now closed for the current
  five-persona controlled staging matrix by
  `clerk-persona-live-evidence-2026-05-23.md`.
- Broad production remains No-Go under the existing production readiness
  decision until the broader external evidence set is rerun and accepted.

Next safe move:

- For new/non-pilot persona evidence, rerun the same runbook with fresh local
  Clerk sessions and record only sanitized results.
- Do not add auth code, provider config, DB edits, or fake evidence to force a
  pass.

## Verification

Docs/local checks:

- current shell environment preflight for required token/input variables,
- `npm.cmd --prefix admin-web run smoke:auth:staging:token-scope` fail-closed
  check without token,
- `git diff --check`,
- `npm.cmd run test:scripts`.

