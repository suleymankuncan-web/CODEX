# Phase 7 Real Auth Bootstrap

## Anchor
This plan continues the `Real Auth Integration` workstream from:
- [phase-7-production-ux-and-real-auth.md](./phase-7-production-ux-and-real-auth.md)
- [phase-7-auth-contract.md](./phase-7-auth-contract.md)
- [phase-7-next-steps-roadmap.md](./phase-7-next-steps-roadmap.md)

## Why This Is The Right Next Step
At the current project state, the highest-risk product decision is no longer backend capability.

The highest-risk unresolved decision is:
- how real login/session acquisition will work
- how users enter the correct shell after authentication
- how admin and future store users share auth without sharing the same UX

Because of that, the next correct move is to shape the real auth bootstrap before deeper domain work continues.

## Goal
Replace manual bearer-token entry as the intended production path and define how real authenticated users enter the application safely.

## Current State

### Already Available
- backend supports `jwt` auth mode
- frontend can store a bearer token transiently
- `/api/auth/session` can verify the active session
- shell routing is role-aware
- `401` handling now clears bearer session and returns the user to session setup
- `/auth/login` can start authorization code + PKCE from backend bootstrap metadata
- `/auth/callback` can exchange authorization codes with the saved PKCE verifier

### Still Missing
- token restoration strategy
- logout behavior definition
- post-login shell routing contract
- final production IdP selection and provider-specific settings

## Decision To Make First
Before implementation, the project needs one explicit answer for:

### Identity Provider Shape
Choose whether authentication will come from:
- corporate OIDC / SSO
- custom identity provider
- another JWT/OAuth-compatible provider

The exact vendor can stay open briefly, but the protocol shape should not.

## Recommended Direction
Prefer a standard OIDC/OAuth-compatible login flow with a bearer access token.

Reason:
- backend JWT verification is already in place
- both shells can share the same token contract
- this minimizes rework while keeping vendor choice flexible

## Bootstrap Flow

### 1. User enters application
- frontend checks whether a valid bearer session exists
- if not, the user is redirected to login

### 2. Login completes
- frontend receives authorization code
- frontend exchanges code with the saved PKCE verifier
- frontend stores the returned bearer session transiently
- frontend verifies it through `/api/auth/session`

### 3. Session resolves
- backend returns canonical role and scope context
- frontend routes user to:
  - `/admin/*` if role set is admin-oriented
  - `/store/*` if role set is store-oriented

### 4. Runtime behavior
- `401`:
  - clear session
  - redirect to login/session recovery
- `403`:
  - keep session
  - redirect to the nearest allowed landing page

### 5. Logout
- clear client session
- clear bearer token
- redirect to login or neutral landing

## Shell Routing Rule After Real Auth

### Admin-oriented roles
Examples:
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`
- `SNAPSHOT_OPERATOR`
- `REPORT_VIEWER`
- `AUDITOR`

Default shell:
- `/admin`

### Store-oriented roles
Examples:
- `STORE_MANAGER`
- future store roles

Default shell:
- `/store`

## Implementation Phases

### Phase A. Contract Lock
- confirm IdP protocol shape
- confirm claim mapping
- confirm login/logout expectations

### Phase B. Frontend Session Bootstrap
- add auth bootstrap controller/page
- add callback handling if needed
- restore verified session automatically

### Phase C. Shell Routing
- route authenticated user into correct shell
- keep unauthorized users out of unrelated shell surfaces

### Phase D. Session Lifecycle
- session expiry
- logout
- retryable session recovery UX

## Explicit Non-Goals For This Step
- full store checklist flow
- approval workflow
- incentive / `prim` module
- richer KPI families

Those should wait until the auth entry path is less manual.

## Risks If We Skip This Step
- manual token flow remains the de facto production behavior
- future store shell work gets built on a temporary auth model
- shell separation becomes weaker once more modules land
- later IdP integration becomes more invasive than necessary

## Recommended Immediate Follow-Up
Create a short implementation note for:
- login entry route
- callback route
- logout route
- session restoration behavior

This should be the next engineering artifact before coding the real login path.
