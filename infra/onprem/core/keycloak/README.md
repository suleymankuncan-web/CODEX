# ONP-3B Keycloak artifacts

`realm-config.json` is a sanitized, user-free reference configuration. It is
not imported directly at container start and contains no account, password,
e-mail, token, private key, or company identifier.

`bootstrap.sh` performs an in-place Admin REST reconciliation through
`kcadm.sh`. All temporary bootstrap credentials, SMTP auth values, and optional
CI synthetic-account rows are mounted Docker secrets. The script has no shell
trace, suppresses mutation output while preserving bounded query output,
never deletes/recreates the realm, and removes the temporary `bootstrap-*` master principal before publishing
`/var/lib/keycloak-bootstrap/subjects.v1.json`.

The subject manifest is private runtime state only. It is versioned as
`onprem-keycloak-subjects-v1`, mode `0600`, and may contain exact synthetic
Keycloak subjects for the authorized binder. It must be mounted read-only by
consumers and must never appear in Git, image layers, CI receipts, logs, or
public artifacts.

SMTP values are a wiring contract. CI uses an invalid synthetic relay host and
does not make a network call. The company SMTP relay, sender, TLS policy, and
credential rotation remain external IT gates. Hosted Clerk is not changed and
no user migration or e-mail auto-linking is attempted.

The company operator may set both `KEYCLOAK_SSO_IDLE_REMEMBER_ME_SECONDS` and
`KEYCLOAK_SSO_MAX_REMEMBER_ME_SECONDS` to `604800` for the approved seven-day
Remember Me policy. Both default to `0`, which leaves the normal realm SSO
limits unchanged; bootstrap rejects partial, nonnumeric, or out-of-range
settings. `BROWSER_SESSION_TTL_SECONDS=3600` reduces app-session redirects but
does not store a password or grant access after the Keycloak SSO session ends.
