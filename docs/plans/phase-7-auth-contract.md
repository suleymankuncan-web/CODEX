# Phase 7 Auth Contract

## Anchor
This document is the first execution artifact for:
- [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md)

## Purpose
Define the minimum contract needed to move from development-oriented auth behavior to a production-ready login and session model.

## Decision Direction
Use one shared token contract for both:
- admin shell
- future store-user shell

Reason:
- backend scope enforcement is already shared
- role/scope claims can drive both products
- this keeps identity integration simpler while still allowing different UX shells

## Expected Identity Provider Shape
The system should support a standard OIDC/OAuth-style provider that yields a bearer access token.

The frontend should not mint or infer roles itself.
The backend remains the final authority because DB-backed active role assignments override provider token role/scope data when available.

Production access tokens must include direct `sub` and `aud` claims. Non-production can keep sparse-token tolerance for local development and isolated tests only.

## Required Token Claims

### Identity
- `sub`
  - canonical user id; required directly in production
- `employee_id`
  - optional employee linkage

### Provider Authorization Claims
- `roles`
  - optional role list
- `read_company_ids`
  - optional read-scope company list
- `read_region_ids`
  - optional read-scope region list
- `read_store_ids`
  - optional read-scope store list
- `assigned_store_ids`
  - optional action-store list

### Validation
- `iss`
- `aud`
  - required directly in production
- valid signature
- valid lifetime

## Backend Rules
1. authenticate token
2. reject production JWTs without direct `aud` or non-empty direct `sub`
3. extract token claims
4. resolve active DB role assignments for the authenticated user
5. if DB assignments exist:
   - DB roles/scopes are canonical
6. if DB lookup succeeds but no assignments exist:
   - explicit token roles/scopes are used as provider context
7. if DB lookup fails in production:
   - fail closed with `503 Authorization context is unavailable`
8. if DB lookup fails outside production:
   - keep provider context for local development/test tolerance

The backend must not infer role or scope from local demo usernames.

## Frontend Session Rules

### Login
- user is redirected to real IdP login
- frontend sends `response_type=code` with `code_challenge` and `code_challenge_method=S256`
- frontend stores the `code_verifier` and random `state` only in `sessionStorage`
- frontend receives an authorization `code` on `/auth/callback`
- frontend exchanges the code at the provider token endpoint with the saved verifier
- frontend verifies session through `/api/auth/session`

### Session Ready State
- app is considered ready only after:
  - token exists
  - `/api/auth/session` succeeds

### Token Expiry
- on `401`:
  - clear session
  - redirect to login
  - show a readable “session expired” message

### Forbidden Access
- on `403`:
  - keep session
  - show role/scope-aware forbidden state
  - offer route back to a valid landing page

### Logout
- clear client session state
- clear stored bearer token
- redirect to login or public landing shell

## UX Implications

### Admin Shell
- sees admin navigation only when role/scope permits
- integrations / snapshots / auth / audit remain admin surfaces

### Store-User Shell
- should not inherit admin-first navigation
- should land in store-relevant reporting or task views

## Open Implementation Decisions
- exact IdP vendor
- refresh-token strategy or silent re-auth strategy
- whether store-user shell lives in:
  - the same frontend app
  - or a separate frontend app

## Recommended Next Engineering Step
Wire the chosen production IdP details: token endpoint, provider mapper names, logout quirks, and refresh/silent re-auth strategy.
