# Native Keycloak login address and account completion

Status: active
Owner: HR Axis
Decision date: 2026-10-02
Risk: HIGH auth surface; reversible theme and bounded login-recovery change

The owner wants the visible on-prem login address to stay at `/auth/login`.
PAR shortened the authorization request but Keycloak subsequently exposes its
native `login-actions/authenticate` URL with `tab_id` and `client_data`.

Use the existing native Keycloak form and change its displayed history entry
with the same-origin History API. Load the helper early only for the `login`
page (including its native error response) and `store-ops-admin-web` client. Also require HTTPS, the exact `store-ops`
authentication path and a single matching `client_id` in the browser. Keep
existing history state; copy no authorization values into storage or history.
Reapply at DOMContentLoaded and pageshow because native error responses can
restore their canonical address after the head script; pageshow also covers
back/forward cache restoration. A History API failure leaves native login usable.

The native form action, credential fields, reset links, session checks, cookie
transport, PAR, PKCE and callback validation retain their existing ownership.
Reset/action-token pages, other clients/realms and callbacks keep their native
addresses. Refreshing or bookmarking the clean address enters the existing
application login route and starts a fresh PKCE/PAR request. A provider navigation
can briefly expose its URL before the theme arrives; the settled login page uses
the clean address. Removing security parameters or proxying credentials through a
new application login handler was rejected: neither is needed for this request.

Acceptance: targeted negative/helper tests and browser regressions for native
POST error restoration, desktop/mobile, refresh and preserved form actions;
actual Keycloak 26.7.3 on isolated synthetic data for wrong-password, reset/back,
refresh and successful PKCE token exchange. Required GitHub CI and exact merged
SHA full image proof precede the separately owner-authorized live image update.
The owner explicitly forbids local full runs; targeted local tests preserve the
required full GitHub checks. The final scope requires no database, realm, cookie
or application configuration edit.

The owner also requested a usable exit after an invitation/password setup.
Only the application's successful `accountUpdatedTitle` info page, with no
remaining actions or action URI, displays "İşlemler tamamlandı" and a primary
"Giriş yap" link to `/auth/login`. It starts a fresh application login rather
than revisiting a consumed invitation token or inventing a callback code/state.
Other info/confirmation messages retain native continuation and skip-link
rules. Validate the real execute-actions invitation through completion and a
new PKCE login, including mismatched passwords and consumed-token rejection.

Idle-login investigation reproduced Keycloak 26.7.3 rejecting correct synthetic
credentials with `invalid_user_credentials` after its PAR reference expired.
Read-only live evidence found a 60-second PAR lifetime and the same missing-PAR
exception signature. This establishes the mechanism, not the identity of a user's
particular attempt. Keep PAR, provider policies and the ten-minute PKCE bound.
Persist a presentation deadline in the existing same-tab PKCE record from request
start plus validated PAR `expires_in`, less a bounded transport/clock margin.
The native theme matches `client_data.st` to that attempt, checks on load,
foreground/pageshow and immediately before submit, and shows an explicit fresh
restart when expired or superseded. It never reads, stores or forwards credentials.
Do not reset the deadline after a wrong password, adopt a newer attempt into a
restored form, or reject completed callbacks merely because the UI deadline passed.
The 60-second provider window remains a usability constraint; increasing security
lifetimes or removing PAR is outside this fix. External entry/storage failure
retains provider validation and a visible restart; other clients are unaffected.
Native errors without a client base URL and callback provider errors also get an
explicit application restart. Missing or mismatched callback state stays rejected.
Clean-page refresh carries only a sanitized, valid pending destination into a new
state/verifier. Tests cover expiration without credential POST, new attempt login,
wrong password crossing expiry, independent tabs, invitations and destination
preservation. Rollback now restores frontend and Keycloak images together;
no database, realm, session, role or live policy change is needed.

Provider references: [History API](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState),
[native form](https://github.com/keycloak/keycloak/blob/26.7.3/themes/src/main/resources/theme/base/login/login.ftl),
[native session checker](https://github.com/keycloak/keycloak/blob/26.7.3/themes/src/main/resources/theme/base/login/resources/js/authChecker.js).
