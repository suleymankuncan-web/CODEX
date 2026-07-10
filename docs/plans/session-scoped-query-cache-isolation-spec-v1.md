# Session-Scoped Query Cache Isolation Specification V1

Status: approved
Shelf: active plan
Author: Codex
Owner: Product owner
Approved through: owner-approved `project-wide-audit-remediation-plan-v1.md`
Date: 2026-07-10
Review: local adversarial review; GitHub Codex review is owner-disabled

## 1. Context

The frontend owns one application-wide TanStack Query `QueryClient`. The shell
session query changes with the configured login mode, but protected page query
families are not consistently keyed by the effective user and authorization
scope. On a session-key change, the current shell invalidates those queries.
Invalidation marks cached data stale; it does not remove that data. A second
identity can therefore mount a query key previously populated by the first
identity and render the cached result until its replacement request completes.

Backend authorization still protects new responses. This specification closes
the separate client-side confidentiality gap on shared browsers and operator
devices. It defines one effective-authorization fingerprint and a render gate
that removes prior protected query and mutation state before the newly
authorized shell can render. It preserves the public login bootstrap and the
active shell-session query so the fix does not create a login or refetch loop.

The existing browser-session renewal logic already keeps its cache key stable
when the server-provided authorization summary is unchanged and rotates it when
that summary changes. The implementation MUST extend that behavior rather than
replace the session transport, token storage, or backend authorization model.

## 2. Functional Requirements

- FR-01: The frontend MUST derive a deterministic effective-authorization
  fingerprint from `authenticated`, `userId`, sorted unique role codes, legacy
  scope company/region/store IDs, read-scope company/region/store IDs, and
  action-scope assigned store IDs and store types.
- FR-02: Fingerprint generation MUST be order-independent for every set-like
  array and MUST NOT include bearer tokens, provider tokens, display name,
  username, email, or other presentation data.
- FR-03: The unauthenticated state MUST have one explicit fingerprint distinct
  from every authenticated fingerprint.
- FR-04: When the fingerprint changes, the frontend MUST cancel and remove all
  non-preserved queries before rendering the newly authorized Admin or Store
  shell.
- FR-05: The only public query family preserved across a fingerprint change
  MUST be `auth-bootstrap`.
- FR-06: The exact active `shell-session` query MAY be preserved during the
  boundary transition. Old or inactive `shell-session` query variants MUST be
  removed.
- FR-07: A fingerprint change MUST clear TanStack Query mutation-cache state so
  old optimistic, pending, success, or error state is not presented to the new
  identity.
- FR-08: A raw bearer-token renewal for the same identity MUST refresh the
  active shell-session query without changing its stable query key. Cache
  removal MUST occur only if the refreshed effective authorization differs.
- FR-09: A cookie-session renewal with unchanged effective authorization MUST
  keep the existing browser-session cache key and MUST NOT clear protected page
  caches.
- FR-10: A cookie-session renewal with changed role or scope MUST rotate the
  browser-session cache key, load the new shell session, and run the cache
  boundary before the new shell renders.
- FR-11: Logout, explicit session reset, session expiry, and re-login as a
  different identity MUST cross the same cache boundary; full-page navigation
  MAY remain a defense but MUST NOT be the only isolation mechanism.
- FR-12: Route prefetch MUST remain disabled until the cache boundary reports
  ready for the current fingerprint.
- FR-13: The implementation MUST expose pure fingerprint, preservation, and
  cache-isolation functions that can be tested against one `QueryClient`
  instance without a browser or real credentials.

## 3. Non-Functional Requirements

- NFR-01 Security: No data cached under an earlier effective authorization may
  be painted after a fingerprint change.
- NFR-02 Privacy: Tokens and presentation PII MUST NOT appear in a fingerprint,
  query key, test name, assertion message, console output, or committed fixture.
- NFR-03 Reliability: Same-authorization token renewal MUST complete without an
  infinite refetch, repeated cache clear, or permanently blank shell.
- NFR-04 Performance: A boundary transition MUST scan the current query and
  mutation caches once. It MUST NOT add per-page cache scans or a polling loop.
- NFR-05 Compatibility: No backend endpoint, OpenAPI shape, database schema,
  role policy, scope policy, query retry policy, or public login behavior may
  change.
- NFR-06 Testability: Unit coverage MUST use the production `QueryClient` API,
  and targeted Playwright coverage MUST switch two sanitized personas inside
  one browser page/context.

## 4. Acceptance Criteria

- AC-01 (FR-01, FR-02, FR-03): Given two authorization summaries containing the
  same set values in different orders, when fingerprints are built, then they
  are equal; changing identity, role, legacy scope, read scope, or action scope
  changes the fingerprint, and token/presentation fields are absent.
- AC-02 (FR-04, FR-05, FR-06, FR-07, NFR-01): Given User A protected query data,
  an old shell-session query, public auth-bootstrap data, and mutation state in
  one QueryClient, when User B becomes effective, then protected data, the old
  shell query, and mutation state are gone while auth-bootstrap and the exact
  User B shell query remain before User B's shell can render.
- AC-03 (FR-08, NFR-03): Given the same bearer identity receives a renewed raw
  token, when the shell session refetch returns unchanged authorization, then
  the shell query key stays stable, protected caches remain, and exactly one
  token-triggered shell refresh occurs without a loop.
- AC-04 (FR-08, FR-10): Given the same user receives a renewed session whose
  role or any effective scope field changes, when the refreshed shell session
  resolves, then protected caches are removed before the changed-authority
  shell renders.
- AC-05 (FR-09, NFR-03): Given a cookie-session renewal whose server session has
  unchanged effective authorization, when renewal completes, then its browser
  session cache key and protected query cache remain stable.
- AC-06 (FR-11): Given an authenticated session expires or logs out with
  protected data cached, when the app reaches unauthenticated state, then all
  protected query and mutation state is removed and auth-bootstrap remains
  available to the login surface.
- AC-07 (FR-11, NFR-01, NFR-06): Given sanitized User A and User B fixtures in
  one Playwright page/context, when the fixture switches to User B without a
  page reload, then User A's protected marker is never visible after User B's
  session becomes effective and User B's fresh result is shown.
- AC-08 (FR-12): Given a fingerprint transition is pending, when App renders,
  then neither AdminShell, StoreShell, nor protected route prefetch is invoked;
  the existing non-data shell transition state is shown until isolation ends.
- AC-09 (FR-13, NFR-04): Given a QueryClient with multiple protected families,
  when one boundary transition runs, then each cache is processed once and no
  timer, polling loop, or page-specific allowlist is introduced.
- AC-10 (NFR-05): Given the completed diff, when contract impact is reviewed,
  then backend, OpenAPI, database, role/scope semantics, retry policy, and login
  endpoint behavior are unchanged.

## 5. Edge Cases

- EC-01: The authorization response is null, unauthenticated, or structurally
  incomplete. Treat it as unauthenticated and never throw while fingerprinting.
- EC-02: Role and scope arrays contain duplicates or arrive in a different
  order. Normalize them before fingerprinting.
- EC-03: User ID is unchanged but a legacy scope field changes while read or
  action scope does not. The fingerprint still changes because active pages use
  legacy scope fields during compatibility fallback.
- EC-04: A protected query is fetching during a transition. Cancel it before
  removal so its old response cannot remain as cached data.
- EC-05: Mutation cache contains an optimistic or failed mutation from User A.
  Clear it even when there are no protected query entries.
- EC-06: The public bootstrap query is pending or failed. Preserve its state;
  login owns its retry and error behavior.
- EC-07: Multiple rapid session transitions occur. Only the latest fingerprint
  may release the shell render gate; an older asynchronous cleanup completion
  must not mark a newer transition ready.
- EC-08: React Strict Mode invokes effects twice in development. Cache cleanup
  MUST be idempotent and MUST NOT cause repeated session refetch.
- EC-09: A token expires while a protected page request is in flight. The expiry
  event and the fingerprint boundary may both run; the final state must be
  unauthenticated with no protected cache.
- EC-10: The current active shell-session query is absent. Isolation still
  succeeds and the normal shell query lifecycle may fetch it.

## 6. API Contracts

No HTTP or OpenAPI contract changes are authorized. The implementation contract
is internal and MUST remain equivalent to the following shapes:

```ts
type EffectiveAuthorizationInput = AuthSessionSummary | null

type AuthorizationCacheBoundaryInput = {
  queryClient: QueryClient
  previousFingerprint: string
  nextFingerprint: string
  activeShellSessionQueryKey: QueryKey
}

function buildEffectiveAuthorizationFingerprint(
  input: EffectiveAuthorizationInput,
): string

function isAuthorizationBoundaryPreservedQuery(
  queryKey: QueryKey,
  activeShellSessionQueryKey: QueryKey,
): boolean

async function isolateAuthorizationCache(
  input: AuthorizationCacheBoundaryInput,
): Promise<void>
```

`GET /api/auth/session` and `GET /api/auth/bootstrap` retain their generated
request and response types. No new response field is required.

## 7. Data Models

No persisted data model changes are authorized.

| Field | Type | Constraint | Purpose |
| --- | --- | --- | --- |
| `authenticated` | boolean | normalized | Separates signed-out state |
| `userId` | string | opaque, non-empty when authenticated | Identity boundary |
| `roleCodes` | string[] | sorted unique | Effective role boundary |
| `scope.companyIds` | string[] | sorted unique | Legacy compatibility boundary |
| `scope.regionIds` | string[] | sorted unique | Legacy compatibility boundary |
| `scope.storeIds` | string[] | sorted unique | Legacy compatibility boundary |
| `readScope.companyIds` | string[] | sorted unique | Read boundary |
| `readScope.regionIds` | string[] | sorted unique | Read boundary |
| `readScope.storeIds` | string[] | sorted unique | Read boundary |
| `actionScope.assignedStoreIds` | string[] | sorted unique | Action boundary |
| `actionScope.assignedStoreTypes` | string[] | sorted unique | Action-type boundary |
| `authorizationFingerprint` | string | deterministic, non-token, non-PII | In-memory transition identity |
| `committedFingerprint` | string | in-memory only | Shell render gate state |

## 8. Out Of Scope

- OS-01: Adding the fingerprint to every page query key. Central removal is the
  scoped fix; mass query-key migration would create a broad unrelated diff.
- OS-02: Changing backend authorization, roles, scopes, route access, or DG-1
  decisions.
- OS-03: Changing browser-session cookies, CSRF transport, Clerk configuration,
  token persistence, or provider login/logout contracts.
- OS-04: Persisting TanStack Query cache or sharing it across tabs.
- OS-05: Refactoring page query families, retry behavior, prefetch coverage, or
  loading-state design beyond the boundary gate required by AC-08.
- OS-06: Cancelling an already accepted server-side mutation. This PR clears
  client mutation state; server command idempotency and rollback remain owned by
  their domain contracts.
- OS-07: Real credentials, production personas, production data, or broad
  production readiness claims.

## 9. Verification And Traceability

Required test mapping:

| Test | Requirements |
| --- | --- |
| Fingerprint normalization unit tests | FR-01, FR-02, FR-03; AC-01; EC-01–EC-03 |
| Shared QueryClient isolation unit tests | FR-04–FR-07, FR-13; AC-02, AC-06, AC-09; EC-04–EC-06, EC-10 |
| Renewal lifecycle unit/contract tests | FR-08–FR-10; AC-03–AC-05; EC-07–EC-09 |
| App render-gate contract test | FR-12; AC-08 |
| Playwright same-context persona switch | FR-11; AC-07; NFR-01, NFR-02, NFR-06 |

Verification ladder:

1. `git diff --check`.
2. Focused Vitest tests for fingerprint and QueryClient isolation.
3. Existing frontend script contracts, including stable shell-session renewal.
4. Frontend lint and build.
5. Targeted Playwright persona-switch spec.
6. Root canonical release once for the PR decision.
7. Local adversarial review for token/PII leakage, hidden query allowlists,
   refetch loops, stale optimistic state, and unrelated authorization drift.

Manual spec validation:

- Every FR and NFR is covered by at least one acceptance criterion or explicit
  verification row.
- Every acceptance criterion is machine-verifiable.
- HTTP contracts and the absence of schema changes are explicit.
- External dependencies have failure or lifecycle edge cases.
- Out-of-scope boundaries prevent route, auth, API, DB, and page-query refactors.
