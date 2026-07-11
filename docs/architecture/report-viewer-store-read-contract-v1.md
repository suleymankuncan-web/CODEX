# Report Viewer Store Read Contract V1

Status: active
Shelf: architecture
Last verified: 2026-07-11

This is the DG1-A source-derived contract for the Report Viewer Store
portfolio. Report Viewer is an upper-management, read-only role. Its effective
read boundary is `actor.roleScopes.REPORT_VIEWER.companyIds`; the aggregate
`actor.scope` is not a substitute because it can contain assignments from
another role on a mixed-role session.

## Boundary

```text
effective read companies = actor.roleScopes.REPORT_VIEWER.companyIds
effective action stores  = unchanged actor.actionScope.assignedStoreIds
mutation rights          = unchanged; no Report Viewer command is added
empty company scope      = fail closed
```

The development mock provider may use its legacy company headers as a tested
compatibility fallback. JWT/browser production sessions fail closed when the
role-specific scope is absent. Region/store fields in a Report Viewer role
scope are ignored; the role is company-scoped.

## Route-to-GET inventory

Each business-data request mounted by the allowlisted Store pages is listed
below. `role_specific_company_enforced` means the controller passes the
role-specific company scope and the service/repository applies it before
returning data. `not_exposed_to_report_viewer` means the frontend route guard
does not mount the request and the backend role contract excludes it.

| Route | Frontend call | Endpoint | Owning path | Classification / proof |
| --- | --- | --- | --- | --- |
| `/store` and `/store/home` | `getWorkflowInbox`, `getChecklistAcknowledgements`, `getOrgStores` | `GET /api/workflow/inbox`, `POST /api/checklists/acknowledgements/list`, `GET /api/org/stores` | `WorkflowInboxController`, `ChecklistController`, `OrgController` | `role_specific_company_enforced`; approval/KPI/ack/store queries use the Report Viewer company scope |
| `/store/checklists` | `getChecklistAcknowledgements` | `POST /api/checklists/acknowledgements/list` | `ChecklistController` → `ChecklistService` → acknowledgement repository | `role_specific_company_enforced`; result/acknowledgement read only |
| `/store/tasks` | `getWorkflowInbox`, `listStoreActionPlans` and detail | `GET /api/workflow/inbox`, `GET /api/store-actions/plans`, `GET /api/store-actions/plans/:actionPlanId` | workflow/store-action controllers and repositories | `role_specific_company_enforced`; no command route is allowed |
| `/store/kpis` | `getStoreKpiHighlights`, score breakdown, `getOrgStores` | `GET /api/reports/store-kpi-highlights`, `GET /api/reports/store-score-breakdown`, `GET /api/org/stores` | `ReportingController`, `ReportingService`, KPI/score read repositories | `role_specific_company_enforced`; direct store IDs are checked against company scope |
| `/store/personnel/:employeeId` | `getPersonnelPerformance` | `GET /api/reports/personnel-performance/:employeeId` | `ReportingController` → `ReportingService` → active-assignment lookup | `role_specific_company_enforced`; current active assignment company, no new fields |
| `/store/rankings` | `getRankings` | `GET /api/reports/rankings` | `ReportingController` → `RankingService` → ranking repositories | `role_specific_company_enforced`; list SQL receives company IDs and personnel detail checks active assignment |
| `/store/feed` | `listVisibleFeedPosts` | `GET /api/feed` | `FeedController` → feed repository | `role_specific_company_enforced`; visible feed scope is the company scope |
| `/store/competitions` | `listCompetitions`, `getCompetition` | `GET /api/competitions`, `GET /api/competitions/:competitionId` | `CompetitionController` → `CompetitionService` → competition repository | `role_specific_company_enforced`; detail and store contributions are filtered |
| `/store/approvals` | request-center reads | `GET /api/workflow/request-center` | `WorkflowInboxController` → `WorkflowInboxService` → request-center repository | `role_specific_company_enforced`; no approve/create command is exposed |
| `/store/targets` | target requests and coverage | `GET /api/target-distributions/requests`, `GET /api/target-distributions/coverage` | `TargetDistributionController` → target service/repository | `role_specific_company_enforced`; writes remain outside role |
| `/store/workforce` | `getStoreEmployees`, `getStoreHeadcountGap`, `getOrgStores` | `GET /api/workforce/store-employees`, `GET /api/workforce/headcount-gap`, `GET /api/org/stores` | `WorkforceController` → `WorkforceService` → workforce/store repositories | `role_specific_company_enforced`; read-only portfolio, no request/form mode |
| `/store/reports` | monthly package and export | `GET /api/reports/store-monthly-package`, `GET /api/reports/store-monthly-package.xlsx` | `StoreMonthlyReportPackageController` → package service/repositories | `role_specific_company_enforced`; ranking context uses the same company scope |
| shell/session | `getAuthSession`, `getAuthBootstrap` | `GET /api/auth/session`, `GET /api/auth/bootstrap` | auth controllers | `no_business_data`; supplies authenticated role/scope and readiness metadata |
| report summary/detail shell | snapshot metadata and report summary | `GET /api/reports/snapshot-runs`, `GET /api/reports/summary`, `GET /api/reports/kpi-config` | `ReportingController` | `no_business_data`; aggregate/config metadata only, existing role contract retained |
| `/store/me` | personal KPI/performance calls | `GET /api/reports/my-performance`, `GET /api/store/me/incentives` | Store self-performance/incentive controllers | `not_exposed_to_report_viewer`; route registry and backend role contract exclude Report Viewer |
| `/store/incentives` | incentive command/read calls | `GET /api/store/incentives` and incentive commands | incentive controller | `not_exposed_to_report_viewer`; Region Manager-only ordinary route, Super Admin bypass unchanged |
| checklist execution | mobile today/response commands | `GET /api/mobile/checklists/today`, checklist instance POSTs | mobile/checklist controllers | `not_exposed_to_report_viewer`; visit execution and action-assisted lookup stay outside scope |
| workforce request/form surfaces | seller-code/offboarding/position options | workforce request GETs and POST/PATCH commands | `WorkforceController` | `not_exposed_to_report_viewer`; frontend route mode and backend role contract remain read-only |
| target write/detail helpers | personnel targeting and approval commands | `GET /api/target-distributions/store-personnel`, POST/PATCH target commands | `TargetDistributionController` | `not_exposed_to_report_viewer`; no action-assisted lookup or mutation |

## Required isolation cases

Every `role_specific_company_enforced` row must preserve these cases in its
own focused tests or the owning existing test family:

- one permitted company succeeds;
- a store, employee, plan, competition, target, feed item, or workforce row
  from another company is absent or forbidden without a target payload;
- zero Report Viewer company IDs fails closed and never becomes global scope;
- multiple assigned companies return the union of only those companies;
- a mixed-role session does not inherit a store/region assignment from the
  other role into Report Viewer company reads;
- direct-ID reads apply the company predicate before returning the record;
- no POST/PATCH/PUT/DELETE, approval, assignment, checklist execution,
  workforce request, target request, or Store Action command becomes available.

## Implementation evidence

DG1-A introduces the reusable
`resolveReportViewerCompanyScope` boundary and applies it to the controllers
and read services above. The successful response shapes remain unchanged.
No database schema, migration, business-row DML, new personnel field, or
action-scope widening is part of this contract. The next DG1-B slice may expose
the frontend portfolio only after this inventory and the backend isolation
tests remain green.
