# Scale Notes: 1000 Personnel / 1000 Users

## Used Skills
- `product-architect`
- `backend-architecture`
- `performance-engineering`
- `security-compliance`
- `database-designer`

## Assumptions
- Roughly 1000 employees and up to 1000 login-enabled users.
- Concurrent active users are likely far lower than total users.
- Reporting workloads will spike around shift start, audit windows, and month-end snapshots.

## Recommendation
This scale does **not** require microservices yet.

Recommended shape:
- Modular monolith
- PostgreSQL primary database
- Queue-backed async workers for imports and snapshot generation
- Read-only reporting endpoints over immutable snapshot tables
- Strict scoped RBAC in every query path
- Idempotent command handling for imports and snapshots
- Queue abstraction that can move from in-memory to Redis/BullMQ

## Why This Is The Right Level
- 1000 users is comfortably inside a single well-structured NestJS app with PostgreSQL.
- Operational complexity from store workflows is higher than raw traffic complexity.
- Team velocity and maintainability will be better with a modular monolith than premature service splitting.
- The important part is not optimizing for exactly 1000 users, but avoiding decisions that block future growth.

## Concrete Capacity Guidance
- App instances: start with 2 stateless API instances behind a load balancer
- DB: PostgreSQL with automated backup, PITR if possible
- Pooling: 20-30 DB connections per app instance
- Workers: 1 import worker, 1 snapshot worker to start
- Cache: optional Redis for job queue and short-lived permission caching

## Data and Job Expectations
- 1000 employee records is trivial for PostgreSQL
- Monthly snapshots and KPI aggregation are also trivial if done set-based in SQL
- External imports should remain batch-driven and async to avoid UI/API blocking

## Security Notes
- Default deny for any out-of-scope company/region/store access
- PII in employee and staging payloads should be minimized in logs
- Snapshot tables should never be mutated by application commands

## Performance Notes
- Prioritize indexes on assignment dates, scope fields, and snapshot foreign keys
- Use cursor or keyset pagination for audit and event-heavy endpoints
- Run snapshot jobs off-peak or queue-protected

## When To Revisit Architecture
- If concurrent users move toward 5k+
- If imports become near-real-time rather than batch
- If multiple business domains need independent deployment cadence
- If reporting becomes near-live analytics rather than snapshot reporting
- If queue throughput or retry semantics require durable broker-backed execution
