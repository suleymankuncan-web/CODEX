import { Injectable } from "@nestjs/common";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { DatabaseService } from "../../../shared/database/database.service";

export type WorkforceStoreStatusFilter = "all" | "shortage" | "balanced" | "surplus" | "unconfigured";
export type WorkforceStoreSort = "store" | "active" | "norm" | "status" | "shortage" | "tenure";
export type WorkforceSortDirection = "ascending" | "descending";

export type WorkforceWorkspaceStoreRow = {
  company_id: string;
  company_name: string | null;
  region_id: string;
  region_name: string | null;
  region_manager_name: string | null;
  store_id: string;
  store_code: string;
  store_name: string;
  store_status: string;
  planned_headcount: string | null;
  active_headcount: string;
  average_tenure_days: string | null;
  shortage_started_on: string | null;
  shortage_days: number | null;
};

export type WorkforceWorkspacePersonRow = {
  store_id: string;
  employee_id: string;
  display_name: string;
  position_id: string;
  position_code: string;
  position_name: string;
  assignment_start_date: string | null;
  employment_status: string;
};

export type WorkforceWorkspaceHistoryRow = {
  position_name: string | null;
  employee_id: string;
  display_name: string;
  entry_date: string;
  exit_date: string | null;
  total_working_days: number | null;
};

@Injectable()
export class WorkforceWorkspaceReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async isStoreInScope(input: { scope: AuthReadScope; storeId: string }) {
    const scoped = scopeClause(input.scope, "store");
    const storeIndex = scoped.params.length + 1;
    const result = await this.databaseService.query<{ allowed: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM ops.store store WHERE ${scoped.sql} AND store.store_id = $${storeIndex}::uuid) AS allowed`,
      [...scoped.params, input.storeId],
    );
    return result.rows[0]?.allowed === true;
  }

  async listStorePage(input: {
    scope: AuthReadScope;
    regionManagerUserId?: string;
    limit: number;
    offset: number;
    query: string;
    status: WorkforceStoreStatusFilter;
    sort: WorkforceStoreSort;
    direction: WorkforceSortDirection;
  }) {
    const scoped = scopeClause(input.scope, "store", input.regionManagerUserId);
    const queryIndex = scoped.params.length + 1;
    const statusIndex = queryIndex + 1;
    const limitIndex = statusIndex + 1;
    const offsetIndex = limitIndex + 1;
    const order = storeOrder(input.sort, input.direction);
    const result = await this.databaseService.query<{
      items: WorkforceWorkspaceStoreRow[];
      total_count: string;
    }>(
      `
        WITH business_clock AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date AS business_today
        ),
        scoped_store AS (
          SELECT store.company_id, company.company_name, store.region_id, region.region_name,
            store.store_id, store.store_code, store.store_name, store.status AS store_status
          FROM ops.store store
          INNER JOIN ops.company company ON company.company_id = store.company_id
          INNER JOIN ops.region region ON region.region_id = store.region_id
          WHERE ${scoped.sql}
        ),
        active_assignment AS (
          SELECT assignment.store_id, COUNT(*)::text AS active_headcount,
            (AVG(clock.business_today - COALESCE(assignment.start_date, employee.hire_date))
              FILTER (WHERE COALESCE(assignment.start_date, employee.hire_date) IS NOT NULL))::text AS average_tenure_days
          FROM ops.employee_assignment_history assignment
          INNER JOIN scoped_store ON scoped_store.store_id = assignment.store_id
          INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
          CROSS JOIN business_clock clock
          WHERE assignment.assignment_status = 'active'
            AND COALESCE(assignment.start_date, employee.hire_date) <= clock.business_today
            AND (assignment.end_date IS NULL OR assignment.end_date >= clock.business_today)
            AND employee.employment_status = 'active'
          GROUP BY assignment.store_id
        ),
        norm_plan AS (
          SELECT plan.store_id, SUM(plan.planned_headcount)::text AS planned_headcount
          FROM ops.workforce_norm_plan plan
          INNER JOIN scoped_store ON scoped_store.store_id = plan.store_id
          CROSS JOIN business_clock clock
          WHERE plan.period_start <= clock.business_today AND plan.period_end >= clock.business_today
          GROUP BY plan.store_id
        ),
        enriched_store AS (
          SELECT scoped_store.*, manager.display_name AS region_manager_name,
            norm_plan.planned_headcount,
            COALESCE(active_assignment.active_headcount, '0') AS active_headcount,
            active_assignment.average_tenure_days,
            NULL::text AS shortage_started_on,
            NULL::integer AS shortage_days,
            CASE
              WHEN norm_plan.planned_headcount IS NULL THEN 'unconfigured'
              WHEN norm_plan.planned_headcount::numeric > COALESCE(active_assignment.active_headcount, '0')::numeric THEN 'shortage'
              WHEN norm_plan.planned_headcount::numeric < COALESCE(active_assignment.active_headcount, '0')::numeric THEN 'surplus'
              ELSE 'balanced'
            END AS staffing_status
          FROM scoped_store
          LEFT JOIN active_assignment ON active_assignment.store_id = scoped_store.store_id
          LEFT JOIN norm_plan ON norm_plan.store_id = scoped_store.store_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''), account.username, account.email, account.user_id::text) AS display_name
            FROM ops.user_role_assignment role_assignment
            INNER JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
            INNER JOIN ops.user_account account ON account.user_id = role_assignment.user_id AND account.is_active = TRUE
            INNER JOIN ops.user_action_store_assignment manager_store ON manager_store.user_id = account.user_id
              AND manager_store.store_id = scoped_store.store_id
              AND manager_store.start_at <= NOW()
              AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
            LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
            WHERE role_assignment.start_at <= NOW()
              AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= NOW())
            ORDER BY display_name ASC NULLS LAST, role_assignment.start_at DESC
            LIMIT 1
          ) manager ON TRUE
        ),
        filtered_store AS (
          SELECT * FROM enriched_store
          WHERE ($${queryIndex}::text = '' OR CONCAT_WS(' ', store_name, store_code, region_name, region_manager_name) ILIKE '%' || $${queryIndex}::text || '%')
            AND ($${statusIndex}::text = 'all' OR staffing_status = $${statusIndex}::text)
        ),
        page AS (
          SELECT company_id, company_name, region_id, region_name, region_manager_name,
            store_id, store_code, store_name, store_status, planned_headcount,
            active_headcount, average_tenure_days, shortage_started_on, shortage_days,
            ROW_NUMBER() OVER (ORDER BY ${order}, store_id ASC) AS row_order
          FROM filtered_store
          ORDER BY ${order}, store_id ASC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}
        )
        SELECT COALESCE(jsonb_agg(to_jsonb(page) - 'row_order' ORDER BY page.row_order), '[]'::jsonb) AS items,
          (SELECT COUNT(*)::text FROM filtered_store) AS total_count
        FROM page
      `,
      [...scoped.params, input.query.trim(), input.status, input.limit, input.offset],
    );
    return {
      items: result.rows[0]?.items ?? [],
      total: Number(result.rows[0]?.total_count ?? 0),
      limit: input.limit,
      offset: input.offset,
    };
  }

  async summarizeScope(input: { scope: AuthReadScope; regionManagerUserId?: string }) {
    const scoped = scopeClause(input.scope, "store", input.regionManagerUserId);
    const result = await this.databaseService.query<{
      total_stores: string; active_personnel: string; shortage_stores: string;
      turnover_rate: string | null; open_positions: string; average_tenure_days: string | null;
    }>(
      `
        WITH business_clock AS (
          SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date AS business_today
        ),
        scoped_store AS (SELECT store.store_id FROM ops.store store WHERE ${scoped.sql}),
        active_assignment AS (
          SELECT assignment.store_id, COUNT(*)::numeric AS active_count,
            AVG(clock.business_today - COALESCE(assignment.start_date, employee.hire_date))
              FILTER (WHERE COALESCE(assignment.start_date, employee.hire_date) IS NOT NULL) AS average_tenure_days
          FROM ops.employee_assignment_history assignment
          INNER JOIN scoped_store ON scoped_store.store_id = assignment.store_id
          INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
          CROSS JOIN business_clock clock
          WHERE assignment.assignment_status = 'active'
            AND COALESCE(assignment.start_date, employee.hire_date) <= clock.business_today
            AND (assignment.end_date IS NULL OR assignment.end_date >= clock.business_today)
            AND employee.employment_status = 'active'
          GROUP BY assignment.store_id
        ),
        turnover_counts AS (
          SELECT
            (SELECT COUNT(DISTINCT assignment.employee_id) FROM ops.employee_assignment_history assignment
              JOIN scoped_store USING (store_id) CROSS JOIN business_clock clock
              WHERE assignment.start_date <= DATE_TRUNC('year', clock.business_today)::date
                AND (assignment.end_date IS NULL OR assignment.end_date >= DATE_TRUNC('year', clock.business_today)::date)) AS opening,
            (SELECT COUNT(DISTINCT assignment.employee_id) FROM ops.employee_assignment_history assignment
              JOIN scoped_store USING (store_id) CROSS JOIN business_clock clock
              WHERE assignment.assignment_status = 'active' AND assignment.start_date <= clock.business_today
                AND (assignment.end_date IS NULL OR assignment.end_date >= clock.business_today)) AS closing,
            (SELECT COUNT(*) FROM ops.turnover_event event JOIN scoped_store USING (store_id) CROSS JOIN business_clock clock
              WHERE event.event_type = 'termination' AND event.event_date BETWEEN DATE_TRUNC('year', clock.business_today)::date AND clock.business_today) AS leavers
        ),
        norm_plan AS (
          SELECT plan.store_id, SUM(plan.planned_headcount)::numeric AS planned_count
          FROM ops.workforce_norm_plan plan
          INNER JOIN scoped_store ON scoped_store.store_id = plan.store_id
          CROSS JOIN business_clock clock
          WHERE plan.period_start <= clock.business_today AND plan.period_end >= clock.business_today
          GROUP BY plan.store_id
        )
        SELECT COUNT(*)::text AS total_stores,
          COALESCE(SUM(active_assignment.active_count), 0)::text AS active_personnel,
          COUNT(*) FILTER (WHERE norm_plan.planned_count IS NOT NULL AND norm_plan.planned_count > COALESCE(active_assignment.active_count, 0))::text AS shortage_stores,
          COALESCE(SUM(GREATEST(norm_plan.planned_count - COALESCE(active_assignment.active_count, 0), 0)), 0)::text AS open_positions,
          CASE WHEN SUM(active_assignment.active_count) > 0
            THEN (SUM(active_assignment.average_tenure_days * active_assignment.active_count) / SUM(active_assignment.active_count))::text
            ELSE NULL END AS average_tenure_days,
          (SELECT ROUND(100.0 * leavers / NULLIF((opening + closing) / 2.0, 0), 1)::text FROM turnover_counts) AS turnover_rate
        FROM scoped_store
        LEFT JOIN active_assignment ON active_assignment.store_id = scoped_store.store_id
        LEFT JOIN norm_plan ON norm_plan.store_id = scoped_store.store_id
      `,
      scoped.params,
    );
    return result.rows[0] ?? { total_stores: "0", active_personnel: "0", shortage_stores: "0", open_positions: "0", average_tenure_days: null, turnover_rate: null };
  }

  async listActivePersonnel(input: { scope: AuthReadScope; storeId: string; limit: number; offset: number }) {
    const scoped = scopeClause(input.scope, "store");
    const storeIndex = scoped.params.length + 1;
    const limitIndex = storeIndex + 1;
    const offsetIndex = limitIndex + 1;
    const result = await this.databaseService.query<{ items: WorkforceWorkspacePersonRow[]; total_count: string }>(
      `
        WITH business_clock AS (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date AS business_today),
        scoped_store AS (SELECT store.store_id FROM ops.store store WHERE ${scoped.sql} AND store.store_id = $${storeIndex}::uuid),
        active_personnel AS (
          SELECT assignment.store_id, employee.employee_id,
            NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name,
            position.position_id, position.position_code, position.position_name,
            COALESCE(assignment.start_date, employee.hire_date)::text AS assignment_start_date,
            employee.employment_status
          FROM ops.employee_assignment_history assignment
          INNER JOIN scoped_store ON scoped_store.store_id = assignment.store_id
          INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
          INNER JOIN ops.position position ON position.position_id = assignment.position_id
          CROSS JOIN business_clock clock
          WHERE assignment.assignment_status = 'active'
            AND COALESCE(assignment.start_date, employee.hire_date) <= clock.business_today
            AND (assignment.end_date IS NULL OR assignment.end_date >= clock.business_today)
            AND employee.employment_status = 'active'
        ),
        page AS (
          SELECT * FROM active_personnel ORDER BY display_name ASC NULLS LAST, employee_id ASC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}
        )
        SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.display_name ASC NULLS LAST, page.employee_id ASC), '[]'::jsonb) AS items,
          (SELECT COUNT(*)::text FROM active_personnel) AS total_count
        FROM page
      `,
      [...scoped.params, input.storeId, input.limit, input.offset],
    );
    return { items: result.rows[0]?.items ?? [], total: Number(result.rows[0]?.total_count ?? 0) };
  }

  async listHistory(input: { scope: AuthReadScope; storeId: string; limit: number; offset: number }) {
    const scoped = scopeClause(input.scope, "store");
    const storeIndex = scoped.params.length + 1;
    const limitIndex = storeIndex + 1;
    const offsetIndex = limitIndex + 1;
    const result = await this.databaseService.query<{ items: WorkforceWorkspaceHistoryRow[]; total_count: string }>(
      `
        WITH business_clock AS (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date AS business_today),
        scoped_store AS (SELECT store.store_id FROM ops.store store WHERE ${scoped.sql} AND store.store_id = $${storeIndex}::uuid),
        intervals AS (
          SELECT assignment.employee_id, assignment.assignment_id, position.position_name,
            COALESCE(assignment.start_date, employee.hire_date)::date AS entry_date,
            assignment.end_date::date AS exit_date,
            NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name
          FROM ops.employee_assignment_history assignment
          INNER JOIN scoped_store ON scoped_store.store_id = assignment.store_id
          INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
          LEFT JOIN ops.position position ON position.position_id = assignment.position_id AND position.company_id = employee.company_id
          WHERE COALESCE(assignment.start_date, employee.hire_date) IS NOT NULL
        ),
        with_prior_end AS (
          SELECT intervals.*,
            MAX(COALESCE(exit_date, 'infinity'::date)) OVER (
              PARTITION BY employee_id ORDER BY entry_date, COALESCE(exit_date, 'infinity'::date)
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS prior_end
          FROM intervals
        ),
        marked AS (
          SELECT *, CASE WHEN prior_end IS NULL OR entry_date > prior_end + 1 THEN 1 ELSE 0 END AS new_period
          FROM with_prior_end
        ),
        grouped AS (
          SELECT *, SUM(new_period) OVER (PARTITION BY employee_id ORDER BY entry_date, COALESCE(exit_date, 'infinity'::date)) AS period_id
          FROM marked
        ),
        presence_periods AS (
          SELECT employee_id, MAX(display_name) AS display_name,
            (ARRAY_AGG(position_name ORDER BY entry_date DESC, exit_date DESC NULLS FIRST, assignment_id))[1] AS position_name, MIN(entry_date)::text AS entry_date,
            CASE WHEN BOOL_OR(exit_date IS NULL) THEN NULL ELSE MAX(exit_date)::text END AS exit_date,
            CASE WHEN MIN(entry_date) IS NULL THEN NULL
              ELSE COALESCE(MAX(exit_date), clock.business_today) - MIN(entry_date) END AS total_working_days
          FROM grouped CROSS JOIN business_clock clock
          GROUP BY employee_id, period_id, clock.business_today
        ),
        ordered AS (
          SELECT * FROM presence_periods
          ORDER BY COALESCE(exit_date::date, 'infinity'::date) DESC, entry_date::date DESC, employee_id ASC
          LIMIT $${limitIndex} OFFSET $${offsetIndex}
        )
        SELECT COALESCE(jsonb_agg(to_jsonb(ordered) ORDER BY COALESCE(ordered.exit_date::date, 'infinity'::date) DESC, ordered.entry_date::date DESC, ordered.employee_id ASC), '[]'::jsonb) AS items,
          (SELECT COUNT(*)::text FROM presence_periods) AS total_count
        FROM ordered
      `,
      [...scoped.params, input.storeId, input.limit, input.offset],
    );
    return { items: result.rows[0]?.items ?? [], total: Number(result.rows[0]?.total_count ?? 0), limit: input.limit, offset: input.offset };
  }
}

function scopeClause(scope: AuthReadScope, alias: string, regionManagerUserId?: string) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (scope.companyIds.length > 0) { params.push(scope.companyIds); clauses.push(`${alias}.company_id = ANY($${params.length}::uuid[])`); }
  if (scope.regionIds.length > 0) { params.push(scope.regionIds); clauses.push(`${alias}.region_id = ANY($${params.length}::uuid[])`); }
  if (scope.storeIds.length > 0) { params.push(scope.storeIds); clauses.push(`${alias}.store_id = ANY($${params.length}::uuid[])`); }
  let sql = clauses.length > 0 ? `(${clauses.join(" OR ")})` : "FALSE";
  if (regionManagerUserId) {
    params.push(regionManagerUserId);
    sql += ` AND EXISTS (
      SELECT 1 FROM ops.user_action_store_assignment manager_store
      INNER JOIN ops.user_account manager_account ON manager_account.user_id = manager_store.user_id AND manager_account.is_active = TRUE
      WHERE manager_store.store_id = ${alias}.store_id
        AND manager_store.user_id = $${params.length}::uuid
        AND manager_store.start_at <= NOW()
        AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
        AND EXISTS (
          SELECT 1 FROM ops.user_role_assignment manager_role
          INNER JOIN ops.role role ON role.role_id = manager_role.role_id AND role.role_code = 'REGION_MANAGER'
          WHERE manager_role.user_id = manager_store.user_id
            AND manager_role.start_at <= NOW()
            AND (manager_role.end_at IS NULL OR manager_role.end_at >= NOW())
        )
    )`;
  }
  return { sql, params };
}

function storeOrder(sort: WorkforceStoreSort, direction: WorkforceSortDirection) {
  const column = {
    store: "store_name", active: "active_headcount::numeric", norm: "planned_headcount::numeric",
    status: "staffing_status", shortage: "CASE WHEN staffing_status = 'shortage' THEN 0 ELSE 1 END",
    tenure: "average_tenure_days::numeric",
  }[sort];
  return `${column} ${direction === "ascending" ? "ASC" : "DESC"} NULLS LAST, store_name ASC`;
}
