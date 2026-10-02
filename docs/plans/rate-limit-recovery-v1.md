# Rate-limit recovery without a blocked application

Status: active
Owner: HR Axis
Decision date: 2026-10-02
Risk: HIGH shared HTTP and authentication recovery

The owner encountered rate limiting during rapid actions and an apparently
blocked application. The exact screen is pending clarification. Source inspection
found immediate 429 retries and no recovery control after a failed shell-session
check. A temporary startup failure also discarded its cause and kept retrying.
Read-only runtime configuration has Redis, 120 requests per 60 seconds and one
trusted proxy hop. This does not identify a particular user's failed request.

Keep the existing per-IP limit, Redis fail-closed behavior, proxy trust and access
checks. Add Retry-After only when the server rejects an over-limit request; the
body and error code remain unchanged. Explicitly allowed CORS origins can read
the public cooldown headers. Rejected origins still receive no access headers.

The API client retains bounded cooldown metadata from Retry-After, with the
existing reset header as fallback. It accounts for server date on absolute
headers, caps its presentation bound at one hour and uses a sixty-second fallback
when metadata is unavailable. During the announced window it fails visibly
instead of sending more requests. It neither queues nor replays mutations.
No credential, token or cooldown is written to browser storage. The server
remains authoritative if the client is reloaded or its network changes.

Stop short automatic 429 query retries while retaining existing retry counts for
other errors. Display clear wait/retry text instead of raw rate-limit jargon.
A transient shell verification failure or managed-session startup failure gets
an explicit, cooldown-aware retry action on the same route. Expiration enables
the action; only a new validated server result can restore access. A 429 does not
clear the session or CSRF nonce. A 401/403, changed identity, failed authorization
or unresolved permissions cannot use this recovery to gain access.

Acceptance uses targeted limiter/window/isolation tests, metadata/clock/error-copy
tests, JSON/multipart/export API regressions proving no write replay or logout,
and desktop/mobile shell and startup browser recovery including denied access.
Run only affected local tests; full GitHub CI remains mandatory before squash
merge. The earlier native-login change is already merged in #1227; its image
proof was cancelled at the owner's request before live activation. A new full
GitHub proof on the final merged SHA must include both changes before deployment.

Rollback restores the previous application frontend/backend images together;
Keycloak can retain its compatible current theme or return with the associated
native-login rollout. No schema, data, role, Redis-window, DNS or session-policy
change is needed. FortiClient's separate internal routing issue remains IT-owned:
the same user saw HR Axis correctly after disabling VPN; public resolvers return
195.46.134.35, while the HR Axis VM serves HTTPS at 172.16.183.10:443.
