# Master Data Bootstrap Personnel Promotion V1 Design

Date: 29 April 2026

Status: `approved_for_implementation`

## Goal

Promote reviewed personnel bootstrap rows into `ops.employee` and `ops.employee_assignment_history` safely, idempotently, and only after store master data is ready.

## CODEX Honest View

Personnel promotion is riskier than store promotion because it touches employee identity and active assignment history. V1 should stay deliberately narrow: no user accounts, no role assignment, no offboarding, no target allocation, and no automatic store or position creation.

The right shape is a controlled import gate. Staged rows become live employees only when validation has resolved store and position evidence and the batch is `ready_to_promote`. If a row is already promoted, it is skipped rather than duplicated.

## Current State

Implemented:

- store/personnel bootstrap staging
- personnel validation against store, seller code, national id evidence, and position
- duplicate/conflict preflight
- review queue
- promotion readiness endpoint
- store-only promotion command

Missing:

- personnel promotion command
- personnel identity field validation for live write requirements
- active primary assignment write path
- staged row `promoted_entity_id` evidence for personnel promotion

## Locked Decisions

- V1 promotes personnel batches only.
- Store promotion stays on its own endpoint.
- V1 exposes one command endpoint:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-personnel
```

- V1 requires:
  - scoped batch access
  - `bootstrapEntity = personnel`
  - `batchStatus = ready_to_promote`
  - row readiness = `ready`
  - seller code
  - first name
  - last name
  - national id hash evidence
  - hire date
  - resolved store id
  - resolved region id
  - resolved position id
- Missing `employmentType` defaults to `full_time`.
- Re-running promotion must not duplicate employees or active primary assignments.
- A promoted staged row becomes `validation_status = promoted` and stores the resulting `employee_id` in `promoted_entity_id`.

## Personnel Row Inputs

Accepted name aliases:

```text
firstName
first_name
givenName
ad

lastName
last_name
surname
soyad
```

Accepted hire date aliases:

```text
hireDate
hire_date
startDate
employmentStartDate
iseGirisTarihi
```

Accepted employment type aliases:

```text
employmentType
employment_type
```

Allowed normalized employment types:

```text
full_time
part_time
temporary
```

Missing employment type defaults to `full_time`.

## Validation Additions

Personnel validation also ensures:

- first name exists
- last name exists
- national id hash exists
- hire date exists and is `YYYY-MM-DD`
- employment type is allowed

Issue codes:

```text
missing_first_name
missing_last_name
missing_national_id
missing_hire_date
invalid_hire_date
unknown_employment_type
```

These keep unsafe personnel rows out of `ready_to_promote`.

## Promotion Behavior

For each ready personnel row:

1. Find an existing employee by resolved employee id or normalized seller code.
2. Update that employee, or insert a new employee when no match exists.
3. Ensure the employee is active with the staged name, seller code, national id hash, hire date, and employment type.
4. Deactivate any other active primary assignment for the employee.
5. Update an existing active primary assignment for the same store and position, or insert one.
6. Mark the staged row as promoted with the employee id.
7. Refresh batch counters. If all rows are promoted, close the batch as `promoted`.

## Error Handling

- Non-personnel batch -> `400`
- Batch not ready -> `400`
- No ready rows -> `400`
- Empty or foreign company scope -> existing fail-closed behavior
- Employee write returns no id -> promotion fails
- Assignment write returns no id -> promotion fails
- Staged row update returns no row -> promotion fails

## Testing Plan

Service tests:

- normalizes personnel promotion metadata
- rejects store batch personnel promotion
- rejects personnel batch not `ready_to_promote`
- promotes only ready personnel rows
- skips already-promoted rows
- rejects ready-row promotion when evidence is missing

Repository tests:

- upserts `ops.employee`
- deactivates conflicting active primary assignments
- inserts or updates one active primary `ops.employee_assignment_history`
- updates staged row to `promoted`
- refreshes batch counters/status
- does not write to `ops.store`

Release verification:

```powershell
cd C:\Users\suley\OneDrive\Masaustu\WEBSITE CALISMASI\backend\nestjs
npm.cmd test -- master-data-bootstrap --runInBand
npm.cmd run lint
npm.cmd run build

cd C:\Users\suley\OneDrive\Masaustu\WEBSITE CALISMASI
npm.cmd run check:release
```

Use the real workspace path when running locally; the command block above is ASCII-only documentation.

## Non-Goals

- No user account creation.
- No auth role assignment.
- No seller-code request mutation.
- No offboarding mutation.
- No target allocation.
- No store or position auto-creation.
- No row edit UI.
- No frontend screen.

## Acceptance Criteria

- HR/Admin can promote a ready personnel batch.
- Only ready personnel rows are written to live personnel tables.
- Re-running the command does not duplicate employees or assignments.
- Each promoted staged row gets `promoted_entity_id`.
- Batch counters and status reflect promotion.
- Store promotion remains separate.
- Targeted backend tests and root `check:release` pass.
