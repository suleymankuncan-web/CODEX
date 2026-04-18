# Release Readiness Pass - 2026-04-18

## Scope
- Validate the backend against the current Phase 3C target:
  - Docker-backed live infrastructure
  - BullMQ worker execution
  - PostgreSQL-backed snapshot and import flow
  - operational monitoring contract baseline

## Environment
- Date: April 18, 2026
- Host OS: Windows 11 Pro
- Runtime stack:
  - Docker Desktop 4.69.0
  - WSL 2
  - PostgreSQL 16
  - Redis 7

## Checks Performed

### Infrastructure readiness
- `wsl --status`
  - passed
- `docker version`
  - passed
- `docker info`
  - passed
- `docker compose -f infra/docker-compose.live-e2e.yml up -d`
  - passed
- PostgreSQL container health
  - passed
- Redis container health
  - passed

### Application readiness
- `npm run build`
  - passed
- `npm run test:live`
  - passed after runtime fixes

### Live E2E verified outcomes
- Snapshot command accepted and processed to `completed`
- Import batch command accepted and processed to `completed`
- Worker context and API app ran together against real PostgreSQL and Redis

## Runtime Issues Found During Readiness Pass

### Fixed
1. Worker bootstrap could not resolve `ConfigService`
   - fixed by moving shared `ConfigModule.forRoot(...)` wiring into `AppConfigModule`
2. Live E2E database setup was not rerunnable
   - fixed by resetting project-owned schemas before applying schema SQL
3. Live E2E did not load seed data required by audit foreign keys
   - fixed by applying `db/seeds/001_reference_seed.sql`
4. Live E2E used a non-seeded actor user id and mismatched import payload
   - fixed by aligning test payloads with seeded users and sources
5. Live E2E expected old response shapes for snapshot and import command envelopes
   - fixed by reading ids from `data.snapshotRun` and `data.batch`
6. `IntegrationRepository.getImportBatch` had an ambiguous SQL column reference
   - fixed by aliasing `stg.import_batch` columns explicitly
7. BullMQ teardown left Redis handles open or surfaced closed-connection noise
   - fixed by adding safe `OnModuleDestroy` shutdown behavior for dispatcher and worker host

### Still open but non-blocking for this pass
- structured logging and correlation ids are still an improvement area

## Release Decision
- Status: `conditionally ready`

Meaning:
- The backend is ready for continued controlled integration and environment-level rollout work.
- Core async flows are proven on real infra.
- Remaining work is now mostly operational hardening rather than foundational runtime risk.

## Exit Criteria Status
- App boots: yes
- Docker-backed PostgreSQL and Redis verified: yes
- Worker-backed snapshot execution verified: yes
- Worker-backed import execution verified: yes
- Monitoring contract documented: yes
- Release readiness documented: yes

## Recommended Next Step
1. Add structured runtime logging and correlation ids.
2. Run `npm run smoke:release` as part of environment promotion.
3. Optionally extend the smoke pass with write-safe synthetic checks for admin surfaces.
