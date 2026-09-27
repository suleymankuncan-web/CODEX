# Daily personnel bootstrap boundary

Daily sales movements and personnel master data have different authority. The
provider-neutral movement planner in
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

The planner takes sanitized store/person/day aggregates and a set of known
personnel codes, including separated employees. It returns new provisional
bootstrap candidates, mapped movements, and unmapped movements. The
company-specific daily fetcher is a separately pinned private runner, not
part of the public on-prem backend image. Its local source can call this
planner, but updating this repository alone does not change the pinned live
runner. Before enabling this behavior in production, the owner must rebuild
and verify that private image against the matching public backend, then deploy
it with a rollback plan. Do not describe the public image proof as proof of
the private runner.

Run `docs/operations/personnel-auto-roster-review.sql` in a private read-only
session with `bootstrap_source_code` set to the reviewed source. The
`return_only_bootstrap_review` group means **no positive sale in retained daily
component facts**, not proof that a person never worked there: early facts may
be absent, and HR may have subsequently corrected the record. The
`later_positive_sale_review` group is deliberately separate; negative net on
one day must not remove someone with a positive sale movement. Compare source
batch IDs, assignment history, HR approvals and earlier provider records
before correcting a legacy assignment. Until confirmed, leave Norm Kadro
headcount and historical Türkiye ranking facts untouched. Do not commit the
query output or delete/deactivate unverified records in bulk.
