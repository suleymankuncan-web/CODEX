# On-Premise Private Core Data Plane V1

Status: repository-ready; target-host execution gated

Risk: R5 database privileges, migration, Redis recovery, secrets, and network isolation

Scope: ONP-3B synthetic private core (database, Redis, and local Keycloak)

## Decision and boundary

ONP-3B supplies one isolated Compose project with Caddy, frontend, API, worker,
explicit migrator, explicit synthetic seed, PostgreSQL 16, Redis 7, and a
local Keycloak runtime with an explicit bootstrap reconcile and identity binder.
Only TCP 443 is published; Caddy runs as numeric UID 10001
on container port 8443 without added Linux capabilities. Strict-local Caddy
also disables OCSP stapling so a certificate AIA responder cannot introduce
undeclared egress. Certificate revocation and trust distribution remain an
IT-owned activation control.

The deployment verifier never installs or changes host firewall rules.
Corporate interface, DNS, TLS delivery, approved client networks, SSH
administration scope, and the exact IT-11 policy are activation inputs. The
required GitHub-hosted proof temporarily installs an isolated synthetic policy,
restores the runner's original policy through an `EXIT` trap, and does not
represent corporate activation. The read-only verifier fails if it cannot see
complete raw, mangle, nat, and filter tables, or if it finds an early accept,
an incomplete project-subnet allowlist, a broad RFC1918 exception,
NAT/NOTRACK/mark bypass, private-subnet host access, or an inbound port outside
443 and scoped SSH.

The repository proof verifies that 443 is the only published application port.
Corporate client-CIDR enforcement for Docker-forwarded 443 traffic remains an
IT activation gate and must be enforced in the target host's forwarding path;
the synthetic INPUT policy is not accepted as company client scoping.

Keycloak is attached only to the private `proxy` and `data` networks. The
bootstrap service is a temporary private server on those networks: all
long-lived Keycloak nodes remain stopped while `bootstrap-admin service` and
the in-place realm reconcile run, and Keycloak is started only after the
bootstrap and identity binder complete successfully.

Rollback is a two-step boundary: ordinary `down` always preserves volumes;
synthetic volume deletion is a separate exact-identity destructive action.
Neither action touches hosted services or user data.

## Topology and resources

| Service | Networks | CPU | Memory | PID ceiling | Lifecycle |
| --- | --- | ---: | ---: | ---: | --- |
| Caddy | edge, proxy | 0.25 | 128 MiB | 64 | long-lived |
| frontend | proxy | 0.25 | 128 MiB | 64 | long-lived |
| API | proxy, app, data | 0.75 | 1536 MiB | 192 | long-lived |
| worker | app, data | 0.75 | 1536 MiB | 192 | long-lived |
| Keycloak | app, data | 0.5 | 2048 MiB | 256 | long-lived |
| PostgreSQL | data | 1.0 | 2048 MiB | 192 | long-lived |
| Redis | data | 0.5 | 768 MiB | 96 | long-lived |
| Keycloak bootstrap | app, data | 0.5 | 1 GiB | 128 | explicit one-shot |
| identity binder | app, data | 0.5 | 512 MiB | 128 | explicit one-shot |
| migrator | app, data | 0.5 | 512 MiB | 128 | explicit one-shot |
| synthetic seed | app, data | 0.5 | 512 MiB | 128 | explicit one-shot |

The resource table is a synthetic rehearsal target, pending fresh Linux
measurement and explicit owner approval; it is not a production sizing claim.
The Keycloak bootstrap one-shot ceiling is a fresh-Linux rehearsal correction:
official Keycloak container guidance calls for at least 750 MiB to approximate
the former 512 MiB heap, and the temporary server plus repeated JVM `kcadm`
processes need headroom beyond the former 0.25 CPU/512 MiB limit. The 0.5 CPU/
1 GiB ceiling is not production sizing and does not change the long-lived
Keycloak or steady-state totals.
The target steady runtime total is 4 vCPU and 8 GiB; one-shot ceilings are
additional and are not part of that steady total. Required order is PostgreSQL/Redis, migrator, synthetic seed,
Keycloak bootstrap, identity binder (`run --rm --no-deps`), then the runtime
services. Keycloak must be stopped before bootstrap and is restarted only
after the reconcile succeeds. Every long-lived service has a health check,
restart policy, PID/resource ceilings, bounded `json-file` rotation, and stop
grace. Proxy, app, and data are internal Docker networks. Edge is also a
pinned subnet so Caddy egress is covered by IT-11.

## Database and Redis contracts

The initial PostgreSQL bootstrap owner creates three application roles:

| Role | Purpose | Privilege boundary |
| --- | --- | --- |
| `hr_axis_migrator` | database/schema owner and explicit migrations | login, NOINHERIT, no cluster database/role creation |
| `hr_axis_api` | API and unchanged synthetic seed | login, NOINHERIT, CONNECT/USAGE, DML/sequences/functions only |
| `hr_axis_worker` | worker runtime | login, NOINHERIT, CONNECT/USAGE, DML/sequences/functions only |

Public database privileges and public-schema CREATE are revoked. Migrator
default privileges grant runtime schema USAGE, table DML, sequence access, and
function execution without schema CREATE. The runtime harness requires a DDL
attempt to fail with SQLSTATE `42501`. The backend migrator must hold the
deterministic advisory lock, execute every migration in order, reject both an
orphaned ledger row and a checksum mismatch, restore the exact ledger after
each negative probe, and make an unchanged second run a no-op.

PostgreSQL server TLS is mandatory with a local certificate, key, and CA. API,
worker, migrator, and seed retain `verify-full`; no production SSL weakening is
permitted. Redis uses a mounted ACL file, AOF `everysec`, 640 MiB maxmemory
under its 768 MiB container limit, and `noeviction`. Accepted recovery is the
same labelled volume after a Redis process/container restart. Volume loss is a
No-Go, not a rehearsed recovery mode.

API and worker Redis users are restricted to their fixed rate-limit and BullMQ
key prefixes. Administrative and destructive commands, including `FLUSHALL`,
`FLUSHDB`, `SWAPDB`, and `MIGRATE`, are denied and tested for both roles.

## Secret preparation gate

Start only after every source under `infra/onprem/core/secret-files/` has the
owner and mode documented in that directory's README. Local Compose bind
mounts do not implement a uid/gid/mode rewrite. The full runtime harness checks
the host file metadata before mutation and scans the rendered Compose model for
every secret value. Secret values must never occur in Compose output, inspect,
commands, health output, logs, or the sanitized receipt.

The non-secret `env.template` contains only public host/release/image identity
fields and immutable image examples. Replace the all-zero application digest
placeholders. Disabled Sentry, Qwen, browser-cookie session, photo storage, and
other providers have no credential file or secret environment key.

## Operator sequence

1. Verify the signed release manifest and exact image identities outside this
   ONP-3B slice.
2. Confirm the runtime profile is down.
3. Run `docker compose config` with the approved env file and retain no output
   containing secret material.
4. Validate host policy read-only:

   ```sh
   sudo node scripts/onprem-core-firewall-verify.mjs \
     --subnet 172.30.0.0/24 --subnet 172.30.10.0/24 \
     --subnet 172.30.20.0/24 --subnet 172.30.30.0/24 \
     --proxy-port 443 --ssh-admin-cidr '<approved-admin-cidr>'
   ```

5. Start PostgreSQL and Redis only.
6. Run the migrator explicitly. Run it a second time and verify the same
   migration count/checksum aggregate with no new apply.
7. Run the explicit synthetic seed through `hr_axis_api` and record only
   aggregate counts.
8. While every long-lived Keycloak node is stopped, run the temporary private
   Keycloak bootstrap reconcile, then run `identity-binder` with `--rm
   --no-deps`. Record only aggregate
   subject counts; never retain the private subject manifest in evidence.
9. Start Keycloak, API, worker, frontend, and Caddy. Never enable runtime
   auto-migration.
10. Execute the fail-closed runtime proof on the approved Linux host:

   ```sh
   sudo node scripts/onprem-core-runtime-proof.mjs --execute \
     --compose infra/onprem/core/compose.yaml \
     --env-file /approved/onprem-core.env \
     --project hr-axis-onprem-core \
     --release-id '<exact-signed-release-id>' \
     --ssh-admin-cidr '<approved-admin-cidr>' \
     --receipt /approved/sanitized-onprem-core-receipt.json
   ```

The harness fails closed if immutable identities, secret metadata, only-Caddy
port publishing, health/resources/networks/volumes, migration idempotency and
negative-state rejection, seed aggregates, DDL denial, Redis AOF same-volume
recovery, exactly-once terminal job state, the complete five-table seed
aggregate and exact migration-ledger identity after both PostgreSQL and full
project restarts, graceful
stop, full firewall evidence, conntrack availability, or zero project-origin
external flows cannot be proven. Its Redis proof enqueues a delayed job, stops
Redis gracefully, observes API and worker become unhealthy, restarts the same
volume, observes recovery, then processes and verifies one completion marker.
Bootstrap failure output is limited to the exact allowlisted phase/category
diagnostic and bounded exit/signal fields; malformed, multiple, or
secret-bearing output remains generic and raw logs are never retained in the
receipt.
`iptables-save -c` reject-counter deltas are authoritative attempted-egress
evidence; conntrack is supplemental accepted-flow evidence. The harness does
not delete volumes and does not install firewall tooling or rules.

The TLS proof uses an isolated, read-only backend-image client attached only to
the internal proxy network. It validates the Caddy certificate chain and the
approved synthetic hostname against the mounted public CA without an insecure
TLS flag. The API receives 25 seconds and the worker 40 seconds to close inside
their Compose stop-grace ceilings. A BullMQ job that cannot close inside the
worker ceiling is not reported as completed; the non-zero exit leaves it
eligible for the existing stalled-job recovery policy.

## Rollback and deletion

Ordinary rollback:

```sh
node scripts/onprem-core-down.mjs infra/onprem/core/compose.yaml /approved/onprem-core.env
```

Do not add `-v` or `--volumes`. If the owner separately approves destroying
the synthetic rehearsal data, first prove no project container uses the
volumes, then invoke the deletion gate with the exact labels:

```sh
node scripts/onprem-core-delete-synthetic-volumes.mjs \
  --project hr-axis-onprem-core \
  --release-id '<exact-signed-release-id>' \
  --confirm-delete-synthetic-volumes
```

An identity, label, data-class, volume-class, or in-use container mount refuses
deletion before either volume removal is attempted.

## Requirements mapping

| Requirement | ONP-3B evidence |
| --- | --- |
| FR-1, FR-2 | strict-local Compose topology, explicit service profiles, and local Keycloak bootstrap/binder order |
| FR-4 | one-shot locked migrator, second-run, orphan/checksum negative proof, runtime migration disabled |
| FR-7 | missing external-provider credentials, disabled flags, internal networks, host policy and conntrack observation |
| NFR-1 | missing identities/secrets/firewall evidence fail closed; DDL SQLSTATE 42501 |
| NFR-2 | synthetic labels, unchanged deterministic seed, aggregate-only receipt |
| NFR-3 | exact operator order, health, shutdown, rollback, and deletion commands |
| NFR-4 | no hosted runtime dependency or external provider credential |
| NFR-5 | limited here to same-volume Redis/PostgreSQL restart; backup/restore remains ONP-5 |
| NFR-6 | exact digests/counts/states without credentials, raw UUIDs, keys, or payloads |
| NFR-7 | exact 4 vCPU steady ceilings and 8 GiB container-memory envelope |
| NFR-8 | same backend/frontend business artifacts; infrastructure differs by configuration |
| AC-1 | clean-host installation remains ONP-5; ONP-3B supplies its fail-closed core harness |
| AC-2 | only host TCP 443; all service ports private |
| AC-3 | health checks for all long-lived ONP-3B services, including Keycloak |
| AC-6 | exactly-once terminal BullMQ job survives accepted Redis same-volume restart |
| AC-10 | exact project-subnet allowlist, zero reject-counter delta, and supplemental zero project-origin conntrack flows |
| AC-12 | isolated project and no hosted provider mutation or retirement |

## No-Go and residual gates

- Full runtime PASS requires the backend ONP-3B compiled entries
  `dist/src/onprem/migrate.js`, `dist/src/onprem/seed-synthetic.js`,
  `dist/src/onprem/worker-health.js`, and
  `dist/src/onprem/synthetic-queue-probe.js` with strict-local `*_FILE`
  support.
- The existing required `onprem-image-proof.yml` has one unconditional
  GitHub-hosted Linux `proof` job. It builds each application image once, binds
  the signed manifest, SBOM, vulnerability scan, content/license evidence, and
  the full runtime rehearsal to those exact image IDs, requires fresh labelled
  volumes, installs a reversible synthetic firewall, and uploads the sanitized
  receipt.
  Target-host IT-11 activation remains a separate read-only verification gate.
- Its first PR run is also the runner-minute baseline measurement. The single
  job avoids rebuilding unscanned image identities and avoids duplicate runner
  minutes. No claim is made that total runner minutes remain within the 110%
  orchestration threshold until that run is measured. A breach requires an owner decision
  before further CI expansion or before treating this topology as the stable
  orchestration baseline.
- Corporate DNS, certificate delivery, client/SSH CIDRs, host firewall,
  conntrack visibility, disk encryption, and backup failure domain remain IT
  activation inputs.
- Identity/login acceptance is ONP-3. Object storage and photo acceptance are
  ONP-4. Backup/restore/offline installation is ONP-5.
- Real data, provider calls, company hosts/IPs, production deployment, hosted
  cutover, and hosted rollback deletion remain unauthorized.

## Unresolved activation gates

- The Keycloak license receipt must retain
  `residualExternalReviewRequired: true`; repository reconciliation is not
  final component clearance. Owner/legal review is required before activation.
- JWKS rotation and retired-key acceptance are intentionally reported as
  `proved: false`, `status: unproven` in the synthetic receipt. A fresh Linux
  rehearsal with an approved rotation window is required before activation.
