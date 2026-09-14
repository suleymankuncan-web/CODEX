# Local Keycloak login implementation — 14 September 2026

The owner approved the standalone HR Labs login and requested the same screen in Docker, removal of the preview label, and a local installation using the GitHub package.

Surface: on-premises Keycloak authentication pages, with the Docker frontend entering the existing OIDC flow automatically. All existing personas use the same sign-in form. The primary task is signing in with username and password together. The approved spacious storefront photograph, centered white form and blue primary button are the visual contract; mobile stacks the heading and form. Hosted Clerk behavior, authorization scopes, PKCE/state verification, native login submission and backend APIs remain unchanged.

Implementation: inherit Keycloak's native forms; supply a layout, local imagery/fonts, Turkish messages, CSS and help disclosure. Include the theme in the Keycloak image and reconcile the realm theme/locale. Enable direct OIDC entry only through the Docker build flag `VITE_OIDC_AUTO_REDIRECT`; ordinary builds retain their existing behavior.

Verification plan: frontend lint/build and relevant auth/script contracts, actual failed and successful Keycloak sign-in, return to application and logout, desktop/mobile layout, password visibility and help. Self-review the native form/session-script integration and OIDC boundary. No PR, remote deployment, image publication or new canonical image/offline proof is claimed by this local installation.

Local installation: the last successful signed GitHub offline artifact is `onprem-offline-8899efce907f` from run 32924025570. Its signature/file closure and loaded image configuration digests were verified. It is older than current main. The local instance mounts the approved theme plus a freshly built frontend over the verified images; this is an explicit local customization, not a newly published bundle. The bundle's bootstrap revision is retained locally with only the four theme/locale settings added. Runtime files, certificates, synthetic account credentials and receipts stay outside Git. Docker Desktop failed with a Windows socket startup error, so the installed native Docker Engine in Ubuntu WSL is used with a separate `hr-axis-login` compose project and ordinary Docker data root, outside the disposable rehearsal daemon.

Observed verification: frontend lint and production build passed; 250 unit tests
and 133 frontend script tests passed. Targeted on-prem/auth contracts passed
78 tests with one Windows-only POSIX-shell skip. A TLS-verified provider probe
returned HTTP 200 and confirmed the inherited username/password form, custom
stylesheet and absence of the HR Labs label. All seven steady-state containers
are healthy. The old port 5188 preview is stopped; only the new application
exposes port 443. This does not prove successful browser authentication.

First-paint correction: the owner observed the older LUFIAN login card before
the redirect and requested only the new design at every stage. The Docker entry
and lazy fallback now render the approved storefront layout, with disabled
credential fields until Keycloak takes over. Both use one shared stylesheet
and image source; the old login shell class is absent from the Docker route.
Six first-paint regression tests cover pending/configured bootstrap, failed and
missing configuration recovery, manual OIDC entry and hosted Clerk isolation.
The updated local frontend is mounted from `frontend-dist-v2`; the updated
provider template and shared assets render HTTP 200 without provider errors.
The owner authorized one PR and squash merge after design verification and
required checks. URL masking was explicitly deferred; native realm paths stay.

Browser verification completed with trusted HTTPS and no certificate bypass:
native form, Turkish invalid-credentials error, approved help, password visibility,
reset-page navigation without sending email, successful synthetic Store Manager
login, authenticated reload, native logout and return to the new form. Desktop
1440/1024 and mobile 390/320 layouts passed visual/overflow checks. Screenshots
and a hash-bound receipt remain in the private local QA directory. Credentials
remain private; WSL is kept alive by the active local session.

The owner subsequently requested a staggered entrance while preserving this
design, with an isolated commit so animation can be reverted independently.
Remaining: implement/inspect that motion, resolve generated-document/env-inventory
guards, complete canonical release, then open and squash-merge one PR.

Self-review: authentication uses the inherited provider form and existing
PKCE/state/session flow. No custom password submission, token storage, role,
scope, database or API changes are introduced. The bootstrap theme/locale
selection and Docker-only direct-entry flag are intentional configuration
changes. Rollback must restore the realm login theme to `keycloak` before
deploying a prior image without the theme; reverting the frontend flag restores
manual entry. Existing users, sessions and business records must be preserved.

Role matrix: all five bundled synthetic personas receive the same sign-in
screen; role and store routing remains the existing authenticated application
decision. Desktop/mobile layout reference is the owner-approved prototype in
the external HR Labs folder, with their requested actual logo, help copy and
removal of the lab footer. Form errors and reset flows remain provider-owned.
