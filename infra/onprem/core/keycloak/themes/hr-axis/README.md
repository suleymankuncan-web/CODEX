# HR Axis login theme

The owner-approved HR Labs storefront layout wraps Keycloak's inherited forms.
There is deliberately no custom `login.ftl`: Keycloak still owns the POST action,
credential identifier, field errors, password visibility, remember-me handling,
password reset and passkey flow. The layout retains native session checking.
The small custom script only controls help, placeholders and the Caps Lock hint.

The optimized Keycloak image copies this directory, the shared
`admin-web/src/styles/onprem-login.css` and `admin-web/src/assets/login-studio/`.
The realm bootstrap
selects `hr-axis` with Turkish as the default locale. Docker frontend builds set
`VITE_OIDC_AUTO_REDIRECT=true` to enter the existing PKCE flow directly. Other
frontend builds retain their existing login entry behavior.

The React entry renders the same layout while the existing PKCE redirect is
prepared; it never collects credentials. Its fields stay disabled until the
native Keycloak form takes over. Bootstrap errors offer a retry in the same
layout. Both the lazy-route fallback and the entry avoid the older login shell.
The shared stylesheet is scoped so hosted Clerk and application pages retain
their existing styles.

Assets are local; the page makes no third-party font or image requests. The
storefront image was generated for the approved prototype, and the supplied
HR Axis concept 06 logo is used without alteration. Geist's license is in
`login/resources/fonts/LICENSE`; Lucide's license is `LUCIDE-LICENSE`.

When upgrading Keycloak, compare `template.ftl` with the upstream base layout,
particularly session scripts, extension resources and nested form sections.
Verify failed/successful login, logout, password reset, password visibility,
remember-me and help, plus desktop and narrow mobile layouts.

Local installation evidence and the remaining browser check are recorded in
`docs/plans/keycloak-login-studio-v1.md`. Local mounts are not a published image
or a canonical image/offline proof receipt.
