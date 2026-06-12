# Security Launch Blocker PR Train V1 Closeout

Status: guarded
Shelf: readiness/security
Date: 2026-06-12

## Scope

This note closes the local implementation and guard portion of
`docs/plans/security-launch-blocker-pr-train-v1.md`.

The train replaced launch browser-session token persistence with a backend
cookie-session transport, added CSRF protection for cookie-authenticated unsafe
protected requests, added regression and evidence guards, and recorded that
real staging cookie-session evidence is externally blocked until approved live
inputs exist.

No broad production Go is claimed here. Broad production remains `No-Go`.

## PR Train

| Slice | PR | Merge commit | Result |
| --- | --- | --- | --- |
| PR-0 plan and control links | `#684` | `70109c43afc9e42ae3ec428ad9c67b777db3a3a1` | Added the security launch blocker train and linked it from operating docs. |
| PR-1 env/session contract and guards | `#685` | `93b1763b5cc04ace4b02ae5d65a77910def3bb59` | Documented and guarded the browser-session env contract while keeping `VITE_AUTH_MODE` and `VITE_BROWSER_SESSION_TRANSPORT` separate. |
| PR-2 backend browser-session foundation | `#686` | `512b8f1cff2bd4cb1ec8c4f1c4babbf33528b88d` | Added backend-owned app-session cookies, bounded TTL, host-only scope, CSRF rules, and shared DB authorization resolution. |
| PR-3 frontend cookie-session bridge | `#687` | `1b286556bdfe329e2f99cfd261b5b0c433f9c5fb` | Moved real browser sessions to cookie transport and removed launch provider token persistence from browser-readable storage. |
| PR-4 token-storage and evidence guards | `#688` | `d244b811e2f764605c1f5a2bc15c4b7ec5030d7a` | Added frontend token-storage regression coverage and hardened sanitized auth evidence guards. |
| PR-5 staging evidence status | `#689` | `5ae2695f230983022ba28ff851be3a2341fa35d9` | Recorded `blocked_external` because no approved real staging provider session or seeded assigned/unassigned inputs were available. |

PR-6 is this closeout/update-docs slice. It records the final state and does
not change runtime behavior.

## What Is Now True

- Real provider browser-session code paths are guarded against persisting
  bearer, id, access, refresh, or provider tokens in browser-readable storage.
- Backend app-session cookies are backend-signed, short-lived, host-only by
  default, and do not contain role, scope, store, or raw provider token data.
- Cookie-authenticated unsafe protected requests require CSRF proof.
- Cookie auth still resolves through the existing HR Axis DB role, scope, and
  assigned-store authorization path.
- Bearer support remains as a controlled rollback and script-smoke path during
  the migration window.
- Auth evidence guards reject raw cookies, token-shaped values, authorization
  codes, PKCE verifiers, provider subjects, and browser storage dumps.

## What Is Still Externally Blocked

Real protected staging cookie-session evidence remains `blocked_external`.

Required inputs are recorded in
`docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md`.

Until those inputs exist and a sanitized smoke passes, do not claim:

- real staging cookie-session proof,
- MVP/launch auth evidence fully closed from live provider behavior,
- broad production readiness.

## Verification Recorded During The Train

The train used the local and remote gates required by each PR class:

- targeted backend auth/session tests and backend build for PR-2;
- frontend lint, build, targeted auth/session script tests, Playwright checks,
  and root release gate for PR-3;
- targeted token-storage and auth-evidence guard tests for PR-4;
- `git diff --check`, `git diff --cached --check`, targeted contract tests, and
  `npm.cmd run test:scripts` for PR-5;
- GitHub release-check, release-rehearsal, Vercel checks, and Codex review
  before each merge.

PR-5 local verification:

```powershell
git diff --check # pass
npm.cmd run test:scripts -- --test-name-pattern "browser-session staging evidence|PR-5 browser-session|security launch train" # pass, 445/445
npm.cmd run test:scripts # pass, 445/445
git diff --cached --check # pass
```

## Final Decision

Launch browser-session security:

- Guarded locally.
- Runtime implementation and regression guards are merged.
- Real staging cookie-session evidence remains externally blocked.

Controlled pilot:

- May continue only within the existing scoped controlled-pilot boundary.

Broad production:

- Remains `No-Go`.
- This train does not close Redis, recovery, observability, final provider
  posture, incident ownership, or owner-acceptance requirements.

## Next Action

Default next action returns to the controlled pilot execution loop: run a real
or assisted scoped pilot session, record feedback, and fix concrete P0/P1
blockers only.

If the owner wants to close the remaining launch browser-session evidence gap,
provide the external inputs listed in the PR-5 blocked evidence note and rerun
the sanitized staging cookie-session smoke path. Do not use legacy bearer smoke
as proof that launch browser token storage is fixed.

## Rollback

Closeout rollback is docs-only: revert this note and the operating-doc links.

Runtime rollback for the implemented transport remains:

1. set `VITE_BROWSER_SESSION_TRANSPORT=bearer` for controlled rollback;
2. keep backend bearer verification active;
3. clear app-session and CSRF cookies;
4. revert the smallest failing behavior PR if needed;
5. record the rollback and rerun relevant auth/session gates.
