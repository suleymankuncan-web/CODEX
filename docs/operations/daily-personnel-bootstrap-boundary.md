# Daily personnel bootstrap boundary

Daily sales movements and personnel master data have different authority. The
provider-neutral selector in
`backend/nestjs/src/modules/integration/application/company-daily-kpi-personnel-eligibility.ts`
may propose a **new provisional** person only when a current-day movement has
both a positive sale invoice count and a positive sale amount. A larger return
may make the signed net negative without changing that decision. Return-only
movements must remain in the store's signed total and, when no employee exists,
in `ops.company_daily_kpi_unmapped_personnel_sales`; they must not create an
employee or assignment.

An existing employee code is never authority to reactivate a separated person,
move a primary assignment, or create a second permanent primary assignment.
Sales at multiple stores retain their own store/person/day facts. A historical
replay must not bootstrap a current roster entry; HR master-data approval is
required for a real rehire or transfer. No automatic cleanup of earlier
provisional assignments is part of this change.

The company-specific daily fetcher is a separately pinned private runner, not
part of the public on-prem backend image. Updating this repository alone does
not change that runner. Before enabling this behavior in production, its owner
must integrate the selector and unmapped-fact write, build and verify a new
runner image, and deploy it with a rollback plan. Do not describe the public
image proof as proof of the private runner.

Run `docs/operations/personnel-auto-roster-review.sql` in a private read-only
session with `bootstrap_source_code` set to the reviewed source. Its source
batch IDs and sale/return evidence are for HR review; do not commit its output
or delete/deactivate unverified records in bulk.
