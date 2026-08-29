# Keycloak Strict-Local Authentication Runbook

## Purpose and authority

This runbook describes the production-shaped, synthetic-only Keycloak path for
the HR Axis on-premise bundle. It is part of ONP-3 and does not authorize a
company-server installation, real users, company data, DNS/TLS activation, or
retirement of hosted Clerk.

The authoritative runtime artifacts live under `infra/onprem/core`. The older
development-only files `infra/docker-compose.keycloak.yml`,
`infra/keycloak/store-ops-realm.json`, and `infra/scripts/setup-keycloak.ps1`
must never be used in an on-premise release or offline deployment bundle. They
contain development assumptions that do not satisfy this runbook.

## Locked identity decision

- Existing Clerk users are not migrated or automatically linked by e-mail.
- Hosted Clerk remains unchanged as the rollback identity provider.
- Keycloak users will be recreated later by an authorized company operation.
- HR Axis remains the authorization source of truth. A valid Keycloak token is
  necessary but does not create company, region, store, employee, or action
  authority by itself.
- HR Axis never stores, receives, or logs a user's password.

## Production-shaped topology

- Keycloak 26.7.2 is pinned by immutable image digest.
- Keycloak runs in production mode; `start-dev` is forbidden.
- Keycloak uses a dedicated PostgreSQL database and role.
- Keycloak is attached only to the private `proxy` and `data` Compose
  networks; it has no host-published service or management port.
- Browser traffic reaches only the explicitly allowed realm/OIDC paths through
  the HTTPS reverse proxy.
- The Keycloak admin console and Admin REST API are not publicly routed.
- Health and metrics remain on the private management port.
- Realm data survives restart in PostgreSQL; disposable CI proof uses fresh
  synthetic volumes.

The public issuer and browser endpoints use the final HTTPS HR Axis origin.
The API verifies signatures through the private service-to-service JWKS URL.
Issuer, authorization, token, logout, callback, audience, and realm paths must
form one coherent configuration; near-matches fail closed.

## Bootstrap contract

Bootstrap is a one-shot, idempotent operation. It must:

1. stop all long-lived Keycloak nodes and start a temporary private bootstrap
   server only on the `proxy`/`data` networks;
2. wait for Keycloak and PostgreSQL readiness;
3. authenticate with a temporary bootstrap service account supplied only
   through secret files;
4. create or reconcile the `store-ops` realm and the public PKCE client;
5. configure exact redirect and post-logout redirect paths;
6. configure the `roles`, company, region, store-read, and assigned-store
   action-scope claim mappers;
7. configure the password-reset and e-mail-verification policy without sending
   a real message in synthetic CI;
8. verify the resulting realm/client contract;
9. remove the temporary bootstrap principal before reporting success;
10. start the long-lived Keycloak node only after bootstrap and identity binding
    complete successfully.

The operation must be safe to retry. Missing secrets, a conflicting realm or
client contract, failed verification, or failure to remove the temporary
principal is a `No-Go`. No default administrator, demo password, real e-mail,
token, subject, or raw identifier may appear in Git, logs, or evidence.

## Roles and authorization claims

The synthetic proof covers these roles:

- `STORE_MANAGER`
- `REGION_MANAGER`
- `REPORT_VIEWER`
- `STORE_PERSONNEL`
- `VISUAL_MERCHANDISER`

Tokens may carry role and scope claims, but the backend must still resolve the
current HR Axis membership and scope binding. Forged issuer, audience, role,
company, region, store-read, or assigned-store action claims fail. An assigned
action is allowed only after database authorization; an unassigned action
returns `403`.

## Browser login and session flow

1. The frontend starts authorization code flow with PKCE S256.
2. The browser authenticates on the allowed Keycloak realm endpoint.
3. Keycloak returns to the exact HTTPS callback path.
4. HR Axis establishes its encrypted, secure, HTTP-only browser session.
5. State-changing requests require the matching CSRF contract.
6. A stale CSRF token may be recovered once through the deterministic session
   recovery path; missing or invalid CSRF still fails closed.
7. Logout invalidates the HR Axis browser session and completes Keycloak realm
   logout before returning to the exact post-logout path.

No bearer token, refresh token, password, or session secret is persisted in
browser storage by this strict-local profile.

## Password, verification, and recovery e-mail

Keycloak provides the user-facing identity lifecycle:

- verify e-mail;
- forgot password;
- update password required action;
- optional TOTP enrollment when separately enabled.

The company must provide an SMTP relay before real-user activation. Required
operator inputs are the SMTP host, port, sender address, TLS/STARTTLS policy,
and—when the relay requires it—an authentication user and password. Sensitive
SMTP values are supplied through deployment secret files and are never stored
in the repository or printed in receipts.

The real reset flow is:

1. the user selects **Şifremi unuttum**;
2. Keycloak sends a short-lived, single-use reset link through the company
   relay;
3. the user sets a new password on Keycloak;
4. existing sessions are invalidated according to the realm policy;
5. HR Axis receives no password and only observes the later authenticated
   session.

Synthetic CI proves configuration wiring and fail-closed behavior without
contacting an external SMTP server. SMTP reachability, sender reputation,
delivery, expiry, and the final Turkish e-mail templates require a later
company-owned rehearsal.

## Required synthetic proof

The GitHub-hosted fresh-volume proof must establish:

- the pinned Keycloak image and digest are present in the signed manifest,
  SBOM, vulnerability scan, and license inventory;
- production startup is used and no default/demo credentials exist;
- only reverse-proxy ports are published;
- temporary bootstrap identity is removed after idempotent reconciliation;
- PKCE metadata, callback, logout, JWKS, mapper, and SMTP contracts match;
- five synthetic roles authenticate and preserve database authorization;
- forged and cross-scope attempts fail;
- invalid CSRF fails and stale-token recovery does not strand a valid session;
- restart preserves the realm while strict-local egress remains closed;
- logs and generated artifacts contain no secret or real identity data.

If a local Docker daemon is unavailable, only the GitHub-hosted proof may be
reported. Do not claim a workstation runtime rehearsal.

## Unresolved activation gates

- The Keycloak license receipt must retain
  `residualExternalReviewRequired: true`. Repository reconciliation is
  evidence preparation, not final component clearance; owner/legal review is
  required before activation.
- JWKS rotation and retired-key acceptance are intentionally emitted as
  `proved: false`, `status: unproven` in the synthetic receipt. A fresh Linux
  rehearsal with an approved rotation window is required before activation.
- The 4 vCPU/8 GiB resource redistribution is a synthetic rehearsal target
  pending Linux measurement and explicit owner approval; it is not a production
  capacity claim.

## Operator gates before real activation

The following remain unresolved external gates:

- company Linux server and approved resource envelope;
- company DNS name and TLS certificate chain;
- company SMTP relay, sender, and delivery rehearsal;
- owner-created permanent Keycloak administrator and rotation custody;
- authorized creation of real users and HR Axis membership bindings;
- backup/restore and restart rehearsal on the company environment;
- observation window and explicit cutover decision.

Until all gates are closed, production and real-user activation remain
`No-Go`.

## Rollback

Stop only the isolated on-premise Keycloak/runtime project after verifying its
project and volume identity. Never delete hosted Clerk users or configuration.
Synthetic rollback returns the test client to the previous isolated provider;
real cutover rollback requires the separately approved deployment runbook and
verified backup.
