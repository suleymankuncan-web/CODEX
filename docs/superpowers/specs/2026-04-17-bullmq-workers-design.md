# BullMQ Workers Design

## Scope

Add a dedicated NestJS worker process for BullMQ-backed background jobs. The worker process will consume the existing import and snapshot queues and execute current application services without duplicating domain logic.

## Approaches Considered

### Recommended: Single worker process with two queue consumers

- One Nest application context boots a worker-only module.
- The module creates one BullMQ `Worker` for `import-batch` jobs and one for `snapshot-run` jobs.
- Each worker delegates to existing services:
  - import jobs -> `MaterializationService.materializeBatch`
  - snapshot jobs -> `SnapshotService.executeSnapshotRun`

Why this is the best fit:
- Keeps current modular monolith boundaries intact.
- Reuses existing service logic instead of inventing a second execution layer.
- Minimizes deployment surface while still separating API and background execution processes.

### Alternative: Separate OS process per queue

- One process for import jobs, one for snapshot jobs.
- Better isolation, but unnecessary operational overhead for the current stage.

### Alternative: Inline worker startup in API app

- Start BullMQ consumers inside the main API process.
- Rejected because it defeats the point of durable asynchronous execution and makes scaling noisy.

## Design

### Process model

- Add a `WorkerModule` that imports config, database, integration, and store-ops dependencies.
- Add a worker bootstrap file that starts a Nest application context without HTTP listeners.
- Add an npm script for launching the worker process.

### Runtime behavior

- If `QUEUE_BACKEND != bullmq`, the worker host does not register queue consumers.
- If `QUEUE_BACKEND == bullmq`, the worker host creates both BullMQ workers using existing queue names from config.
- Import jobs call `materializeBatch(batchId)`.
- Snapshot jobs call `executeSnapshotRun(snapshotRunId, periodStart, periodEnd)`.

### Error handling

- BullMQ keeps retry/backoff responsibility.
- Import worker behavior relies on the new row-level materialization outcome model.
- Snapshot worker leaves final run state management inside `SnapshotService`.
- Worker lifecycle closes Redis connections and BullMQ workers cleanly on shutdown.

### Testing

- Add focused unit tests for worker host initialization and dispatch.
- Verify:
  - no workers are created when backend is not `bullmq`
  - both workers are created when backend is `bullmq`
  - import processor calls materialization service with batch id
  - snapshot processor calls snapshot execution with payload fields
