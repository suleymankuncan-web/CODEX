# Pilot Route Role Matrix

## Classification Rules

- `core`: needed for the pilot user journey or first production product.
- `ops`: useful for operations, support, diagnostics, or admin maintenance.
- `secondary`: store-facing feature surface that is not part of the current pilot-critical path.
- `legacy/pilot`: temporary, debug, demo, or transitional surface.

## Authority

The runtime Store route registry and route guard own frontend route entitlement.
This matrix describes their current behavior and must be updated with the same
review story when that behavior changes. Backend catalog membership and endpoint
role checks remain separate authority layers; a catalog role alone does not
grant a frontend route.

The complete source-derived Admin, Store, and Auth route classification lives in
`docs/architecture/authorization-operating-truth-v1.json`. Direct product routes
are owned by this human matrix. Detail routes inherit their parent policy;
aliases, shell redirects, Auth-flow routes, and wildcard fallbacks are classified
explicitly in the generated inventory instead of being treated as product grants.

A Visual Merchandiser-only session lands on `/store/checklists` and may use
only `/store/checklists`, `/store/visual-campaigns`, `/store/feed`, and `/store/settings`. It is denied
every other Store route unless a broader role changes its Store persona.

A Report Viewer-only session is Store-only. It lands on `/store/home`, may use
only the Store routes granted to `REPORT_VIEWER`, and is denied every `/admin/*`
route. A separate Admin role may still grant its own Admin routes.

## Route Matrix

| Route | Shell | Classification | Roles | Landing Behavior | Refresh/Return Expectation | Data Boundary | Primary Nav |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin/integrations` | admin | core | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | first landing for super admin and integration admin | must return to same route after auth verification | company-scoped import state | yes |
| `/admin/operations` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped operational health and readiness signals | yes |
| `/admin/data-quality` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped import, snapshot, workforce, and KPI quality signals | yes |
| `/admin/master-data` | admin | core | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped bootstrap batches | yes |
| `/admin/snapshots` | admin | ops | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` | first landing for snapshot operator | must return to same route after auth verification | company-scoped snapshot state | yes |
| `/admin/inbox` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | current admin queue scope | yes |
| `/admin/feed` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | direct navigation only | must return to same route after auth verification | announcement management scope | yes |
| `/admin/checklists` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | checklist template governance | yes |
| `/admin/competitions` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | first landing for HR admin | must return to same route after auth verification | competition setup and read scope | yes |
| `/admin/reports` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | reporting read models | yes |
| `/admin/targets` | admin | core | `SUPER_ADMIN`, `REGION_MANAGER` | direct navigation for region manager target follow-up | must return to same route after auth verification when opened directly | target approval queue by scope | yes |
| `/admin/incentives` | admin | core | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped incentive package review | yes |
| `/admin/kpi-config` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | global KPI governance | yes |
| `/admin/pilot-feedback` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | controlled-pilot feedback register | yes |
| `/admin/auth` | admin | core | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | auth admin catalog and assignment scope | yes |
| `/admin/audit` | admin | core | `SUPER_ADMIN`, `AUDITOR` | first landing for auditor | must return to same route after auth verification | audit event read scope | yes |
| `/admin/session` | admin | ops | every catalog role except `REPORT_VIEWER` | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |
| `/store` | store | core | authenticated store shell session | first landing family varies by role: visual merchandiser-only resolves to `/store/checklists`; `STORE_PERSONNEL` resolves to `/store/me`; `STORE_MANAGER`, `REGION_MANAGER`, and broad store sessions resolve to `/store/home` | must return to same route after auth verification | current store shell overview | yes |
| `/store/home` | store | core | authenticated store shell session except visual-merchandiser-only sessions | landing route for store manager, region manager, and broad Store sessions | must return to same route after auth verification | role-aware Store command overview | yes |
| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |
| `/store/personnel/:employeeId` | store | secondary | `STORE_PERSONNEL`, `STORE_MANAGER`, `REGION_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER` | direct navigation from an authorized ranking/profile disclosure | must return to same route after auth verification | self, assigned-store, assigned-region, or Report Viewer company personnel profile read; no action | yes |
| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles; company-scoped read for Report Viewer; no action | yes |
| `/store/approvals` | store | core | `STORE_MANAGER`, `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN`; write actions remain action-store scoped | direct navigation or store landing link for eligible roles only | must return to same route after auth verification | target/workforce request ledger by read/action scope | yes |
| `/store/targets` | store | core | `STORE_MANAGER`, `REGION_MANAGER`, `REPORT_VIEWER`, `SUPER_ADMIN`; write actions remain action-store scoped | direct navigation or store landing link for eligible roles only | must return to same route after auth verification | target distribution requests, coverage and approval state by scope | yes |
| `/store/checklists` | store | secondary | `STORE_MANAGER`, `REGION_MANAGER`, `VISUAL_MERCHANDISER`, `REPORT_VIEWER`, `SUPER_ADMIN` | first landing for visual merchandiser-only sessions | must return to same route after auth verification | checklist tasks/results by store scope; `STORE_PERSONNEL` is forbidden | yes |
| `/store/visual-campaigns` | store | secondary | `VISUAL_MERCHANDISER` with an explicit company-scoped publisher or reviewer capability; `STORE_MANAGER` with an assigned campaign store; `REGION_MANAGER` with both a current region-role assignment and current action-store assignment | direct navigation only; real-photo, advisory enqueue/worker and advisory review flags remain fail-closed | must return to same route after auth verification | publisher/reviewer company scope, exact Store Manager campaign assignment, or Region Manager region/action-store intersection; `REPORT_VIEWER` remains excluded from advisory detail | yes |
| `/store/tasks` | store | secondary | `STORE_MANAGER`, `REGION_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER`; `STORE_PERSONNEL` is forbidden | direct navigation only for eligible roles; region manager sees scoped read-only remediation rows | must return to same route after auth verification | workflow inbox and Store Action task visibility by read/action scope; Store Action commands remain assigned-store scoped | yes |
| `/store/kpis` | store | secondary | `STORE_MANAGER`, `REGION_MANAGER`, `SUPER_ADMIN`, `REPORT_VIEWER`; `STORE_PERSONNEL` uses `/store/me` for personal KPI | direct navigation only | must return to same route after auth verification | current store KPI highlights | no |
| `/store/feed` | store | secondary | authenticated store shell session; visual merchandiser-only is permitted | direct navigation only | must return to same route after auth verification | store announcements | yes |
| `/store/settings` | store | secondary | authenticated store shell session; visual merchandiser-only is permitted | direct navigation only | must return to same route after auth verification | local language preference and session-visible shell settings | yes |
| `/store/competitions` | store | secondary | `STORE_MANAGER`, `STORE_PERSONNEL`, `REPORT_VIEWER` | direct navigation only | must return to same route after auth verification | company-scoped competition reads for Report Viewer; stage/template writes remain unavailable | yes |
| `/store/incentives` | store | secondary | frontend runtime: `REGION_MANAGER`; backend read compatibility also declares `STORE_MANAGER`; Auth Admin preview is broader; DG-1 owns the final alignment | direct navigation only | must return to same route after auth verification | region-scoped incentive command surface; personnel own projection remains under `/store/me` | no |
| `/store/workforce` | store | secondary | `STORE_MANAGER` with assigned action store, `REGION_MANAGER` with read store or read region scope, `REPORT_VIEWER` with non-empty company read scope, `SUPER_ADMIN` with company read scope | direct navigation only | must return to same route after auth verification | read-only company portfolio for Report Viewer and Super Admin; request/forms and action-assisted lookups remain unavailable | yes |
| `/store/reports` | store | secondary | `SUPER_ADMIN`, `REPORT_VIEWER`, `AUDITOR`, `REGION_MANAGER`; `STORE_MANAGER` is forbidden for now | direct navigation only | must return to same route after auth verification | monthly store report package by read scope | yes |

## Landing Order

Current landing resolution:

1. unauthenticated or unconfigured session: `/auth/login`
2. `SUPER_ADMIN` or `INTEGRATION_ADMIN`: `/admin/integrations`
3. `SNAPSHOT_OPERATOR`: `/admin/snapshots`
4. `HR_ADMIN`: `/admin/competitions`
5. `AUDITOR`: `/admin/audit`
6. `VISUAL_MERCHANDISER`-only session: `/store/checklists`
7. `STORE_PERSONNEL` without manager/region role: `/store/me`
8. `REPORT_VIEWER`, `REGION_MANAGER`, `STORE_MANAGER`, or broad Store sessions: `/store/home`

## Review Notes

- No route should be removed from navigation until this matrix is reviewed.
- `needs decision` screens stay visible until a product decision moves them to `core`, `ops`, `secondary`, or `legacy/pilot`.
- Store role detail visibility is enforced by page/API access rules, not by hiding the route alone.
- `REPORT_VIEWER` Store access is a company-scoped read-only portfolio. It does not
  imply action-store scope, request creation, checklist execution, competition
  writes, incentive access, or `/store/me` self projection.
- Known route/preview and route/backend mismatches are fail-closed in
  `docs/architecture/authorization-operating-truth-v1.json`; their presence is
  evidence of a decision gate, not permission to widen runtime access.
- Catalog inclusion for `VISUAL_MERCHANDISER` does not imply a Store route
  entitlement. Visual Merchandiser-only behavior is the four-route boundary
  stated in the Authority section; endpoint authorization remains independently
  enforced.
- `STORE_PERSONNEL` is intentionally excluded from `/store/approvals` until a
  scoped read-only personnel approvals product requirement exists.
- `STORE_PERSONNEL` is intentionally excluded from `/store/checklists`; personal
  KPI/checklist impact can appear through `/store/me` or sourced KPI views, but
  checklist execution/result queues belong to manager, region, VM, reporting,
  or super-admin roles.
- `STORE_PERSONNEL` is intentionally excluded from `/store/tasks`; personal
  next-step context should remain on `/store/me`, `/store/home`, or
  `/store/rankings` until a separate personal task surface is scoped.

## Store Manager Pilot Gate

Store Manager pilot readiness is covered by a named smoke and e2e contract:

```powershell
npm.cmd --prefix admin-web run test:e2e:store-manager -- --workers=1
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
```

The contract keeps `/store/reports` forbidden for `STORE_MANAGER`, keeps
Region Manager-only incentive approval controls out of the Store Manager
surface, and verifies that checklist result acknowledgement stays available
without exposing raw identifiers in the UI.

## Store Personnel Pilot Gate

Store Personnel pilot readiness is covered by a named smoke and e2e contract:

```powershell
npm.cmd --prefix admin-web run test:e2e:store-personnel -- --workers=1
npm.cmd --prefix admin-web run smoke:auth:staging:store-personnel
```

The contract keeps `/store` landing on `/store/me`, keeps management routes
(`/store/tasks`, `/store/checklists`, `/store/approvals`, `/store/targets`,
`/store/workforce`, `/store/reports`, `/store/kpis`, `/store/incentives`)
unavailable before their protected data requests fire, and verifies that feed
and home stay read-only for personnel sessions.
