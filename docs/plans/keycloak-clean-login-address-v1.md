# Native Keycloak login address and account completion

Status: active
Owner: HR Axis
Decision date: 2026-10-02
Risk: HIGH auth surface; reversible theme-only presentation change

The owner wants the visible on-prem login address to stay at `/auth/login`.
PAR shortened the authorization request but Keycloak subsequently exposes its
native `login-actions/authenticate` URL with `tab_id` and `client_data`.

Use the existing native Keycloak form and change its displayed history entry
with the same-origin History API. Load the helper early only for the `login`
page and `store-ops-admin-web` client. Also require HTTPS, the exact `store-ops`
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
required full GitHub checks. Rollback restores the previous Keycloak image;
this change requires no database, realm, cookie or application configuration edit.

The owner also requested a usable exit after an invitation/password setup.
Only the application's successful `accountUpdatedTitle` info page, with no
remaining actions or action URI, displays "İşlemler tamamlandı" and a primary
"Giriş yap" link to `/auth/login`. It starts a fresh application login rather
than revisiting a consumed invitation token or inventing a callback code/state.
Other info/confirmation/error messages retain native continuation and skip-link
rules. Validate the real execute-actions invitation through completion and a
new PKCE login, including mismatched passwords and consumed-token rejection.

Provider references: [History API](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState),
[native form](https://github.com/keycloak/keycloak/blob/26.7.3/themes/src/main/resources/theme/base/login/login.ftl),
[native session checker](https://github.com/keycloak/keycloak/blob/26.7.3/themes/src/main/resources/theme/base/login/resources/js/authChecker.js).
