# HR Axis On-Premise Private Container Deployment Plan V1

Status: Proposed; planning only

Baseline: `3b1b3f5c9e4447b18d7eceb352de1c111c7fb4e1`

Branch: `codex/on-prem-deployment-foundation-v1`

Risk: R5

Owner: Project owner

Target: Company-controlled Linux server, private data plane, Docker Compose

## 1. Purpose

Prepare HR Axis so the owner can deliver and operate it on a company-controlled
Linux server without transferring the source repository and without requiring
Cloudflare, Render, Supabase, Clerk, R2, Sentry, or Alibaba Model Studio at
runtime.

The first accepted environment is a synthetic-data rehearsal. Real company
data, Nebim connectivity, real photographs, production cutover, and deletion
of the current hosted rollback path are separate activation gates.

## 2. Current Repository Truth

The baseline already provides useful foundations, but it is not an on-premise
production package:

- the backend and frontend have multi-stage Dockerfiles;
- the backend runtime image currently contains production dependencies and
  compiled JavaScript, but it is not yet non-root, read-only, content-audited,
  signed, or delivered as an offline release bundle;
- the frontend runtime image contains the Vite build under Nginx, but the build
  contract is still shaped around hosted-provider variables;
- `infra/staging/docker-compose.yml` contains only Caddy, frontend, and API;
- `infra/docker-compose.live-e2e.yml` contains test-only PostgreSQL 16 and
  Redis 7 with host ports and test credentials;
- `infra/docker-compose.keycloak.yml` uses `start-dev`, default credentials,
  demo users, and an exposed development port;
- the application database is standard PostgreSQL plus `pgcrypto`; no
  Supabase-specific auth or storage schema is required by the canonical schema;
- browser auth already supports OIDC authorization code plus PKCE and backend
  JWT/JWKS verification;
- photo storage already uses the AWS S3 client with path-style addressing, but
  its configuration contract hard-codes provider `r2`, jurisdiction `eu`, and
  the current synthetic-only R2 decision;
- workers already have a separate `dist/src/workers.js` entry point and BullMQ
  support;
- the canonical migration path is `npm run db:migrate`.

Fresh implementation evidence must revalidate these statements before each
slice. They are planning inputs, not permanent assumptions.

## 3. Locked Architecture Decisions

| ID | Decision | Reason |
| --- | --- | --- |
| ONP-D1 | Use Ubuntu Server 24.04 LTS with Docker Engine CE, Buildx, and the Docker Compose plugin. Do not require Docker Desktop. | Free server runtime and production-shaped Linux behavior. |
| ONP-D2 | Use Docker Compose, not Kubernetes, for the first single-server deployment. | Smallest operable platform for the current scale. |
| ONP-D3 | Keep PostgreSQL. Do not port HR Axis to the company's MySQL instance. | The schema, migrations, queries, and invariants are PostgreSQL-native. |
| ONP-D4 | Use a local production-mode Keycloak instance as the independent HR Axis identity provider. | Keeps identity inside the HR Axis package and removes hosted Clerk dependency. |
| ONP-D5 | Use a provider-neutral S3-compatible local object-store adapter. Select the concrete engine only after its current license, backup behavior, and S3 compatibility pass the ONP-4 gate. | Avoids hard-coding another provider before evidence. |
| ONP-D6 | Runtime egress is denied by default. Sentry and Qwen are disabled. | Keeps company data within the company boundary. |
| ONP-D7 | Nebim is not implemented in this plan. Reserve an internal import-worker boundary only. | Exact endpoint, auth, payload, stable-IP, schedule, and ownership are not yet known. |
| ONP-D8 | Source remains owner-controlled. Deliver immutable production images, Compose/config templates, checksums/signatures, SBOMs, and runbooks—not the Git repository. | Limits routine source exposure while keeping deployment reproducible. |
| ONP-D9 | IT root access cannot be technically hidden from a determined root administrator. The control objective is least exposure, separation of duties, signed artifacts, and auditability—not impossible secrecy. | Root can inspect images, volumes, memory, processes, and secrets. |
| ONP-D10 | Keep the current hosted stack available as a rollback path until the on-prem acceptance and observation window closes. | Prevents an irreversible cutover. |
| ONP-D11 | Use synthetic fixtures only during local package development and rehearsal. | Avoids accidental company-data movement before approval. |
| ONP-D12 | No automatic database migration on API startup. A one-shot migrator runs explicitly before API/worker activation. | Makes schema change and rollback decisions observable. |

## 4. Non-Goals

- no production deployment or live cutover;
- no real company, personnel, store, target, incentive, checklist, or photo data;
- no Nebim network call or guessed Nebim adapter;
- no MySQL migration;
- no Kubernetes, service mesh, multi-node database cluster, or premature HA;
- no LDAP/Active Directory integration;
- no external AI or error-tracking call from the strict-local profile;
- no source-code obfuscation claim and no promise that root cannot reverse
  engineer compiled artifacts;
- Repository implementation must not install WSL or Docker on the owner's workstation.
- no real-photo activation or weakening of the current media safety gates;
- no removal of Cloudflare, Render, Supabase, Clerk, or R2 until cutover is
  separately approved and rollback expiry is reached.

## 5. Target Topology

Only the reverse proxy exposes host ports. All other services use private
Compose networks.

```text
Corporate client
    |
    | HTTPS 443: hr-axis.example.invalid
    v
Caddy reverse proxy
    |-- /              -> frontend (unprivileged static server)
    |-- /api           -> NestJS API
    `-- /auth          -> Keycloak

Private application network
    |-- NestJS API
    |-- NestJS worker
    |-- one-shot migrator
    |-- Redis 7
    |-- PostgreSQL 16
    |-- local S3-compatible object storage
    `-- Keycloak

Separate backup failure domain
    |-- encrypted PostgreSQL backups
    |-- object-store backup/replica
    `-- signed release manifests and restore receipts
```

The initial supported data plane is PostgreSQL 16 because the repository's
existing live E2E contract already exercises that major version. A later major
upgrade must have its own compatibility and restore rehearsal.

## 6. Service Contract

### 6.1 Reverse proxy

- Accept only `80` for redirect and `443` for application traffic.
- Prefer an IT-provided certificate and CA chain for an internal domain.
- Do not rely on public ACME when the target is private-only.
- Apply security headers and request-body limits without breaking photo upload
  contracts.
- Preserve real client IP only through the explicitly configured trusted proxy
  hop.

### 6.2 Frontend

- Build once in a trusted owner-controlled build environment.
- Serve only compiled static assets; do not include source maps, tests,
  development assets, `.env` files, or repository metadata.
- Use a domain-neutral same-origin `/api` path and local OIDC bootstrap data so
  the frontend image does not need rebuilding when IT supplies the final host.
- Include no secret in Vite build variables; browser-visible values remain
  public by definition.
- Disable Sentry in the strict-local profile.

### 6.3 API and worker

- Use the same immutable backend image with distinct API and worker commands.
- Run as a non-root UID/GID with a read-only root filesystem, `tmpfs` only for
  explicit temporary paths, dropped Linux capabilities, `no-new-privileges`,
  bounded PIDs, health checks, and graceful shutdown.
- API and worker use separate database roles where practical and never use the
  schema-owner credential.
- Worker uses BullMQ over private Redis.
- Qwen and all external AI switches remain disabled in the strict-local
  profile.

### 6.4 PostgreSQL

- Use separate databases or roles for HR Axis and Keycloak.
- Minimum roles: cluster/bootstrap owner, HR Axis migrator, HR Axis runtime,
  Keycloak runtime, and backup operator.
- Only the migrator may alter the HR Axis schema.
- Do not expose PostgreSQL on a host port in the release profile.
- Persist data on an IT-approved SSD-backed volume.
- Keep database credentials in mounted secret files, not Compose values,
  images, logs, or evidence.

### 6.5 Redis

- Do not expose a host port.
- Require authentication and persist only if the accepted queue-recovery
  semantics require it.
- Configure explicit memory and eviction behavior; queue data must never be
  silently evicted.
- API and worker fail closed when the production queue contract requires Redis
  and Redis is unavailable.

### 6.6 Keycloak

- Use production mode, PostgreSQL persistence, an explicit external hostname,
  reverse-proxy headers, health checks, and no default admin credential.
- Remove demo users and demo passwords from the release realm.
- Bootstrap the first admin through a one-time secret and rotate it after
  initialization.
- Preserve the existing role and scope claims required by HR Axis:
  `roles`, `read_company_ids`, `read_region_ids`, `read_store_ids`, and
  `assigned_store_ids`.
- Verify authorization in HR Axis; Keycloak authentication does not replace
  database-backed HR Axis scope enforcement.
- Do not automatically link a Keycloak identity to an existing Clerk identity
  by matching e-mail. The migration needs a digest-bound mapping/re-enrollment
  plan; existing Clerk passwords cannot be exported into Keycloak.
- Preserve the browser-session and CSRF contracts, including secure cookie
  attributes, protected writes, stale-CSRF recovery, and logout invalidation.

### 6.7 Local object storage

- Keep objects private; no public development URL or public bucket.
- Use short-lived server-authorized signed reads.
- Preserve primary/recovery integrity checks, SHA-256 and byte-count
  verification, prefixes, retention holds, and sanitized receipts.
- Primary and recovery cannot claim independent failure domains if both reside
  on the same physical disk. The accepted production design needs a separate
  disk, NAS, or backup target supplied by IT.
- Provider-neutralization must not weaken the existing synthetic-only and
  real-photo activation gates.

### 6.8 Local observability

- Keep structured API, worker, proxy, Keycloak, PostgreSQL, Redis, and storage
  logs local; strict-local mode must not send telemetry to Sentry or another
  external collector.
- Redact credentials, tokens, cookies, raw identifiers, object keys, and
  business payloads before log emission.
- Apply bounded Docker/journald rotation so logs cannot consume the data disk.
- Expose health/readiness through the private network and record aggregate
  availability/disk/backup states without adding a full monitoring platform in
  the first release.
- IT owns host/disk alerts; the project owner owns application error and
  readiness review. A later Prometheus/Grafana decision requires measured need.

## 7. Production Image Protection Contract

The goal is to reduce routine source exposure and release accidental content,
not to make compiled software inaccessible to root.

Every shipped application image must satisfy all of the following:

- no `.git`, `.github`, source TypeScript/TSX, tests, coverage, screenshots,
  plans, evidence, local env files, npm cache, build cache, or credentials;
- no source maps or embedded `sourcesContent`;
- frontend contains only static runtime assets and server configuration;
- backend contains only the runtime, production dependencies required at
  runtime, and compiled application output;
- non-root runtime user and minimal write paths;
- pinned base-image digest in the release manifest;
- image digest, build commit, build timestamp, dependency/SBOM digest, and
  configuration schema version recorded in a sanitized manifest;
- third-party license inventory and `THIRD_PARTY_NOTICES` accompany the
  release; a component whose license conflicts with internal commercial use
  is a No-Go;
- content inspection and secret scan run against exported image layers;
- vulnerability scan completed before export; unresolved critical findings
  require a recorded No-Go or explicit owner exception;
- offline bundle contains checksums and an owner-controlled signature;
- deployment verifies signature and digest before `docker load` and before
  Compose activation.

Backend compiled JavaScript and browser-delivered frontend JavaScript remain
inspectable. Minification may reduce casual readability but is not treated as
a security boundary and must not be introduced if it reduces debuggability or
runtime correctness.

## 8. Secrets and Access

- The owner keeps signing keys, source access, registry credentials, and the
  canonical release manifest outside the server.
- The server receives only deployment-time secrets required by its services.
- Compose secrets are mounted as files; application configuration gains
  explicit `*_FILE` support where required.
- Compose secret mounts reduce accidental disclosure through process
  configuration but do not hide secrets from host root.
- Secrets must not appear in `docker inspect`, command arguments, health-check
  output, logs, support bundles, screenshots, or evidence receipts.
- IT may retain root for infrastructure support. A distinct owner deployment
  account performs normal release operations and is audited.
- Membership in the Docker group is root-equivalent and is not granted as a
  cosmetic "limited" permission.
- Keycloak application administration is separate from Linux/Docker root.
- Rotation procedures cover database, Redis, Keycloak bootstrap/admin, object
  storage, and release-signing credentials.

## 9. Network and IT Inputs

Implementation can proceed locally without these values, but an on-prem
activation cannot:

| Gate | IT-provided input |
| --- | --- |
| IT-1 | Ubuntu 24.04 LTS VM or server and named owner SSH account. |
| IT-2 | Static private server IP and approved internal DNS record. Repository examples use only `hr-axis.example.invalid`. |
| IT-3 | TLS certificate, private key delivery method, and CA chain/trust distribution. |
| IT-4 | Inbound firewall: approved client networks to TCP 443; SSH limited to administrative networks. |
| IT-5 | Runtime egress policy: DNS/NTP and explicitly approved destinations only. |
| IT-6 | Separate backup destination/failure domain and retention capacity. |
| IT-7 | Time synchronization, OS patch ownership, disk monitoring, and reboot window. |
| IT-8 | Initial resource budget. Recommended rehearsal baseline: 4 vCPU, 8 GiB RAM, 100 GiB SSD plus separate backup capacity; benchmark evidence may justify adjustment. |
| IT-9 | Nebim endpoint/auth/payload/read-only account/stable-IP requirements, only when the future integration is authorized. |
| IT-10 | VM/disk encryption-at-rest posture and ownership of recovery keys. Docker volumes do not provide this by themselves. |
| IT-11 | Host firewall/`DOCKER-USER` policy proving runtime egress denial; Compose network labels alone are not sufficient evidence. |

No IP, certificate, credential, company host identity, or real endpoint is
committed to Git.

## 10. Backup, Restore, and Continuity

The pilot recommendation is an RPO of at most 24 hours and an RTO of at most
4 hours. IT and the owner must explicitly accept or tighten these targets
before production.

- Create encrypted nightly logical PostgreSQL backups with `pg_dump`.
- Store backups outside the application server's primary disk.
- Keep backup-encryption recovery material outside the application server and
  test that the named restore operator can actually access it.
- Back up Keycloak and HR Axis databases separately with exact release/schema
  identity.
- Back up local object storage and verify hashes; a second folder on the same
  disk is not a recovery copy.
- Retain a rotation appropriate to available capacity; the first proposal is
  7 daily and 4 weekly restore points.
- Perform a disposable restore rehearsal before first activation and on a
  documented recurring schedule.
- Restore proof validates migrations, invariant checks, Keycloak login,
  assigned/unassigned authorization, queue startup, synthetic object reads,
  and application health.
- Never test restore by overwriting the active environment.

PITR/WAL archiving is a later decision if the accepted RPO is shorter than the
logical-backup interval. It is not added merely for architectural appearance.

## 11. Delivery and Installation Model

The owner builds and validates the package in a trusted environment, then
delivers an offline release directory similar to:

```text
hr-axis-release-<version>/
  compose.yaml
  config/
    env.template
    caddy/
    keycloak/
  images/
    hr-axis-images.tar
  manifests/
    release.json
    SHA256SUMS
    SBOM/
    signature
    public-key
  scripts/
    preflight
    install
    migrate
    smoke
    backup
    restore-rehearsal
    rollback
  runbooks/
```

The package contains no source repository. Installation is:

1. verify OS, disk, DNS, TLS, time, ports, Docker and Compose versions;
2. verify release signature and every digest;
3. load immutable images;
4. create secret files through an interactive/offline procedure;
5. start PostgreSQL, Redis, object storage, and Keycloak privately;
6. run bootstrap and migration explicitly;
7. start API and worker;
8. start frontend and reverse proxy;
9. run sanitized synthetic smoke and negative authorization tests;
10. record Go, Conditional Go, or No-Go without secret values.

## 12. Implementation Sequence

The sequence is intentionally reviewable. Do not combine slices to reduce PR
count.

### ONP-0 — Plan and contract guards (current PR)

Risk: R0 documentation, preparing R5 work.

Scope:

- this plan;
- plan-contract tests for locked boundaries, forbidden live operations, PR
  order, and activation gates;
- current-state alignment after owner approval.

Acceptance:

- no runtime, database, auth, provider, or UI change;
- plan contract fails if real data, production activation, automatic cutover,
  MySQL migration, or source delivery is silently introduced;
- affected verification selects docs/script contracts only.

Rollback: revert the documentation/contract PR.

### ONP-1 — Clean production images and artifact proof

Risk: R3 build/release.

Scope:

- harden frontend and backend/worker image stages;
- non-root/read-only compatibility;
- explicit source-map-off build contract;
- image content/secret/source guard;
- SBOM, vulnerability report, image digest, and signed release-manifest
  generator using synthetic inputs;
- worker command proof from the same backend image.

Acceptance:

- canonical tests/builds pass;
- exported layers contain none of the forbidden content;
- API and worker start as non-root with read-only root filesystems;
- frontend/API images contain no secret and expose no source maps;
- current hosted deployment behavior remains unchanged.

Rollback: previous image definitions and hosted artifacts remain available.

### ONP-2 — Private core data plane

Risk: R4 infrastructure and database runtime.

Scope:

- a new isolated on-prem Compose project;
- Caddy, frontend, API, worker, migrator, PostgreSQL 16, and Redis 7;
- private networks, health checks, resource limits, persistent volumes, secret
  files, and strict-local feature profile;
- bounded local log rotation and a host-firewall verification contract;
- database role/bootstrap scripts and explicit migration flow;
- synthetic seed only.

Acceptance:

- only reverse proxy ports are exposed;
- `docker compose config` contains no secret values;
- fresh-volume bootstrap, migration, restart, and clean shutdown pass;
- runtime role cannot perform schema DDL;
- Redis loss/recovery behavior is explicit and tested;
- packet-level observation and host policy prove that no external host is
  contacted by API, worker, frontend, Keycloak, Redis, PostgreSQL, or storage.

Rollback: stop the isolated project and remove only named synthetic volumes
after their identity is verified. Never target user or hosted data.

### ONP-3 — Production-shaped local Keycloak

Risk: R5 authentication and authorization.

Scope:

- production-mode Keycloak with PostgreSQL persistence;
- sanitized realm/client import without demo users or default credentials;
- local hostname, proxy, callback, logout, JWKS, and claim contracts;
- owner bootstrap/rotation procedure;
- HR Axis provider namespace and account-linking migration decision, if the
  current Clerk subjects cannot be reused directly.

Acceptance:

- PKCE login, callback, browser session, refresh/re-auth strategy, and logout
  pass over HTTPS;
- all supported roles resolve their intended read/action scopes;
- assigned action succeeds and unassigned action returns `403`;
- cookie-session writes without a valid CSRF token fail, while stale-token
  recovery does not strand a valid user;
- forged issuer, audience, role, company, region, and store claims fail;
- demo credentials and `start-dev` are absent;
- no existing hosted identity mapping is mutated.

Rollback: stop local Keycloak and return synthetic clients to the previous
isolated test provider. Hosted Clerk remains untouched.

### ONP-4 — Provider-neutral local object storage

Risk: R5 storage, retention, and evidence integrity.

Scope:

- select the local S3 engine using current license and compatibility evidence;
- replace R2-named runtime semantics with a provider-neutral S3 contract while
  preserving the existing R2 adapter as a hosted rollback option;
- private buckets/volumes, signed reads, canonical/recovery verification,
  retention, reconciliation, and backup integration;
- synthetic fixtures only.

Acceptance:

- current R2 contract tests remain green;
- local S3 contract suite passes byte/hash/read/delete/list/signing behavior;
- provider identity no longer changes business semantics;
- primary/recovery mismatch fails closed;
- no public object access;
- real-photo activation remains No-Go unless separately approved.

Rollback: disable local storage feature and retain immutable synthetic evidence
for reconciliation; do not delete objects to simulate rollback.

### ONP-5 — Offline install, backup/restore, and full rehearsal

Risk: R5 release operations and recovery.

Scope:

- offline export/import package;
- signature/digest verification;
- preflight, install, migrate, smoke, backup, restore-rehearsal, update, and
  rollback scripts;
- operator runbooks and sanitized receipts;
- full synthetic rehearsal on a clean Linux/WSL environment.

Acceptance:

- a clean host can install without repository access;
- install is idempotent or stops safely with a precise reason;
- wrong signature, digest, target identity, secret permissions, certificate,
  disk capacity, migration state, or image version fails before mutation;
- backup restores into a disposable target within the provisional RTO;
- host restart restores healthy services without manual data repair;
- previous release rollback succeeds when no incompatible migration exists;
- migration incompatibility selects forward repair or database restore rather
  than pretending image rollback is sufficient;
- sanitized evidence identifies exact release and schema digests.

Rollback: retain previous signed release bundle and verified backup. Stop at
No-Go rather than partially activating the new release.

## 13. Functional Requirements

- FR-1: The complete synthetic HR Axis web flow runs without an external
  runtime dependency.
- FR-2: The API, worker, frontend, Keycloak, PostgreSQL, Redis, proxy, migrator,
  and local object storage start through one versioned Compose project.
- FR-3: Keycloak authentication preserves HR Axis role and scope enforcement.
- FR-4: Database migration is explicit, repeatable, and identity-bound.
- FR-5: Owner-built images can be installed without repository access.
- FR-6: Backup and restore can recreate a usable synthetic environment.
- FR-7: Strict-local mode prevents Sentry/Qwen/hosted-provider runtime calls.
- FR-8: The future Nebim boundary can be added without frontend access or
  direct database writes, but makes no live request in this plan.

## 14. Non-Functional Requirements

- NFR-1 Security: fail closed on missing identity, secrets, migration state,
  storage integrity, or release identity.
- NFR-2 Privacy: no real company data in build/test/evidence artifacts.
- NFR-3 Operability: one operator can install, update, back up, restore, and
  roll back with documented commands.
- NFR-4 Portability: no hosted-provider dependency in strict-local runtime.
- NFR-5 Recoverability: accepted RPO/RTO are proven through restore, not only
  documented.
- NFR-6 Auditability: receipts expose versions, counts, states, and digests but
  no credentials, raw UUIDs, object keys, or business payloads.
- NFR-7 Performance: resource sizing is evidence-based; reducing below the
  rehearsal baseline requires load and failure-recovery proof.
- NFR-8 Maintainability: hosted and on-prem profiles share business code;
  provider differences remain at configuration/adapters.

## 15. End-to-End Acceptance Criteria

- AC-1: A clean Ubuntu/WSL host passes preflight and installs the signed bundle.
- AC-2: Only TCP 443 is needed for ordinary users; internal service ports are
  unreachable from the host network unless an approved maintenance profile is
  active.
- AC-3: Health and readiness distinguish API, database, Redis, worker,
  Keycloak, and object-storage failures.
- AC-4: Store manager, region manager, report viewer, store personnel, and
  visual merchandiser login and authorization contracts pass with synthetic
  accounts.
- AC-5: Unauthorized cross-company, cross-region, and cross-store reads/actions
  fail.
- AC-6: A synthetic queue job survives the accepted restart scenario.
- AC-7: A synthetic object is written, verified, authorized for short read,
  recovered, reconciled, and retained according to policy.
- AC-8: A database backup restores into a disposable environment and passes
  invariant/readiness tests.
- AC-9: Image inspection proves the production-image protection contract.
- AC-10: Runtime egress observation shows no unapproved external destination.
- AC-11: Update and rollback rehearsals preserve data and identify migration
  incompatibility correctly.
- AC-12: Current hosted services are unchanged until separate cutover approval.

## 16. Stop Conditions

Stop and return No-Go when any of the following occurs:

- target host, disk, DNS, TLS, backup destination, or owner identity is
  unresolved at activation time;
- a release digest/signature or target identity does not match;
- a secret appears in image layers, Compose output, logs, or evidence;
- a service requires an undocumented external network call;
- Keycloak claim semantics conflict with HR Axis database authorization;
- migration or restore proof is incomplete;
- the only recovery copy shares the same physical failure domain;
- provider-neutral storage would weaken existing evidence/retention semantics;
- a real Nebim payload or live company data is requested before its separate
  contract and approval;
- an operator proposes deleting the hosted rollback environment before the
  observation gate closes;
- implementation needs a product/owner decision not locked in this plan.

## 17. Change-My-Mind Triggers

Revisit the architecture if:

- measured workload cannot fit safely on one host;
- accepted RPO requires PITR or a managed HA database;
- downtime requirements demand multi-node failover;
- IT mandates a supported enterprise container platform;
- Keycloak operational load exceeds single-owner support capacity;
- the selected local S3 engine fails license, integrity, backup, or upgrade
  rehearsal;
- Nebim provides a supported connector that materially reduces custom risk;
- company policy requires AD/LDAP federation;
- the server cannot receive security updates or a separate backup target.

## 18. Verification Policy

For ONP-0, use documentation/script-contract verification only:

```powershell
git diff --check
npm.cmd run test:scripts
npm.cmd run check:affected-verification
```

Later implementation slices run targeted tests first, then the repository's
canonical affected-scope selector. A full release runs only when selected by
repository policy or when the slice changes runtime behavior requiring it.
Never run two full release suites concurrently and never reduce test coverage
to improve wall time.

R4/R5 slices require the review path in `discipline.md` and `sokrates.md`.
GitHub Codex review remains disabled. PR checks are monitored with native
tooling while independent work proceeds in a separate worktree.

## 19. Definition of Done

The preparation line is complete only when ONP-0 through ONP-5 are merged,
the clean-host synthetic rehearsal is green, the signed offline bundle is
reproducible, restore and rollback are proven, and all remaining owner/IT gates
are listed explicitly.

This does not itself mean production is live. Production requires a separate
Go decision with exact IT inputs, real-data migration/import scope, cutover
window, rollback owner, observation window, and hosted-stack retirement date.
