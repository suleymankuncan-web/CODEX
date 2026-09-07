# Sales-observed personnel V1

Status: owner-approved implementation, 7 September 2026

The owner has no complete personnel master source. The approved alternative is
to discover personnel codes in daily sales for stores already registered in HR
Axis and enabled for KPI import. This authorizes a code-only observation list;
it does not infer employment or grant access. The daily KPI source contract's
ephemeral-name/invoice protections and exact store allowlist remain in force.

## Behavior

- Identity is the exact source personnel code within an integration source and
  the company determined by its mapped store. Preserve case and leading zeroes.
- Store/day observations retain multiple stores for the same personnel code.
  Sale and return activity both count; positive net sales are not required.
- Missing personnel codes produce no personnel observation. Names never serve
  as fallback identifiers and are not persisted in this list.
- Source validation covers the whole response before replacement. Unregistered,
  inactive and KPI-disabled stores are excluded using existing store codes;
  the directory feed cannot create or enable stores.
- An accepted response atomically replaces only its source/day observation set.
  Repeating the same accepted attempt and digest is a no-op. New successful
  attempts may correct that day. Successful empty responses clear that day;
  failed or partial responses preserve the last accepted set.
- Attempt generation is allocated before fetching. A later-started fetch wins;
  an older response cannot overwrite it when it finishes late.
- Absence on a subsequent day never deletes earlier observations or marks a
  person inactive, terminated, transferred or absent from work.
- No writes to canonical employees, assignments, accounts, role grants, targets
  or KPI facts. Observation dates are not hire dates. This feature does not
  complete the separately required personnel-sales KPI projection.

## Read access

`GET /api/integrations/personnel-observations` uses the same company scope and
HR_ADMIN, SUPER_ADMIN, INTEGRATION_ADMIN roles as personnel master administration.
Required inclusive dates cover at most 366 days. Pagination is bounded at 200
rows and offset 1,000,000; optional code/store search is at most 80 characters.
The read-only personnel-page section defaults to the last 30 days and shows
personnel code, observed date and store. It offers no employment editing,
termination, user creation or permission action.

## Integration boundary

This feature adds no HTTP client, provider configuration, scheduler or separate
Docker process. The internal PersonnelObservationService accepts the same
neutral sales rows as the existing company daily KPI pure adapter, reuses its
whole-set validation and projects only code/store/day observations. The existing
KPI adapter, typed component storage and daily closure services remain the shared
integration foundation.

The caller allocates an attempt before obtaining the sales response, then passes
that generation with the successful set. This service is an internal acceptance
boundary; the shared live connector is not yet implemented or activated. No API
allows a browser to submit arbitrary sales or observation rows.

Unknown personnel can appear in the observation list without inventing canonical
employee records. They are not automatically persisted as employee KPI facts:
that existing writer still requires a mapped employee ID. Connecting a shared
source to both operations requires a reviewed acceptance transaction; independent
post-commit writes must not be presented as atomic sales import completion.

## Storage and rollback

Migration 076 adds `ops.personnel_observation_attempt` and
`ops.personnel_observation`. Read scope is obtained by joining the existing
store's company. Transactions serialize source/day writes and lock source/store
eligibility while accepting a set. Observation storage is separate from the
successful component facts which still require canonical employee IDs.

Rollback locks both tables in one transaction and refuses if either contains
data. For populated installations, preserve history and disable the pull;
do not delete observations to force rollback. Empty rollback removes only this
feature's tables and exact migration ledger entry.

The disposable PostgreSQL smoke script verifies duplicate and stale attempts,
multiple stores, exclusion, company-scoped reads, failure atomicity, absence
semantics, unchanged employment data and populated/empty rollback behavior.
