# Phase 7 Auth Entry Flow Note

## Anchor
This implementation note follows:
- [phase-7-real-auth-bootstrap.md](./phase-7-real-auth-bootstrap.md)
- [phase-7-auth-contract.md](./phase-7-auth-contract.md)
- [phase-7-real-auth-decision-log.md](./phase-7-real-auth-decision-log.md)

## Purpose
Turn the current real-auth plan into a concrete frontend implementation target before coding starts.

## Scope
This note covers:
- login entry route
- auth callback route
- session restore behavior
- logout behavior
- shell routing after successful auth

It does not choose a specific IdP vendor yet.

## Route Plan

### 1. Login Entry
Route:
- `/auth/login`

Responsibility:
- start the real login flow
- hand off to the chosen OIDC/OAuth provider

Expected behavior:
- if bearer session is already verified, redirect to shell landing
- otherwise begin provider redirect

### 2. Auth Callback
Route:
- `/auth/callback`

Responsibility:
- receive auth response from provider
- parse authorization code
- allow local/manual token fallback only in frontend dev builds
- exchange authorization code with the saved PKCE verifier
- persist transient bearer session
- verify through `/api/auth/session`

Expected behavior:
- on success:
  - route to `/admin` or `/store` based on resolved session
- on failure:
  - show readable callback failure state
  - send user back to `/admin/session` or `/auth/login`

### 3. Logout
Route:
- `/auth/logout`

Responsibility:
- clear client session state
- clear bearer token
- optionally redirect to provider logout later

Expected behavior:
- user lands on a neutral screen or session/setup surface

## Session Restore Plan

### Current State
- bearer token can be stored transiently
- `/api/auth/session` already verifies the session

### Intended Restore Logic
On app boot:
1. read transient bearer token if present
2. call `/api/auth/session`
3. if verification succeeds:
   - resolve role/scope
   - route to correct shell
4. if verification fails with `401`:
   - clear bearer session
   - route to `/auth/login` or `/admin/session`

## Shell Routing Logic

### Admin shell landing
Use `/admin` when role set contains admin-oriented roles such as:
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`
- `SNAPSHOT_OPERATOR`
- `REPORT_VIEWER`
- `AUDITOR`

### Store shell landing
Use `/store` when role set is store-oriented and no stronger admin shell is appropriate.

### Important Rule
Shell choice should happen **after** `/api/auth/session` succeeds, not from frontend assumptions alone.

## Error States

### Login Start Failure
Show:
- readable “could not start login” state
- retry action

### Callback Failure
Show:
- readable “login callback failed” state
- retry login action
- session setup fallback

### Session Expiry
Already partially implemented:
- `401` clears bearer session
- user returns to recovery flow

Next improvement:
- redirect to `/auth/login` once real login exists

### Forbidden Access
If the authenticated session is valid but not allowed for a shell:
- keep session
- route to nearest valid landing page
- explain why the original route was denied

## Frontend Components Likely Needed
- `AuthLoginPage`
- `AuthCallbackPage`
- `AuthLogoutPage`
- optional `AuthLoadingPage`

## Session Context Changes Likely Needed
- mark whether session was manually entered or provider-acquired
- support provider-driven bootstrap
- preserve shell landing intent during callback if needed

## Backend Dependency
No major new backend auth model is required because:
- JWT mode is enabled
- `/api/auth/session` remains the verification endpoint
- `/api/auth/bootstrap` exposes provider authorization URL, token URL, client id, callback path, and response type

Potential later backend additions:
- optional logout coordination endpoint

## Current Coding State
- `/auth/login` builds authorization code + PKCE URLs from backend bootstrap metadata.
- `/auth/callback` validates `state`, exchanges `code` at the provider token endpoint, and starts the bearer session from the returned `access_token`.
- Legacy `access_token`/`token` callback parsing remains for local/manual dev URLs only; production builds reject those URLs, do not store the token, and clean the token from the address bar.
- `/auth/logout` clears local bearer state and can redirect to provider logout when configured.
