# Store Operations Data Model

## Used Skills
- `project-context`
- `database-designer`
- `product-architect`
- `integration-architecture`
- `workforce-hr-metrics`
- `checklist-workflow`

## Assumptions
- Database target is PostgreSQL.
- Employee mobility between stores/regions must be preserved historically.
- Reporting workloads are read-heavy and must not query mutable operational tables directly for official period reporting.
- External systems may send incomplete or dirty records, so staging validation is mandatory.
- Authorization is scope-based and can be granted at company, region, or store level.

## Technical Decisions
- `ops`, `rpt`, `stg`, and `audit` schemas are separated to isolate transactional, reporting, integration, and logging concerns.
- `ops.employee_assignment_history` is the workforce time-series anchor. Current store, current role, turnover, and active headcount derive from it.
- Snapshot reporting tables are immutable and protected with triggers against `UPDATE` and `DELETE`.
- RBAC uses role, permission, and scope-bound role assignment tables rather than hard-coded role columns.
- Checklist design separates reusable templates from executed instances and response rows.
- KPI design separates metric definition, target, and actual data to support both system-generated and integration-fed metrics.
- Workforce planning separates norm data from live assignments so gap analysis is explicit and auditable.
- Integration loads land in `stg.*` tables first, then map to internal entities through `stg.external_id_map`.
- Critical actions are logged through `audit.event_log`, with optional before/after payloads in `audit.entity_change_log`.

## Main Domains
- Organization: company, region, store
- Workforce: employee, assignment history, position, norm plan, turnover
- Security: user account, role, permission, scoped role assignment
- Audit/Checklist: template, template item, instance, response
- Performance: KPI definition, target, actual, employee review
- Reporting: immutable workforce/KPI/checklist/turnover snapshots
- Integration: source systems, import batches, raw payload staging, external ID mapping

## Key Relationships
- `company -> region -> store`
- `company -> employee`
- `employee -> employee_assignment_history -> store/region/position`
- `user_account -> user_role_assignment -> role -> role_permission -> permission`
- `checklist_template -> checklist_template_item`
- `checklist_template -> checklist_instance -> checklist_response`
- `kpi_definition -> kpi_target`
- `kpi_definition -> kpi_actual`
- `performance_review_period -> employee_performance_review`
- `snapshot_run -> rpt.* snapshot tables`
- `integration_source -> import_batch -> stg raw tables`

## Notes
- `db/schema.sql` is the production-oriented base DDL.
- Async processing is expected for large KPI loads, snapshot generation, and staging-to-ops materialization jobs.
- Official reporting should read from `rpt.*` tables, not directly from `ops.*`.
