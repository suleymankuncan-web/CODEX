# Master Data Bootstrap Pilot Smoke Runbook V1

## Metadata

- Status: V1 operator runbook for the first real store/personnel baseline smoke.
- Owner: HR/Admin master-data operator with backend/data review support.
- Last updated: 2026-04-30.
- Purpose: Make the first true baseline staging and promotion run controlled, evidence-based, and reversible by scope.

## Decision Rule

Do not promote master-data bootstrap rows until the operator has staged a true baseline file, validated it, reviewed row evidence, reviewed promotion dry-run evidence, and recorded a Go / Conditional Go / No-Go decision.

The first smoke must be scoped. Do not promote a full company baseline as the first smoke.

## Scope

This runbook covers:

- true store baseline files with official store codes and store metadata,
- true personnel baseline files with official seller/employee codes and assignment metadata,
- local or staging pilot smoke before broad production promotion,
- backend-owned staging, validation, dry-run readiness, and scoped promotion,
- sanitized evidence capture.

This runbook does not cover:

- KPI snapshot Excel import,
- JSON/API source adapters,
- direct database edits,
- Keycloak/user account creation,
- payroll/bonus approval,
- bulk production rollout.

Do not use KPI snapshot Excel files as master-data baseline files.

## Roles And Responsibilities

Prepared by:

- Confirms the file is a true baseline, not a KPI snapshot.
- Confirms pilot scope: one or two stores, or one region-approved test slice.
- Confirms expected store/personnel counts before staging.

Executed by:

- Stages the batch through the approved admin/API surface.
- Runs validation.
- Reviews dry-run evidence.
- Promotes only the approved scoped pilot batch after Go decision.

Reviewed by:

- Checks unmapped store, unmapped position, duplicate, conflict, and invalid rows.
- Confirms no fake or temporary identity is being promoted.
- Confirms promoted rows match the approved pilot scope.

Approved by:

- Decides Go, Conditional Go, or No-Go.
- Records the final evidence note.
- Decides whether the next pilot slice can expand.

## 1. Environment Preflight

Checklist:

- [ ] Backend is running in the selected local/staging environment.
- [ ] Frontend/admin surface is running.
- [ ] Database migrations are applied.
- [ ] Operator can log in with HR/Admin, Super Admin, or Integration Admin authority.
- [ ] Current branch/commit is recorded.
- [ ] Target environment is confirmed as local/staging unless production rollout is separately approved.
- [ ] No production data is edited manually.
- [ ] Do not manually edit live `ops.*` tables.

## 2. Baseline File Preflight

For store baseline:

- [ ] Official store code exists.
- [ ] Store name exists.
- [ ] Store type exists: company, franchise, or operator.
- [ ] Region code or resolved region evidence exists.
- [ ] Store status exists.
- [ ] KPI import enabled decision exists if the row will receive KPI data later.

For personnel baseline:

- [ ] Official seller/employee code exists.
- [ ] Store code exists.
- [ ] First name exists.
- [ ] Last name exists.
- [ ] National id evidence exists and will be stored only as hash.
- [ ] Position code exists.
- [ ] Hire date uses `YYYY-MM-DD`.
- [ ] Employment type is known when available.

No-Go:

- File only contains names without official codes.
- File is exported from KPI performance tables rather than master-data source.
- Store codes or seller codes are missing for the pilot rows.
- Pilot scope is not clear.
- No fake store or personnel rows should be invented for the smoke.

## 3. Stage The Baseline Batch

Operator sequence:

1. Open `/admin/master-data`.
2. Stage the scoped store or personnel baseline batch.
3. Confirm source label, file reference, entity type, and row count.
4. Confirm the batch appears in the review queue.

Evidence to record:

- batch id
- entity type
- source label
- file reference
- row count
- operator
- environment
- timestamp

The ordered smoke sequence is: stage the baseline batch, validate the batch, inspect row evidence, inspect promotion dry-run evidence, promote only the approved scoped pilot batch, capture sanitized evidence.

## 4. Validate The Batch

Operator sequence:

1. Open the staged batch.
2. Run `Validate batch`.
3. Wait for backend validation result.
4. Review counts:
   - valid
   - needs review
   - invalid
   - promoted

Promotion must stay blocked until backend readiness is clean.

No-Go:

- every row is invalid,
- every row is unmapped,
- duplicate/conflict issue count is unexplained,
- valid row count does not match the approved pilot scope,
- validation cannot finish.

## 5. Review Row Evidence

Review at row level:

- [ ] normalized store code
- [ ] normalized employee/seller code
- [ ] validation status
- [ ] issue code
- [ ] issue message
- [ ] resolved store id
- [ ] resolved employee id
- [ ] resolved position id
- [ ] promoted entity id, if already promoted

Do not continue if any unresolved row would be promoted accidentally.

## 6. Review Promotion Dry-Run Evidence

Before clicking a live promotion button, inspect the `Promotion dry-run evidence` panel.

Required checks:

- [ ] ready rows are expected,
- [ ] already promoted rows are expected or explainable,
- [ ] blocked rows are zero before promotion,
- [ ] needs validation rows are zero before promotion,
- [ ] needs review rows are zero before promotion,
- [ ] waiting batch rows are zero before promotion,
- [ ] block reason evidence is reviewed for every non-ready row.

The dry-run evidence panel does not promote rows. It only renders backend promotion-readiness evidence.

No-Go:

- `blockedCount > 0`
- `needsValidationCount > 0`
- `needsReviewCount > 0`
- `canPromote` is false
- dry-run row count does not match staged batch row count

## 7. Scoped Pilot Promotion

Only after Go:

1. Confirm the batch is the approved pilot batch.
2. Confirm entity type:
   - store batch uses `Promote stores`
   - personnel batch uses `Promote personnel`
3. Confirm `canPromote` is true.
4. Execute the promotion command once.
5. Capture promoted row evidence.
6. Re-open the batch and confirm promoted counts.

Do not promote a full company baseline as the first smoke.

Do not run a second promotion command just to see what happens. Idempotent evidence is useful, but repeated operator clicks are not part of the first smoke.

## 8. Evidence Note Template

Use this format:

```text
Master Data Bootstrap Pilot Smoke Evidence
Date:
Environment:
Commit:
Operator:
Entity:
Batch ID:
Source Label:
File Reference:
Pilot Scope:
Row Count:
Valid Count:
Needs Review Count:
Invalid Count:
Already Promoted Count:
Ready Count:
Blocked Count:
canPromote:
Promotion Command Run: yes/no
Promoted Rows:
Known Limitations:
Decision: Go / Conditional Go / No-Go
```

Sanitization rules:

- Do not paste raw TC/national id values.
- Do not paste phone numbers.
- Do not paste raw access tokens.
- Do not paste database passwords.
- Prefer row ids, counts, status values, and redacted screenshots.
- capture sanitized evidence only.

## Go / Conditional Go / No-Go

Go:

- baseline file is true master data,
- pilot scope is clear,
- validation is clean,
- dry-run readiness is clean,
- promoted rows match expected pilot scope,
- sanitized evidence is recorded.

Conditional Go:

- only already-promoted rows are present besides ready rows,
- minor review notes exist but no unresolved row will be promoted,
- operator records the limitation before promotion.

No-Go:

- file is a KPI snapshot,
- identity codes are missing,
- unresolved rows would be promoted,
- dry-run readiness is not clean,
- environment is wrong,
- evidence cannot be sanitized,
- live `ops.*` tables were manually edited.

## CODEX DURUST YORUM

This runbook is intentionally boring and strict. That is the point.

The first real baseline promotion should not be a heroic click. It should be a controlled smoke with a small scope, visible backend dry-run evidence, and a written decision. That keeps master data from becoming a hidden source of future score and authorization problems.

## Next Logical Step

When true store/personnel baseline files exist, use this runbook for the first scoped pilot smoke. If true baseline files still do not exist, keep master-data promotion closed and continue only with small guards that improve existing evidence surfaces.
