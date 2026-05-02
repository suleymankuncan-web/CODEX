# Security Review Pass

## Anchor Plan
This review closes the `Security review pass` item from [phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md), which itself is derived from [next-phase-plan.md](./next-phase-plan.md).

## Review Scope
- auth mode defaults and mock-mode exposure
- permission grant / revoke abuse surface
- admin route protection assumptions
- bearer token handling in the admin frontend
- audit completeness for auth mutations

## Findings

### 1. Mock auth needed a stronger production guard
Risk:
- `AUTH_MODE` previously fell back to `mock`
- a misconfigured production environment could have accepted header-based identity simulation

Action taken:
- production fallback now prefers `jwt`
- mock auth now requires explicit allowance through `ALLOW_MOCK_AUTH=true` when running in production
- unsupported auth modes now fail closed
- production DB authorization lookup failures now fail closed with `503` instead of trusting provider fallback context

Files:
- [app-config.service.ts](../../backend/nestjs/src/shared/app-config.service.ts)
- [auth-context.service.ts](../../backend/nestjs/src/modules/auth/auth-context.service.ts)

### 2. Bearer token persistence was too durable
Risk:
- the admin frontend stored the full session, including bearer token, in `localStorage`
- that increased exposure duration for browser-side token leakage

Action taken:
- bearer tokens now live in `sessionStorage`
- only non-sensitive session defaults remain in `localStorage`

Files:
- [session-context.tsx](C:/Users/suley/OneDrive/Masaüstü/admin-web/src/features/session/session-context.tsx)
- [SessionReadinessPage.tsx](C:/Users/suley/OneDrive/Masaüstü/admin-web/src/pages/SessionReadinessPage.tsx)

## Reviewed Areas That Already Look Good
- auth admin mutations already emit audit events with shared metadata shape
- permission grant / revoke endpoints are still backend-enforced and tested for duplicate / missing cases
- reporting scope filters are enforced server-side, not only in the client
- admin frontend routes remain convenience shells; privileged action still requires backend authorization

## Residual Risks
- mock mode still exists for local development, so deployment hygiene matters
- bearer token acquisition is still manual; a real IdP flow is the next hardening step
- there is not yet a single global audit feed endpoint across all modules

## Conclusion
No obvious unreviewed privilege-escalation path remains in the current admin shell.

`Phase 6` security review is in a materially stronger state after:
- fail-closed auth mode behavior
- fail-closed production authorization lookup behavior
- explicit mock-mode production gating
- less persistent bearer token storage
