# Rate-limit recovery without a blocked application

Status: active
Owner: HR Axis
Decision date: 2026-10-02
Risk: HIGH shared HTTP and authentication recovery

The owner encountered rate limiting while rapidly removing a regional manager's
store assignments. The application appeared blocked. Source inspection
found immediate 429 retries and no recovery control after a failed shell-session
check. A temporary startup failure also discarded its cause and kept retrying.
Each store removal also refreshed every auth-management list, amplifying traffic;
its remove controls allowed repeated clicks while the command was pending.
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

Store removal refreshes only its original user's exact assignment-list query.
Keep the command's user ID even if the administrator changes the selection while
it runs. Pending removals block duplicate writes and store-add/remove overlap.
Do not replay rejected commands; preserve failed records for an explicit retry.
Assignment-list cooldown errors receive the same understandable wait message.

Apply the same exact-user refresh to store batches. A known 429 does not refresh
unrelated queries; an indeterminate command outcome refreshes only the original
assignment list. Exclude assignments already present before an explicit retry.
Serialize overlapping store writes and pending role removals. Password-link
commands retain their idempotency identifier and show the actual cooldown; their
handlers also reject pending, inactive or unavailable account states.

The owner's browser-cookie report is incomplete and is not a confirmed Safari
defect. Review the shared flow across browsers. Blocked PKCE storage stops login
before provider requests and offers site-specific settings guidance. Missing or
expired state still starts a fresh direct handshake; mismatched or malformed state
remains rejected without revealing stored contents. Optional locale and session
preference persistence cannot crash sign-in or authenticate anyone.

After a managed exchange, confirm that the browser presents the newly issued
cookie by recovering its nonce from the existing same-origin endpoint. An absent
cookie or an older account's nonce cannot enter protected pages or silently replay
the exchange. Offer an explicit fresh login. Transient verification errors retain
the existing manual, server-idempotent confirmation retry. Cookie policy, origin,
CSRF, PKCE, provider checks and token-storage restrictions remain unchanged.
The Keycloak cookie-not-found copy explains session loss/expiry first and keeps
the existing fresh-login link. No request to disable browser privacy protections.

Contract Impact: changed frontend recovery/copy and one cookie-confirmation read
per managed login; backend endpoints, DTOs, roles, data and security policy are
intentionally unchanged. Risk class R5; reversible by restoring reviewed images.

Acceptance uses targeted limiter/window/isolation tests, metadata/clock/error-copy
tests, JSON/multipart/export API regressions proving no write replay or logout,
and desktop/mobile shell and startup browser recovery including denied access.
Targeted admin browser tests also cover request amplification, duplicate clicks,
selection changes, rejected commands and a failed post-command list refresh.
Twenty consecutive removals must add only twenty writes and twenty list reads;
other auth-management queries stay unchanged. Review frequent mutation callers
for broad invalidation and pending-state behavior alongside shared HTTP helpers.
Run only affected local tests; full GitHub CI remains mandatory before squash
merge. The earlier native-login change is already merged in #1227; its image
proof was cancelled at the owner's request before live activation. A new full
GitHub proof on the final merged SHA must include both changes before deployment.

Follow-up local verification (2026-10-02): 61 affected frontend unit tests and
12 cookie/managed-session crypto backend tests passed. The selected Chromium
admin/auth matrix has 41 passing cases; Firefox/WebKit add 24 normal-build cases
and the actual onprem settings have 36 passing cross-browser cases. Fixture-only
failures were corrected and rechecked without weakening assertions. Two native
cookie-loss/copied-URL recovery cases passed against real Keycloak 26.7.3 in each
of Chromium, Firefox and WebKit, using isolated synthetic accounts and no SMTP.
No physical iPhone evidence is claimed. Lint, normal/onprem frontend builds and
affected source/auth/token-storage/size/UI/PAR guards passed. Inline R5 self-review
GO: pending-write, original-target invalidation, indeterminate outcome, older
cookie, denied storage and malformed-state findings resolved; no actionable
finding remains within this slice. Required CI and final image proof are pending.

Rollback restores the previous application frontend/backend images together;
Keycloak can retain its compatible current theme or return with the associated
native-login rollout. No schema, data, role, Redis-window, DNS or session-policy
change is needed. FortiClient's separate internal routing issue remains IT-owned:
the same user saw HR Axis correctly after disabling VPN; public resolvers return
195.46.134.35, while the HR Axis VM serves HTTPS at 172.16.183.10:443.
