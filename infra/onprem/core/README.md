# HR Axis ONP-3B private core

This directory is the isolated, synthetic-only ONP-3B data plane. It contains
the production-shaped local Keycloak runtime and does not install a hosted
provider, Nebim, Sentry, Qwen, object storage, or real company data. Only Caddy
publishes a host port: TCP 443 maps to its unprivileged 8443 listener. All
application, database, Redis, and Keycloak ports remain private Compose
networks.

Photo storage is deliberately a separate, versioned ONP-4B overlay. The base
core keeps `PHOTO_MEDIA_STORAGE_ENABLED=false`; when the overlay is included,
it merges into this same Compose project, adds a private SeaweedFS service on
the internal data network, and supplies synthetic-only API/worker settings.
Production has no object-storage host port. The proof-only overlay is the sole
place where an ephemeral loopback port is mapped. See
`infra/onprem/photo-storage/README.md` for the proof command and production
stop gates.

Hosted Clerk remains untouched. Keycloak users are recreated later only by an
authorized company operation; no user migration or e-mail auto-linking is
performed here. CI and local rehearsal use synthetic accounts and never call a
real SMTP relay. Company SMTP relay setup is an external IT gate. Production
activation and capacity remain **No-Go** until the host, TLS, firewall,
resource, backup/restore, and observation gates are separately accepted.

## Required order

Use exact signed image and release identities in a private env file derived
from `env.template`. Never use the all-zero application image placeholders for
execution. Prepare every file-backed secret before starting Compose.

```sh
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile infra up -d postgres redis
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile migrate run --rm migrator
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile seed run --rm synthetic-seed
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile keycloak-bootstrap run --rm keycloak-bootstrap
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile identity-binder run --rm --no-deps identity-binder
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile runtime up -d api worker frontend caddy keycloak
```

The bootstrap is a one-shot reconcile. While the long-lived Keycloak service is
stopped, it invokes the optimized image's `kc.sh bootstrap-admin service` to
create a per-run temporary master service client, starts a local short-lived
server, and then creates or updates only the `store-ops` realm, the public PKCE
browser client, role/claim mappers, and the SMTP configuration contract. It
never imports users, deletes a realm, or logs credentials/tokens. The temporary
`bootstrap-*` principal is removed before the synthetic subject manifest is
atomically published. A retry against the persisted volume reuses only an
interrupted temporary client (if present), reconciles in place, and removes it
before publishing state; no permanent administrator is retained.

`keycloak_bootstrap_state/subjects.v1.json` is private runtime state (mode
`0600`), not a release artifact. Its schema is
`onprem-keycloak-subjects-v1`, `dataClass=synthetic`, `provider=oidc`, and a
list of account keys, exact runtime subjects, role codes, and aggregate read /
assigned-store scope counts. It must be mounted read-only by any later binder;
it must never be copied into logs, receipts, screenshots, or public artifacts.

API and worker never depend on or invoke the migrator. The seed one-shot uses
the DML-only API role and executes the unchanged
`db/seeds/001_reference_seed.sql`. Migrator, seed, and bootstrap ceilings are
additional one-shot capacity and are not part of the 4.0-vCPU steady budget.

## Keycloak contract

- The pinned upstream base is
  `quay.io/keycloak/keycloak:26.7.0@sha256:0f198be292568439d700cdbfb893e69a6009bb43a94a06a945b1d3d506c76b13`.
  `infra/onprem/images/keycloak.Dockerfile` builds the final image with
  `kc.sh build --db=postgres --health-enabled=true --metrics-enabled=true`;
  the approved env file must contain the owner-signed digest of that final
  image, not a mutable proof tag or raw upstream image.
- Startup is `start --optimized`; `start-dev`, default admin credentials, and
  realm imports containing demo users are forbidden.
- PostgreSQL uses a dedicated `keycloak` database and role. Both credentials
  and the temporary bootstrap principal are Docker secret files.
- Caddy exposes only the browser PKCE authorization, token, logout, JWKS,
  realm metadata, login-action, and static resource paths under
  `/realms/store-ops` and `/resources`. `/auth/admin*` and all other
  Keycloak paths fail closed. `/auth/login`, `/auth/callback`, and
  `/auth/logout` remain HR Axis SPA routes.
- Health and metrics use Keycloak management port 9000 on the private network;
  no Keycloak host port is published.
- Realm reset-password and verify-email flows are enabled.
  SMTP host/port/from/starttls/auth values are operator inputs; CI proves only
  secret wiring and makes no outbound SMTP call.

The steady resource ceilings are API `0.75` vCPU / `1536m`, worker `0.75` /
`1536m`, PostgreSQL `1.0` / `2048m`, Keycloak `0.5` / `2048m`, Caddy `0.25` /
`128m`, frontend `0.25` / `128m`, and Redis `0.5` / `768m`: exactly 4.0 vCPU
and 8 GiB container memory. The 2 GiB Keycloak cap is a rehearsal ceiling,
not a production-capacity claim; host overhead, JVM sizing, disk latency, and
failure-recovery load must be measured by IT before any activation decision.

## Secret files

`secret-files/` is ignored. Compose file-backed secrets are bind mounts and do
not change host ownership or permissions. ONP-5 will automate creation and
rotation; until then the operator must prepare them before `compose up`:

| Files | Linux owner | Mode |
| --- | ---: | ---: |
| `caddy/server.key` | `10001:10001` | `0400` |
| `postgres/server.key`, `postgres/*-password` | `70:70` | `0400` |
| `redis/users.acl`, `redis/health-url` | `999:1000` | `0400` |
| `backend/*` | `65532:65532` | `0400` |
| `keycloak/database-url`, `keycloak/database-username`, `keycloak/bootstrap-*`, `keycloak/smtp-*` | `1000:1000` or operator-controlled | `0400` |
| `keycloak/database-password` | `1000:1000` | `0400` |
| `postgres/keycloak-password` | `70:70` | `0400` |
| `keycloak/synthetic-accounts` | operator-controlled | `0400` when CI synthetic accounts are enabled |
| public certificates and CA files | operator-controlled | read-only, no group/other write |

Do not create empty Sentry, Qwen, cookie-session, object-storage, or hosted
provider credential files for the base core. Disabled features prove absence
through missing configuration, not an empty mounted credential. If the
optional photo-storage overlay is being exercised, provision its four
non-empty file-backed credentials outside Git as described in the photo
storage README; never put values in the repository or the non-secret env
template.

The PostgreSQL-side `postgres/keycloak-password` and Keycloak-side
`keycloak/database-password` files are two ownership-bound copies of the same
credential. Before any Compose start, the operator must fail closed unless
their byte digests match (for example,
`test "$(sha256sum postgres/keycloak-password | cut -d' ' -f1)" = "$(sha256sum keycloak/database-password | cut -d' ' -f1)"`).
Rotation is coordinated: stage the new value privately, verify both copies
match, atomically replace and re-apply each owner/mode, stop Keycloak and its
bootstrap one-shot, re-run the digest preflight, then reconcile bootstrap and
start the runtime. Never rotate one copy independently or start a partially
rotated pair.

## Recovery boundary

Redis recovery covers AOF `everysec` process/container restart on the same
labelled `redis_data` volume. PostgreSQL, Redis, Keycloak, and subject-state
volumes are preserved by ordinary rollback:

```sh
node scripts/onprem-core-down.mjs infra/onprem/core/compose.yaml /approved/onprem-core.env
```

The separate `onprem-core-delete-synthetic-volumes.mjs` command requires the
exact project, release label, synthetic data-class label, volume class, and an
explicit destructive confirmation. It is not part of rollback and must never
target a company or hosted volume.

See `docs/runbooks/onprem-core-data-plane-v1.md` and
`docs/plans/keycloak-local-auth-runbook.md` for proof and activation gates.
The optional photo-storage overlay has its own labelled volume cleanup and
synthetic snapshot/restore rehearsal; a same-host rehearsal volume is not a
production recovery copy, and ONP-5/IT backup gates remain open.
