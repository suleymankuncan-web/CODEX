# Phase 7 Token Renewal Decision

## Metadata
- Status: Accepted for first real IdP staging smoke.
- Date: 2026-04-24.
- Scope: Browser session renewal strategy after authorization code + PKCE.
- Related docs:
  - `docs/plans/phase-7-real-auth-config-runbook.md`
  - `docs/plans/phase-7-provider-readiness-checklist.md`
  - `docs/plans/phase-7-auth-evidence-template.md`

## Decision
For the first real staging/production IdP validation, do not issue, request, store, or use refresh tokens in the browser SPA.

The accepted current behavior is:
- access token is stored only as transient `sessionStorage` bearer state
- provider `id_token` is stored only for logout `id_token_hint`
- expired bearer JWT is cleared before API authorization headers are built
- user is routed back through `/auth/login` when the session can no longer be verified

If longer lived browser sessions become a product requirement, implement backend-mediated refresh as a separate hardening pass. Do not make hidden iframe silent re-auth the primary renewal strategy.

## Rationale
The current app is a browser SPA with backend JWT verification. Storing refresh tokens directly in browser storage would increase the impact of XSS or third-party script compromise. The project already has a safer baseline: short-lived access token, backend session verification, explicit logout, and local cleanup when the JWT is expired.

Silent re-auth through hidden iframes is also a weak primary strategy because modern browser privacy controls and third-party cookie blocking can make it unreliable across providers and environments. A top-level redirect through `/auth/login` is more observable and easier to support for the first real IdP smoke.

Backend-mediated refresh is the preferred future design if the team needs smoother long sessions. In that model, refresh tokens never enter frontend JavaScript. The backend acts as the token mediator, stores refresh material server-side or behind an HttpOnly secure cookie/session, rotates refresh tokens where the provider supports it, and returns only short-lived access state to the frontend.

## Current Phase 7 Policy

### P0 Required Now
- [ ] Do not request `offline_access` or any provider refresh-token scope for first staging smoke.
- [ ] Do not persist `refresh_token` in `localStorage`, `sessionStorage`, IndexedDB, cookies readable by JavaScript, or logs.
- [ ] If a provider token response includes `refresh_token`, frontend must ignore it and evidence must not capture it.
- [ ] Expired access token behavior remains re-login through `/auth/login`.
- [ ] Logout continues to use provider `id_token` only as `id_token_hint`, then clears local bearer/id token state.

### P1 Accepted Limitation
- Users may need to re-authenticate after access token expiry.
- Evidence should record access token lifetime and whether re-login was required during smoke testing.

## Rejected Options

### Browser-stored refresh token
Rejected for current phase.

Reason:
- increases XSS blast radius
- complicates token revocation and rotation handling
- makes leaked browser storage much more damaging

### Hidden iframe silent re-auth as primary strategy
Rejected as primary strategy.

Reason:
- unreliable under third-party cookie blocking and provider-specific session policies
- harder to debug and capture in smoke evidence
- creates a second login path before the main PKCE path has passed real IdP validation

### Backend-mediated refresh immediately
Deferred.

Reason:
- stronger long-session design, but adds new backend session/token-mediation surface
- should follow after one real provider passes PKCE login, logout, claim, and action-scope smoke tests

## Future Backend-Mediated Refresh Shape
Use this only when long-lived sessions become a concrete requirement.

### Target Properties
- refresh token is never visible to frontend JavaScript
- refresh token is stored server-side or protected by an HttpOnly, Secure, SameSite cookie/session design
- refresh token rotation is enabled when provider supports it
- refresh token family is revoked or invalidated on logout
- refresh token lifetime is bounded by provider session policy
- access token remains short-lived
- backend keeps JWT/JWKS verification and `/api/auth/session` as the canonical authorization gate

### Possible Endpoint Shape
Exact naming can change during implementation, but the surface should stay small:

```text
POST /api/auth/renew
```

Expected behavior:
- requires a valid backend-managed renewal session
- returns a fresh short-lived access token or session bootstrap payload
- returns `401` if renewal session is missing, expired, revoked, or provider refresh fails
- never returns a refresh token to the frontend

```text
POST /api/auth/logout
```

Expected behavior if backend-mediated refresh exists:
- revokes or invalidates backend-held refresh/session material
- clears the HttpOnly renewal session cookie
- still supports provider logout redirect parameters when required

## Provider Checklist Impact
For the first real IdP smoke, provider configuration should not depend on refresh-token scopes.

Record these in the auth evidence:
- access token lifetime
- whether token expiry caused re-login
- whether provider returned a refresh token unexpectedly
- confirmation that no refresh token was stored or logged

## Implementation Trigger
Implement backend-mediated refresh only if at least one of these becomes true:
- access token lifetime is too short for normal store/admin workflows
- users are forced through login during routine daily usage
- provider or security review requires centralized token custody
- production UX requirements explicitly call for uninterrupted sessions

Until then, the current re-login-on-expiry behavior is the accepted, safer default.

## References
- IETF OAuth 2.0 for Browser-Based Applications draft: https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/
- RFC 9700 Best Current Practice for OAuth 2.0 Security: https://www.rfc-editor.org/rfc/rfc9700
