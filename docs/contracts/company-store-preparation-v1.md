# Company store preparation V1

Status: owner-approved preparation scope, 7 September 2026
Risk: R3 operator tooling; no runtime writes, API or database changes

The owner requested store mapping and company-data transition preparation.
The separately reviewed company-mode implementation merged in PR #1122 adds a
guarded runtime path; this slice observes its reported runtime classification
without activating or verifying that path. PR #1120 added sales-observed
personnel storage and a company-scoped read surface. This slice makes the next
mapping decision reviewable without starting a second sales connector or
changing the synthetic deployment's safeguards.

## Inputs and result

`scripts/company-store-preparation.mjs` compares three private, neutral inputs:
the complete directory code set, a complete registered-store inventory, and
the operator's explicit selected codes for one company. It reads no provider,
database, environment configuration, or network endpoint itself. The supplied
snapshot must reflect one consistent read of registered stores and the current
directory capture. `snapshotDate` must equal the explicit evaluation date;
this is an offline snapshot check, not a runtime freshness guarantee.

The input has exactly these fields:

```json
{
  "schemaVersion": 1,
  "snapshotDate": "2026-09-07",
  "targetCompanyId": "00000000-0000-0000-0000-000000000001",
  "directoryStoreCodes": ["synthetic-001"],
  "selectedStoreCodes": [],
  "registeredStores": [{
    "storeId": "00000000-0000-0000-0000-000000000003",
    "companyId": "00000000-0000-0000-0000-000000000001",
    "storeCode": "synthetic-001",
    "status": "active",
    "kpiImportEnabled": true
  }],
  "runtime": {"strictLocal": true, "dataClass": "synthetic"}
}
```

The example contains synthetic values only. Real values belong in an external
private file, never a repository fixture. Include every registered store,
including other companies and inactive/import-disabled stores, so ambiguous
or out-of-scope matches cannot disappear through upstream filtering. Use the
actual `HR_AXIS_STRICT_LOCAL` and `HR_AXIS_DATA_CLASS` values for `runtime`;
they are observations, not settings to apply. Do not include names, descriptions,
personnel, invoice rows, endpoint addresses, secrets, or provider-native fields.

## Matching rules

- Store codes preserve case and leading zeroes. No name matching, trimming,
  case folding, external-ID alias fallback, creation, or activation occurs.
- Selected codes must exist in the directory and resolve to exactly one
  registered store in the selected company, with `active` status and KPI import
  enabled. Missing, ambiguous, wrong-company, inactive and disabled matches are
  reported individually in the private report.
- Empty or duplicate selections, duplicate internal store IDs, and stale/future
  snapshot dates block mapping preparation. Repeated directory codes are reduced
  to a unique set, consistent with the existing directory sanitizer.
- UUID text is compared case-insensitively, consistent with PostgreSQL UUID
  identity. Source store-code text is always compared exactly.
- Arrays are capped at 10,000 entries and the input file at 4 MiB. These are
  offline tool limits, not approved provider runtime budgets.
- Extra fields and malformed inputs fail with a fixed diagnostic that contains
  no supplied value or path. Standard output contains only dates, categories,
  counts and boolean outcomes. Code-level rows are available only through the
  optional private report.

## Local use

Use Node 24 on Linux. Prepare a mode-0600 input outside the repository and use
a private mode-0700 directory for reports. The input must be a regular file;
symlinks and oversized inputs are refused. A report is created with mode 0600
and must not already exist. The CLI does not create directories or overwrite
files. For example, from the checkout:

```sh
node scripts/company-store-preparation.mjs \
  --input /private/hr-axis/store-preparation.json \
  --evaluation-date 2026-09-07 \
  --private-report /private/hr-axis/store-preparation-report.json
```

Exit 0 means only `mappingState=prepared`; exit 2 means a valid blocked mapping;
exit 1 means invalid input or unsafe/unavailable file I/O. **Every result retains
`activationState=blocked`.** An exit code is never permission to import data.
Private reports must not be uploaded to the public PR or a CI artifact.

## Company-data transition preparation

1. Obtain a current private inventory from the actual target database and a
   sanitized directory code set through the existing directory boundary. Record
   the actual company identifier; do not infer it from a synthetic persona.
2. The mapping owner selects the intended stores explicitly. Run this tool,
   review the private rows, and resolve missing or ineligible master data using
   the existing store administration workflow. The directory never enables
   stores automatically. Repeat the preflight after any inventory change.
3. Evaluate provider evidence with the existing company daily KPI connector
   readiness validator. Its authentication, internal transport acceptance,
   envelopes, field types, three-date observations, budgets and mapping/alert
   ownership requirements still apply. This tool does not duplicate or certify
   that evidence.
4. Use the separately reviewed company-data runtime mode from PR #1122 and one
   shared ingestion acceptance path, subject to actual runtime evidence. This
   tool observes the supplied `strictLocal` and `dataClass` values; it cannot
   verify opt-in/configuration, provider connectivity, or runtime behavior.
   With `strictLocal=true`, `dataClass=synthetic` remains synthetic-only, while
   `dataClass=company` is a valid observation that reports
   `company_runtime_not_verified` until that evidence exists. Any
   `strictLocal=false` observation reports `strict_local_required`. Preserve
   local auth, secret mounts, TLS, network restrictions and backup/restore
   behavior when operating that mode.
5. Connect successful sales acceptance to observations using the existing pure
   normalizer. Joint KPI/observation acceptance and unmapped canonical employee
   behavior must be explicit before daily ingestion is called complete. Exercise
   a synthetic source and failure/retry paths before a controlled company-day
   rehearsal, reconciliation and any deployment/cutover decision.

`company_runtime_not_verified`, `connector_readiness_not_evaluated`, and
`shared_ingestion_not_connected` are always reported in this version. A prepared
mapping therefore cannot mask the remaining verification and ingestion work or
authorize a schedule.
Power BI/Excel remains the operating import path. No live deployment, provider
call, company-data import, schedule, or automatic store creation is performed
by this PR.

## Verification and rollback

Tests cover exact identities, ambiguity and company boundaries, blocked
eligibility, explicit selection, date/config contradictions, bounded input,
privacy, deterministic reporting and exclusive private-file creation. Run:

```sh
node --test scripts/company-store-preparation.test.mjs
npm run test:scripts
git diff --check
```

Reverting this tooling/documentation commit requires no database rollback or
runtime configuration change. Previously generated private reports remain
operator-owned evidence and are not deleted by a revert.
