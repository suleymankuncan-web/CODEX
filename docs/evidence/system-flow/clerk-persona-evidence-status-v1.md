# Clerk Persona Evidence Status V1

## Scope

This evidence closes the feasible local part of Milestone 7 in the system-flow
readiness line.

It does not create Clerk users, capture tokens, run a fresh authenticated
staging smoke, change provider config, change auth mappings, change DB state,
or approve broad production rollout.

## Sokrates Decision

Decision:

- Do not fabricate Clerk evidence.
- Recognize the existing controlled staging Clerk persona evidence already in
  the repo.
- Record that this session cannot produce a fresh Clerk persona smoke because
  the required local-only bearer token and store-scope inputs are absent.

Why:

- The runbook requires real staging Clerk sessions and local-only token input.
- This shell does not have the required token or store-scope environment
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
- Current shell preflight shows no `AUTH_SMOKE_BEARER_TOKEN`,
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

| Evidence area | Current status | Accepted for | Not accepted for |
| --- | --- | --- | --- |
| Four-persona Clerk route smoke | Existing controlled staging evidence from 2026-05-06 | Controlled staging/internal pilot role evidence | Broad production rollout or fresh current-session proof |
| Ranking privacy smoke | Existing controlled staging evidence from 2026-05-06 | Store-manager/store-personnel ranking privacy posture | Full auth/session edge coverage |
| Token-scope action smoke | Existing historical live smoke plus current fail-closed preflight | Proving the harness requires real token input | Fresh assigned/unassigned action proof today |
| Deployed readiness auth/session | Parked in current session | Runbook readiness once token exists | Claiming `/api/auth/session` is freshly proven |
| Clerk persona runbook | Complete enough to execute when inputs exist | Next operator execution guide | Evidence by itself |

## Fresh Rerun Blockers

Required inputs before a fresh Milestone 7 rerun:

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

Milestone 7 feasible local result:

- Controlled Clerk persona evidence exists historically for the pilot route and
  privacy posture.
- Fresh current-session Clerk persona evidence is blocked by missing real
  local-only token/session inputs.
- Broad production remains No-Go under the existing production readiness
  decision until the broader external evidence set is rerun and accepted.

Next safe move:

- When the user provides/obtains a fresh staging Clerk session token locally,
  rerun the runbook starting with store-manager token/action smoke.
- Until then, do not add auth code, provider config, or fake evidence.

## Verification

Docs/local checks:

- current shell environment preflight for required token/input variables,
- `npm.cmd --prefix admin-web run smoke:auth:staging:token-scope` fail-closed
  check without token,
- `git diff --check`,
- `npm.cmd run test:scripts`.

