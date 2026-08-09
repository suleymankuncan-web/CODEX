# HR Axis ONP-2 private core

This directory is the isolated, synthetic-only ONP-2 data plane. It does not
install identity, object storage, real data, Nebim, Sentry, Qwen, or any hosted
provider. Only Caddy publishes a host port: TCP 443 maps to its unprivileged
8443 listener. `/auth` returns `503` with `identity_not_installed` until ONP-3.

## Required order

Use exact signed image and release identities in a private env file derived
from `env.template`. Never use the all-zero image placeholders for execution.

```sh
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile infra up -d postgres redis
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile migrate run --rm migrator
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile seed run --rm synthetic-seed
docker compose --env-file /approved/onprem-core.env -f infra/onprem/core/compose.yaml --profile runtime up -d api worker frontend caddy
```

API and worker never depend on or invoke the migrator. The seed one-shot uses
the DML-only API role and executes the unchanged
`db/seeds/001_reference_seed.sql`. Migrator and seed ceilings are additional
one-shot capacity; do not run them while the runtime profile is active.

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
| public certificates and CA files | operator-controlled | read-only, no group/other write |

The backend files contain only the role-specific PostgreSQL/Redis URLs and JWT
verification secret required by enabled strict-local features. Do not create
empty Sentry, Qwen, cookie-session, object-storage, or other provider secret
files. Disabled features prove absence through missing configuration, not an
empty mounted credential.

## Recovery boundary

Redis recovery covers AOF `everysec` process/container restart on the same
labelled `redis_data` volume. Redis-volume destruction is not recoverable in
ONP-2 and must never be described as PASS. PostgreSQL and Redis volumes are
preserved by ordinary rollback:

```sh
node scripts/onprem-core-down.mjs infra/onprem/core/compose.yaml /approved/onprem-core.env
```

The separate `onprem-core-delete-synthetic-volumes.mjs` command requires the
exact project, release label, synthetic data-class label, volume class, and an
explicit destructive confirmation. It is not part of rollback.

See `docs/runbooks/onprem-core-data-plane-v1.md` for proof and activation gates.
