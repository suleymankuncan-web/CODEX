# On-prem short login

Status: implemented; runtime activation requires the merged image proof.

The company deployment uses Keycloak PAR to POST its existing authorization
parameters and navigate with only `client_id` and a bounded `request_uri`.
The frontend image opts in; other builds retain their configured provider flow.
Keycloak may redirect to its native realm authentication URL. Do not alias the
login form outside the realm or rewrite authentication cookie paths to shorten
the address further.

Keep PKCE S256, same-tab verifier storage, callback state validation, the ten-minute
attempt limit, server-managed cookie sessions, roles, scopes, CSRF and logout.
A superseded PAR response cannot navigate with an overwritten verifier. Provider
failure shows the existing retry screen. The only extra public endpoint is the
exact same-realm PAR POST; admin endpoints remain denied.

Reopening a consumed callback without same-tab state, or an expired matching
attempt, starts a fresh on-prem login without redeeming the old code. A mismatched
state, malformed state or provider failure remains rejected. This recovery is
limited to direct OIDC with managed browser sessions.

Verification: targeted transport/state unit tests, managed-session and cookie
browser tests, on-prem proxy/provider contract tests, and an isolated Caddy against
the running Keycloak validate PAR entry, native cookies, form reload, invalid
references and public admin denial. CI proves legacy and managed PAR logins for
all five existing synthetic personas. No company credentials are used by proof.

Owner instruction overrides the selector's local full-release recommendation:
run only affected tests locally; keep the complete required GitHub CI gate.
Rollback uses the preceding frontend image and Caddy configuration; there is no
realm, database, identity or permission migration in this slice.
