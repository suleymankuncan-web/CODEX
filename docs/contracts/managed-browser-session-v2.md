# Managed browser session V2

Status: active implementation contract. Deployment of this change is not established.

## Transport and authority

The private Keycloak deployment enables `MANAGED_BROWSER_SESSION_ENABLED`.
Bootstrap advertises `provider.managedBrowserSession`; the browser validates its
PKCE state then sends code/verifier/state to `POST /api/auth/browser-session/oidc`.
The server requires the exact allowed Origin and configured same-origin callback,
redeems against its configured endpoint/client, verifies issuer/subject/audience/
expiry, and requires an active mapped internal account and current roles.
Provider access, refresh and ID tokens are never returned to this browser flow.

Migration 098 adds `ops.managed_browser_session`. Its refresh credential uses
AES-256-GCM with a domain-separated server key and session ID as authenticated
data. Only current/previous configured keys are accepted. The HttpOnly, Secure,
host-only cookie is a signed V2 envelope; its SID, issue time and expiry must match
an active database row. Missing, revoked, disabled or rebound accounts fail closed.
Fresh internal role/read/action authorization remains mandatory on every request.
V1 bearer/Clerk establishment retains its existing transport and expiry contract.

## Renewal and recovery

`MANAGED_BROWSER_SESSION_MAX_SECONDS` defaults to 604800 and cannot exceed that
fixed app maximum. It is not evidence of the provider's session maximum or
Remember Me setting. Keycloak enforces normal/Remember Me idle and maximum limits
on each renewal; the initial refresh expiry is not treated as an absolute maximum.
See the [pinned provider expiry implementation](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/protocol/oidc/refresh/DefaultRefreshTokenProvider.java).

Authenticated use renews near verified access expiry (30 seconds). Same-origin
CSRF/reload recovery also validates the provider, coalescing concurrent recoveries
within one second. A bounded database row lock rereads the lease before renewal
and persists the rotated credential. SID/expiry/CSRF stay stable. Renewal is
request driven; no new background provider refresh timer is introduced. Authenticated
API traffic can renew within provider idle/max limits and the fixed app maximum.
Renewal and cleanup are not user activity telemetry. Internal account changes deny
immediately; provider revocation is observed at renewal/recovery, not claimed
instantaneous during a cached access lease.

Temporary network/provider/database failures are recoverable 503. Actual provider
denial commits revocation before returning 401. Logout revokes the local session;
the existing provider logout redirect ends SSO. No old signed cookie can revive a
revoked row. Exact Origin remains mandatory when older browsers omit Fetch
Metadata; explicit cross-site/same-site or ambiguous metadata is rejected.

The browser keeps its route and non-secret cache hint during temporary reload
failure, hides protected content until verification, retries at most three times,
and offers manual retry. A retired request cannot expire a replacement login.
PKCE local state is consumed only after confirmed success. A durable, hashed login
claim prevents blind repeated code exchange; confirmed duplicate callbacks can
recover the same session for ten minutes. An indeterminate unconfirmed grant
requires restarting login after its bounded confirmation window.

Provider rotation and a database commit are separate transactions. A lost provider
response or indeterminate commit cannot promise seamless recovery; a definitive
later invalid grant ends the session conservatively. No live repair is automatic.
Expired rows and non-active claims older than 15 minutes are purged in batches of
500 by the enabled API lifecycle, without provider calls or activity telemetry.

## Operation and rollback

On-prem `AUTH_SESSION_ENDPOINT_URL` uses the one approved private Keycloak endpoint
in strict-local mode; other production endpoints require HTTPS. Public issuer,
callback and Origin still use the approved public HTTPS host. Apply migration and
compatible API/frontend together, coordinate current/previous key rotation.
Disabling V2/reverting compatible code invalidates its sessions; no return or
financial data is affected. Retain the additive table until a separately approved
cleanup. Never log credentials or provider response bodies.

Targeted PostgreSQL tests cover locking, replay, rotation, temporary failure,
account binding, revocation and migration reapplication. Required automatic
synthetic Keycloak proof exercises V2 PKCE, provider recovery, scope/CSRF and logout.
Local tests do not establish production provider/TLS behavior. The reported
iPhone/Safari model and failure behavior are unknown; real-device acceptance
remains an operational step. MFA and login redesign are outside this change.
