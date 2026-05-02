# Master Data Bootstrap Preflight V1 Design

Date: 29 April 2026

Status: `approved_for_implementation`

## Goal

Catch dangerous duplicate and identity-conflict rows during master-data bootstrap validation before any future live `ops.*` promotion exists.

## CODEX Honest View

This is the correct next slice because it strengthens the master-data foundation without pretending we already know the final promotion workflow.

The project should not promote stores or personnel yet. It should first become very good at saying: "this staged baseline is clean", "these rows need HR review", and "this identity looks unsafe". This slice does exactly that.

## Current State

Already implemented:

- staged bootstrap batches in `stg.master_data_bootstrap_batch`
- staged rows in `stg.master_data_bootstrap_row`
- row validation into `valid`, `needs_review`, or `invalid`
- scoped batch queue and paginated row review
- store code normalization that treats `SM-140` and `SM140` as the same normalized store code
- employee seller code normalization
- no live promotion into `ops.store`, `ops.employee`, or `ops.employee_assignment_history`

Current gap:

- normalized duplicate store codes inside one store bootstrap batch are not explicitly caught
- normalized duplicate employee seller codes inside one personnel bootstrap batch are not explicitly caught
- personnel national id evidence is not normalized into a safe comparison field
- a personnel row can contain a seller code and national id that point to different existing employees without a first-class issue code

## Locked Decisions

- V1 runs as part of `POST /api/integrations/master-data-bootstrap/batches/:batchId/validate`.
- V1 does not add a new endpoint.
- V1 does not promote data.
- V1 does not edit raw payloads.
- V1 does not create stores, employees, positions, or assignments.
- V1 marks risky rows as `needs_review`, not `invalid`, unless a required field is missing.
- V1 keeps exact duplicate row hash protection in the existing DB unique index.
- V1 uses issue codes so HR/Admin can filter the existing row review endpoint.

## Preflight Rules

### Store Batch

If two or more rows in the same store batch normalize to the same store code, each affected row becomes:

```text
validationStatus: needs_review
issueCode: duplicate_store_code_in_batch
```

Example:

```text
SM-140
SM140
```

Both become the same normalized value: `SM140`.

### Personnel Batch

If two or more rows in the same personnel batch normalize to the same employee seller code, each affected row becomes:

```text
validationStatus: needs_review
issueCode: duplicate_employee_code_in_batch
```

If two or more rows in the same personnel batch normalize to the same national id hash, each affected row becomes:

```text
validationStatus: needs_review
issueCode: duplicate_national_id_in_batch
```

Seller-code duplicate has priority over national-id duplicate because seller code is the operational identity used by KPI imports.

### Existing Employee Identity Conflict

If a personnel row has both:

- a seller code that resolves to one existing employee
- a national id hash that resolves to another existing employee

then the row becomes:

```text
validationStatus: needs_review
issueCode: employee_identity_conflict
```

If a national id hash resolves to an existing employee but the seller code does not, the row also becomes `employee_identity_conflict`. HR should decide whether this is a new code for an existing person, a typo, or a duplicate identity.

## National Id Handling

Accepted input aliases:

```text
nationalIdHash
nationalIDHash
national_id_hash
nationalId
nationalID
national_id
tcKimlikNo
tcNo
tckn
```

Normalization:

- an existing 64-character hex hash is stored lower-case as `normalizedNationalIdHash`
- raw national id values are reduced to digits and hashed with SHA-256 into `normalizedNationalIdHash`
- raw payload is preserved as existing lineage behavior; this slice only prevents unsafe identity promotion decisions

## Data Flow

```text
HR/Admin stages batch
  -> raw and normalized payloads are stored

HR/Admin validates batch
  -> service builds duplicate/conflict preflight context
  -> duplicate rows become needs_review
  -> identity conflicts become needs_review
  -> remaining rows continue existing validation
  -> batch counters refresh

HR/Admin reviews rows
  -> existing row review endpoint filters by issueCode
```

## Error Handling

- Missing store code remains `invalid` with `missing_store_code`.
- Missing employee code remains `invalid` with `missing_employee_code`.
- Missing position code remains `invalid` with `missing_position_code`.
- Duplicate checks ignore missing values so they do not hide required-field errors.
- Empty company scope and foreign batch access keep the existing fail-closed behavior.

## Testing Plan

Service tests:

- personnel staging writes `normalizedNationalIdHash` without exposing a raw national id in normalized payload
- store validation marks `SM-140` and `SM140` as `duplicate_store_code_in_batch`
- personnel validation marks duplicate seller codes as `duplicate_employee_code_in_batch`
- personnel validation marks duplicate national id hashes as `duplicate_national_id_in_batch`
- personnel validation marks seller-code/national-id mismatch as `employee_identity_conflict`

Repository tests:

- resolving employee by national id hash reads `ops.employee` only
- repository preflight additions do not insert/update `ops.*`

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

- No promotion.
- No row edit/correction UI.
- No Excel parser changes.
- No destructive schema change.
- No attempt to solve every possible HR identity policy before real baseline data arrives.

## Acceptance Criteria

- Normalized duplicate store/personnel codes are visible as review issues.
- `SM-140` and `SM140` collide intentionally.
- National id evidence can be compared through `normalizedNationalIdHash`.
- Existing employee identity conflicts are caught before promotion.
- Existing review queue can filter these issue codes.
- Targeted backend tests and root `check:release` pass.
