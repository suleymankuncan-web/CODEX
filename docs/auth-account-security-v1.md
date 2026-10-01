# Account security and foreground activity

SUPER_ADMIN can read cached account security and request a setup/reset link in
the existing Users workspace. Access remains the default inner tab; role,
store, capability and incentive participation workflows retain their authority.
The API never reads Keycloak credentials or receives lifecycle admin secrets.

Migration 099 adds neutral snapshots, immutable audited link requests and
`last_active_at`. Each link is bound to the captured provider subject/email and
an identity lifecycle job. A client UUID makes retries idempotent; requests for
another link have a one-minute cooldown. Automatic initial setup and manual
reset use the same tracked queue. Initial setup keeps VERIFY_EMAIL +
UPDATE_PASSWORD; reset uses UPDATE_PASSWORD. Links use the existing browser
client and 24-hour lifespan without an invalid PKCE callback/redirect.

The existing worker alone reads credential metadata. It verifies provider ID,
the `hr_axis_user_id` ownership attribute and captured email before reading;
an absent/conflicting ownership attribute stays unverified. Only password type
and a valid creation timestamp leave the client. OTP/email events do not prove a
password change. Existing accounts without timestamps retain unknown history;
federated accounts without a local password are unknown rather than absent.
Pinned Keycloak 26.7.3 PasswordCredentialProvider updates createdDate when a
password changes and preserves it during rehash. Sources:
[credential provider](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/credential/PasswordCredentialProvider.java)
and [admin user resource](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java).

Before SMTP, the worker commits a sending boundary and verified baseline. A
successful provider response means accepted sending, never delivery, click or
completion. Interrupted/uncertain sends stay unconfirmed and are not retried
automatically. Explicit resend creates a new request and does not claim to
invalidate earlier links. The provider send and database commit cannot form one
transaction; this conservative state handles that boundary. Profile changes
after the pre-send checks are also not atomic with the external email service.

The worker observes at most five accounts per minute with two-minute leases.
Pending requests are observed every two minutes; other accounts hourly. Current
binding and observation UUID protect against rebind and late/out-of-order
responses. Verified password dates never regress. Only a newer dated password
than a known baseline, within the request's tracking window, can complete the
latest request. This proves a password change, not which link was clicked. The
UI exposes the tracking window expiry without claiming an earlier link is
revoked. History is bounded to the last twenty requests and retained in storage.

V2 session activation records last login atomically once. Replay and provider
renewal do not update it; historical/legacy dates are not invented. Foreground
pointer, key, wheel, focus and visible-tab events send authenticated activity at
most every two minutes, with a server-clock write throttle. Mock sessions and
idle/background renewal do not generate activity. The endpoint ignores client
identity/timestamps and uses only the authenticated actor. Dates display in
Europe/Istanbul. Account-panel polling is bounded to two minutes and is not
activity, although any authenticated request remains subject to normal session
renewal.

Deploy/rollback: migrate before the coordinated API/frontend/worker release.
Rollback to a compatible release leaves the additive metadata/history intact;
stop the new worker before rolling back its code. Never rewrite financial data
or recreate old uniqueness. Live SMTP delivery, historical account ownership
alignment, affected iPhone/Safari and TLS acceptance remain operational checks;
code tests and synthetic CI are not live-provider readiness.
