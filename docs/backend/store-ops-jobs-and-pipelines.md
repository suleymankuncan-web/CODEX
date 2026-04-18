# Store Operations Jobs and Pipelines

## Used Skills
- `backend-architecture`
- `database-designer`
- `integration-architecture`
- `performance-engineering`
- `security-compliance`
- `coding-standards`
- `testing-qa`

## Assumptions
- Large import and snapshot operations run asynchronously.
- Job execution is idempotent and restart-safe.
- RBAC checks happen before any manual job trigger.
- Snapshot generation is append-only.

## Technical Decisions
- Separate pipelines for `employee`, `store`, and `kpi` staging loads.
- All imports write to `stg.*` first, then pass validation, mapping, and materialization stages.
- Snapshot generation reads only committed operational state.
- All jobs emit audit events and machine-readable execution status.
- Long-running workloads should use a queue-backed worker model.

## Pipeline 1: Staging Import
1. Receive file or external payload.
2. Create `stg.import_batch`.
3. Persist raw rows into one of:
   - `stg.employee_raw`
   - `stg.store_raw`
   - `stg.kpi_raw`
4. Validate schema and mandatory fields.
5. Resolve internal IDs via `stg.external_id_map`.
6. Materialize valid rows into `ops.*`.
7. Mark failed rows with `validation_error`.
8. Write `audit.event_log`.

## Pipeline 2: KPI Snapshot Job
1. Lock logical execution window by `snapshot_type + period`.
2. Create `rpt.snapshot_run`.
3. Build store workforce aggregates from:
   - `ops.employee_assignment_history`
   - `ops.workforce_norm_plan`
4. Build KPI aggregates from:
   - `ops.kpi_actual`
   - `ops.kpi_target`
5. Build checklist aggregates from:
   - `ops.checklist_instance`
   - `ops.checklist_response`
6. Build turnover aggregates from:
   - `ops.turnover_event`
   - assignment-derived headcount averages
7. Insert into immutable `rpt.*` tables.
8. Log completion into `audit.event_log`.

## Async Execution Model
- Recommended queues:
  - `integration-import`
  - `snapshot-generation`
  - `rebuild-kpi-period`
- Retry policy:
  - 3 retries
  - exponential backoff
  - dead-letter on permanent validation failure
- Idempotency keys:
  - import: `source_code + entity_type + source_batch_reference`
  - snapshot: `snapshot_type + period_start + period_end`

## Security Controls
- Only authorized roles can trigger imports or snapshots.
- Staging payloads may contain PII, so access must be restricted.
- Audit logs are append-only from application perspective.
- Batch metadata should avoid storing secrets or raw credentials.

## Performance Notes
- Use batched inserts for staging materialization.
- Build snapshot tables with set-based SQL, not row-by-row loops.
- Index staging tables by `import_batch_id`, status, and external refs.
- Partition large `rpt` tables by `snapshot_date` or month when volume grows.

## QA Scope
- Unit tests for validation and mapping rules.
- Integration tests for import batch lifecycle.
- Data reconciliation tests between `ops` and `rpt`.
- Idempotency tests for rerunning same import/snapshot command.

## Live E2E Notes
- Local live infra stack file: `infra/docker-compose.live-e2e.yml`
- Example env file: `backend/nestjs/.env.live-e2e.example`
- Live runner: `backend/nestjs/test/live/live-e2e.ts`
- Runbook: `docs/backend/live-e2e-runbook.md`
- Expected execution flow:
  1. Start PostgreSQL and Redis
  2. Load `.env.live-e2e.example` values
  3. Run `npm run test:live`
- This flow starts the worker context and API app together, then verifies:
  - snapshot enqueue and worker completion
  - import enqueue and worker completion
