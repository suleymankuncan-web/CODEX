# Staging Auth Session Edge Evidence Guard V1

## Purpose

This guard keeps staging logout and expired-token behavior tied to the controlled pilot evidence path. It records what the existing staging auth smoke already proves, what the evidence guard must reject, and where operators must link the sanitized result.

Decision sources:

- `docs/plans/phase-7-staging-auth-smoke-runbook.md`
- `docs/plans/phase-7-auth-evidence-template.md`
- `admin-web/scripts/auth-live-smoke.mjs`
- `admin-web/scripts/auth-evidence-guard.mjs`

Controlled staging/internal pilot: `Conditional Go`.

Broad production rollout: `No-Go`.

This guard does not approve broad production rollout. It only protects the auth session edge evidence required before pilot expansion or production sign-off.

## Evidence Commands

Run staging provider login/logout evidence:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging
```

Run staging provider evidence plus assigned-store action evidence:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging:action
```

Guard sanitized JSON evidence before approving or storing it:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run --silent smoke:auth:staging:action | npm.cmd run --silent guard:auth:evidence -- --stdin
```

## Required Edge Evidence

Logout edge evidence:

- provider logout is requested with an `id_token_hint`,
- browser returns to `/auth/login`,
- no browser-readable token storage exists for provider sessions after logout;
  the legacy bearer/id-token storage checks must both report `false`.

Expired-token edge evidence:

- expired bearer JWT is cleared,
- provider id token is cleared with the expired bearer session,
- API requests do not include `Authorization: Bearer <expired-jwt>`,
- browser lands on `/auth/login` or the approved session-recovery route,
- browser refresh token is not used.

## Evidence Safety

No raw bearer tokens may be stored.

No raw id tokens may be stored.

No refresh token may be requested, stored, logged, or attached.

No raw authorization codes, PKCE `code_verifier` values, client secrets, cookies, private keys, browser storage dumps, provider subjects, full JWTs, or private personal data may be pasted into evidence.

Only sanitized JSON from the smoke script may be copied into a dated evidence note after `guard:auth:evidence` passes.

## No-Go Rules

No-Go if logout cannot return safely to `/auth/login`.

No-Go if browser-readable bearer, provider, id, access, or refresh token storage exists for provider sessions after logout.

No-Go if expired bearer token evidence sends an API `Authorization` header.

No-Go if a browser refresh token is requested or used in the first real staging IdP smoke.

No-Go if raw token, cookie, authorization code, verifier, secret, or private user material appears in evidence.

## Pilot Boundary

The controlled pilot can continue with `Conditional Go` only while this evidence remains guarded and sanitized. Broad production rollout stays blocked until staging auth/session edge evidence, real-user onboarding evidence, final data-source decisions, direct database access/RLS policy decisions, UI polish, and measured production-readiness checks are all reviewed.
