# Excel KPI Import Operator Runbook V1

## Metadata

- Status: V1 operator runbook for local pilot and future monthly/daily Excel imports.
- Owner: HR/Admin import operator with backend/data review support.
- Last updated: 2026-04-28.
- Purpose: Make Excel KPI import repeatable before more periods are loaded.

## Decision Rule

Do not treat an Excel upload as official performance data until the operator has reviewed the upload summary, identity mapping result, data quality issues, and reconciliation result for the selected period.

If store/personnel identity is unresolved, keep the row as review evidence. Do not create temporary stores or employees from Excel names.

## Scope

This runbook covers:

- `MAĞAZA TABLO.xlsx` style store KPI files.
- `PERSONEL TABLO.xlsx` style personnel KPI files.
- monthly, daily, and custom date-range uploads.
- local pilot use before staging/production source integration.
- review of reconciliation and unmapped identity evidence.

This runbook does not cover:

- store/personnel master-data bootstrap.
- seller-code request approval.
- direct production DB edits.
- JSON/API source adapter behavior.
- final payroll/bonus payment approval.

## Business Rules To Preserve

- Store performance uses store net sales from the store Excel file.
- Personnel performance uses positive gross personnel sales only.
- Negative personnel rows do not reduce employee KPI.
- Negative personnel rows remain reconciliation evidence.
- Store net sales must not subtract personnel negative rows a second time.
- Period `ATV`, `UPT`, and `CR` are recomputed from base totals.
- Daily ratio averages are not official period KPI values.
- Only locally enabled stores should be imported into official KPI scope.

## Roles And Responsibilities

Prepared by:
- Confirms which file pair and period will be loaded.
- Confirms the files are KPI snapshot files, not master-data baseline files.
- Confirms local store scope/mapping is ready enough for the pilot.

Executed by:
- Runs backend/frontend locally or uses the approved target environment.
- Uploads the files with the correct period type and date range.
- Records upload summary, issue counts, and reconciliation result.

Reviewed by:
- Checks unmapped store/personnel rows.
- Checks reconciliation deltas and dominant data quality categories.
- Confirms no wrong score was written for unresolved identities.

Approved by:
- Decides Go, Conditional Go, or No-Go for using the import result.
- Records known limitations before any score/ranking interpretation is trusted.

## 1. Environment Preflight

Local backend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run start:dev
```

Local frontend:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run dev
```

Local Keycloak if real local login is used:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\infra"
docker compose -f docker-compose.keycloak.yml up -d
```

Checklist:

- [ ] Backend is running.
- [ ] Frontend is running.
- [ ] Operator can log in with an admin/HR-capable user.
- [ ] Database migrations are applied in the active environment.
- [ ] No production data is edited manually.
- [ ] Current branch/commit is recorded if this is a pilot evidence run.

## 2. File Preflight

For every import run, record:

- [ ] Store KPI file path.
- [ ] Personnel KPI file path.
- [ ] Period type: `daily`, `monthly`, or `custom`.
- [ ] Period start date.
- [ ] Period end date.
- [ ] Source month/date shown in the source system.
- [ ] Whether the files came from the same export/filter session.

Required store file expectations:

- [ ] Store name column exists.
- [ ] Target exists if target achievement will be reviewed.
- [ ] Net sales / ciro exists.
- [ ] Sales quantity exists.
- [ ] Invoice count exists.
- [ ] `FF` exists.
- [ ] Source `CR`, `ATV`, and `UPT` are present as evidence, even though official values are recomputed.

Required personnel file expectations:

- [ ] Personnel name exists.
- [ ] Store name exists.
- [ ] Positive sales amount exists.
- [ ] Personnel item count exists.
- [ ] `P.ATV` and `P.UPT` exist if personnel ratio derivation will be reviewed.
- [ ] Negative rows are expected and are not a failure by themselves.

No-Go:

- Store file and personnel file are from different periods.
- Operator cannot identify the selected period.
- Store file lacks net sales.
- Store file lacks both invoice count and enough base data to recompute official ratios.
- File is actually a master-data list rather than KPI snapshot evidence.

## 3. Store Scope Preflight

Before upload, review store import scope:

- [ ] Stores that should receive KPI data are present in local master data.
- [ ] Stores outside the business scope, such as garage/tent/ignored stores, are not KPI import enabled.
- [ ] Store names in Excel have expected mapping candidates.
- [ ] Unknown stores are expected to become mapping review evidence, not official KPI rows.

Decision rule:

If a store is not enabled for KPI import, its Excel row should not create official store KPI data. This protects the pilot from importing unwanted garage/tent stores.

## 4. Upload Steps

In the admin integration surface:

1. Open the integration/import dashboard.
2. Choose the Power BI / Excel KPI upload area.
3. Select the period type.
4. Fill the period date fields:
   - `daily`: same start and end date.
   - `monthly`: month picker or first/last day of month.
   - `custom`: explicit start and end date.
5. Attach the store KPI Excel file.
6. Attach the personnel KPI Excel file if the flow asks for both files separately.
7. Start upload.
8. Do not approve the result from the file name alone; wait for summary and issue evidence.

Expected immediate result:

- Upload creates an import batch or upload summary.
- Summary shows canonical row counts.
- Summary shows unmapped store/personnel counts where applicable.
- Summary shows reconciliation counts or values when available.
- No temporary store or employee is auto-created from name-only Excel rows.

## 5. Summary Review

Review these values after upload:

- [ ] Total source row count.
- [ ] Store KPI row count.
- [ ] Personnel KPI row count.
- [ ] Error row count.
- [ ] `unmapped_store` count.
- [ ] `unmapped_employee` count.
- [ ] `ratio_denominator_conflict` count.
- [ ] `missing_invoice_count` count if present.
- [ ] Store scope skipped/ignored count if shown.
- [ ] Reconciliation item count.

Acceptable for a first pilot:

- Some unmapped employee rows, if seller-code baseline is not fully ready.
- Some unmapped store rows, if they correspond to stores intentionally outside import scope.
- Negative personnel rows, if they appear as reconciliation evidence and not employee KPI rows.

No-Go:

- Official KPI row count is zero for in-scope stores.
- Every store is unmapped.
- Every employee row is scored without official identity/mapping.
- Negative personnel rows reduce employee performance.
- Store net sales appears to subtract personnel negatives twice.
- Period `ATV`, `UPT`, or `CR` is copied as a daily average instead of recomputed.

## 6. Identity Mapping Review

For unmapped stores:

- [ ] Check whether the store should be in business scope.
- [ ] If yes, map to the official store record.
- [ ] If no, leave it outside KPI import scope and record why.
- [ ] Do not create a new official store from a display name unless the master-data bootstrap process approves it.

For unmapped employees:

- [ ] Check whether seller code / official employee reference exists.
- [ ] If yes, map the external/personnel name evidence to the official employee.
- [ ] If no, keep the row unresolved and do not score it as official employee performance.
- [ ] Do not create official employee records from name-only KPI Excel rows.

Evidence to record:

- mapping decision owner.
- number of mapped stores.
- number of mapped employees.
- unresolved rows and reason.
- whether a re-upload or rematerialization is required.

## 7. Reconciliation Review

The expected relationship is:

```text
personnel positive gross sales + personnel negative movements ~= store net sales
```

Review:

- [ ] Store net sales from store file.
- [ ] Personnel positive gross sales total.
- [ ] Personnel negative movement total.
- [ ] Net movement after positives and negatives.
- [ ] Delta between net movement and store net sales.
- [ ] Stores with large reconciliation delta.

Marmara Park acceptance pattern:

```text
positive personnel sales - returns/exchanges/netting = store net sales
```

No-Go:

- delta is large and unexplained for an in-scope store.
- negative movement is missing from reconciliation evidence.
- negative movement is subtracted from both employee and store result.
- reconciliation cannot identify which store caused the issue.

## 8. Retry And Re-Upload Rules

Safe retry:

- Same exact file and same selected period can be uploaded again without double counting.
- Corrected file for the same period is allowed, but operator must record why the payload changed.
- Re-upload should be reviewed through the same summary and reconciliation checklist.

Before retry:

- [ ] Confirm period type/date range is the same intended period.
- [ ] Confirm store mappings changed or file correction is intentional.
- [ ] Record previous batch id/source batch id if visible.
- [ ] Record new batch id/source batch id if visible.

No-Go:

- retrying with a different date range by accident.
- uploading monthly and daily files for the same period into the same official score interpretation without a clear rule.
- manually changing live KPI rows to "fix" import output.

## 9. Materialization And Score Trust

Only treat imported values as score/ranking input when:

- [ ] import batch status is acceptable.
- [ ] critical unmapped store issues are resolved or intentionally excluded.
- [ ] personnel identity issues are understood before employee score interpretation.
- [ ] reconciliation has no unexplained critical delta.
- [ ] release/build status of the running code is known.

If this is only a pilot:

- [ ] Label the evidence as pilot.
- [ ] Do not present scores as final payroll/bonus truth.
- [ ] Record known limitations.

## 10. Evidence Note Template

Use this block for every real/pilot import note:

```markdown
## Excel KPI Import Evidence

- Environment:
- Commit SHA:
- Operator:
- Reviewer:
- Approval owner:
- Period type:
- Period start:
- Period end:
- Store file:
- Personnel file:
- Upload/batch id:
- Source batch id:
- Store rows:
- Personnel rows:
- Official KPI rows:
- Unmapped stores:
- Unmapped employees:
- Data quality issue summary:
- Store net sales total:
- Personnel positive gross total:
- Personnel negative movement total:
- Reconciliation delta:
- Retry/re-upload needed: Yes / No
- Materialization decision: Go / Conditional Go / No-Go
- Known limitations:
- Date:
```

Evidence rules:

- Do not paste personal TC numbers.
- Do not paste phone numbers unless the approved workflow requires it.
- Do not paste raw database credentials.
- Do not paste raw tokens, cookies, authorization codes, or secrets.
- Do not attach uncontrolled screenshots containing sensitive personal data.

## Go / Conditional Go / No-Go

Go:

- In-scope stores are mapped.
- Store net vs personnel movement reconciliation is understood.
- Critical data quality issues are zero or resolved.
- Re-upload behavior is understood for the selected period.

Conditional Go:

- Store KPI totals are usable.
- Some employee rows remain unmapped, and employee scoring/ranking is explicitly marked lower-trust or held.
- Known limitation is documented with an owner.

No-Go:

- Store period is wrong.
- In-scope store mapping is not ready.
- Reconciliation delta is large and unexplained.
- Negative rows affect employee performance.
- Official period ratios are calculated as daily averages.
- Operator cannot tell which file/period produced the batch.

## CODEX Honest View

This runbook is the right kind of boring. The Excel parser is already useful, but the business risk is not parsing; the risk is trusting a wrong period, wrong store scope, or name-only employee identity too early.

The strongest part of the current implementation is that it refuses to invent official identities. Keep that discipline. Once store/personnel baseline quality improves, this same runbook can become the staging/prod import checklist without changing the business rules.

## Next Logical Step

Run the first March import as a controlled pilot only after store import scope is reviewed. Use the evidence template above, then decide whether the next work is mapping cleanup, store/personnel baseline import, or UI polish for the import summary.
