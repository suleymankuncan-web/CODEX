# First-Wave Integration Tests Design

## Scope

Add the first real HTTP-level integration tests for the NestJS backend. The goal is to verify that API endpoints, auth guards, DTO binding, and service orchestration work together for the most critical async flows without depending on a live PostgreSQL or Redis instance.

## Recommended approach

Use Nest testing with an in-memory application instance and override infrastructure dependencies:

- Boot `AppModule`
- Override `DatabaseService` with deterministic query/transaction doubles
- Override `JOB_DISPATCHER` with a capturing fake
- Exercise endpoints with HTTP requests against the in-memory app

Why this is the best first step:
- Verifies controller -> guard -> DTO -> service wiring
- Avoids introducing container orchestration while tests are still sparse
- Produces stable, fast regression coverage around the most important API surfaces

## Covered flows

- `POST /integrations/import-batches`
  - accepts a valid request
  - persists batch + staging rows via repository/database calls
  - dispatches the async job
- `POST /snapshots/runs`
  - accepts a valid request
  - creates a snapshot run
  - dispatches snapshot work without generating snapshot SQL inline
- `GET /org/stores`
  - rejects out-of-scope access when store scope is required
- Checklist flow file exists for the next expansion wave

## Non-goals for this phase

- Live PostgreSQL integration
- Live Redis/BullMQ end-to-end execution
- Full query result validation for all read models
- Complete checklist lifecycle coverage
