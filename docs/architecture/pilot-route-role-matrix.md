# Pilot Route Role Matrix

## Classification Rules

- `core`: needed for the pilot user journey or first production product.
- `ops`: useful for operations, support, diagnostics, or admin maintenance.
- `secondary`: store-facing feature surface that is not part of the current pilot-critical path.
- `legacy/pilot`: temporary, debug, demo, or transitional surface.

## Route Matrix

| Route | Shell | Classification | Roles | Landing Behavior | Refresh/Return Expectation | Data Boundary | Primary Nav |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin/integrations` | admin | core | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | first landing for super admin and integration admin | must return to same route after auth verification | company-scoped import state | yes |
| `/admin/master-data` | admin | core | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped bootstrap batches | yes |
| `/admin/snapshots` | admin | ops | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` | first landing for snapshot operator | must return to same route after auth verification | company-scoped snapshot state | yes |
| `/admin/inbox` | admin | needs decision | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | current admin queue scope | yes |
| `/admin/feed` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | direct navigation only | must return to same route after auth verification | announcement management scope | yes |
| `/admin/checklists` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | checklist template governance | yes |
| `/admin/competitions` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | first landing for HR admin | must return to same route after auth verification | competition setup and read scope | yes |
| `/admin/reports` | admin | ops | `SUPER_ADMIN`, `REPORT_VIEWER` | first landing for report viewer | must return to same route after auth verification | reporting read models | yes |
| `/admin/targets` | admin | core | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | direct navigation for region manager target follow-up | must return to same route after auth verification when opened directly | target approval queue by scope | yes |
| `/admin/kpi-config` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | global KPI governance | yes |
| `/admin/auth` | admin | core | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | auth admin catalog and assignment scope | yes |
| `/admin/audit` | admin | core | `SUPER_ADMIN`, `AUDITOR` | first landing for auditor | must return to same route after auth verification | audit event read scope | yes |
| `/admin/session` | admin | ops | any authenticated admin shell session | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |
| `/store` | store | core | authenticated store shell session | first landing family varies by role: `STORE_PERSONNEL` resolves to `/store/me`; `STORE_MANAGER`, `REGION_MANAGER`, and broad store sessions resolve to `/store/home` | must return to same route after auth verification | current store shell overview | yes |
| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |
| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles, full list for privileged roles | yes |
| `/store/approvals` | store | core | `STORE_MANAGER`, `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN`; write actions remain action-store scoped | direct navigation or store landing link for eligible roles only | must return to same route after auth verification | target/workforce request ledger by read/action scope | yes |
| `/store/checklists` | store | secondary | `STORE_MANAGER`, `REGION_MANAGER`, `VISUAL_MERCHANDISER`, `REPORT_VIEWER`, `SUPER_ADMIN` | first landing for visual merchandiser-only sessions | must return to same route after auth verification | checklist tasks/results by store scope; `STORE_PERSONNEL` is forbidden | yes |
| `/store/tasks` | store | secondary | `STORE_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER`; `STORE_PERSONNEL` is forbidden | direct navigation only for eligible roles | must return to same route after auth verification | workflow inbox and Store Action task visibility by read/action scope | no |
| `/store/kpis` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | current store KPI highlights | no |
| `/store/feed` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store announcements | yes |
| `/store/competitions` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store-visible competitions | yes |
| `/store/incentives` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store incentives preview | no |

## Landing Order

Current landing resolution in `admin-web/src/App.tsx`:

1. unauthenticated or unconfigured session: `/auth/login`
2. `SUPER_ADMIN` or `INTEGRATION_ADMIN`: `/admin/integrations`
3. `SNAPSHOT_OPERATOR`: `/admin/snapshots`
4. `HR_ADMIN`: `/admin/competitions`
5. `REPORT_VIEWER`: `/admin/reports`
6. `AUDITOR`: `/admin/audit`
7. `VISUAL_MERCHANDISER`: `/store/checklists`
8. `STORE_PERSONNEL` without manager/region role: `/store/me`
9. `REGION_MANAGER`, `STORE_MANAGER`, or broad store sessions: `/store/home`

## Review Notes

- No route should be removed from navigation until this matrix is reviewed.
- `needs decision` screens stay visible until a product decision moves them to `core`, `ops`, `secondary`, or `legacy/pilot`.
- Store role detail visibility is enforced by page/API access rules, not by hiding the route alone.
- `STORE_PERSONNEL` is intentionally excluded from `/store/approvals` until a
  scoped read-only personnel approvals product requirement exists.
- `STORE_PERSONNEL` is intentionally excluded from `/store/checklists`; personal
  KPI/checklist impact can appear through `/store/me` or sourced KPI views, but
  checklist execution/result queues belong to manager, region, VM, reporting,
  or super-admin roles.
- `STORE_PERSONNEL` is intentionally excluded from `/store/tasks`; personal
  next-step context should remain on `/store/me`, `/store/home`, or
  `/store/rankings` until a separate personal task surface is scoped.
