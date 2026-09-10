import type { DatabaseService } from "../../../shared/database/database.service";

export async function readRankingPersonnelRange(database: DatabaseService, input: {
  companyIds: string[]; metricCodes: string[]; periodStart: string; periodEnd: string;
}) {
  return (await database.query<{
    employee_id: string; first_name: string | null; last_name: string | null;
    store_id: string | null; store_name: string | null; region_id: string | null; region_name: string | null;
    region_manager_user_id: string | null; region_manager_name: string | null;
    position_code: string | null; net_sales_value: string | null; store_net_sales_value: string | null;
    kpi_code: string; kpi_name: string | null; actual_value: string | null; target_value: string | null;
  }>(`
    WITH components AS (
      SELECT ka.employee_id, ka.store_id, kd.kpi_code,
        CASE WHEN COUNT(DISTINCT ka.period_start) = $2::date - $1::date + 1
          THEN SUM(ka.actual_value) END AS value
      FROM ops.kpi_actual ka JOIN ops.kpi_definition kd USING (kpi_id)
      JOIN ops.store s ON s.store_id = ka.store_id
      WHERE ka.scope_type = 'employee' AND ka.period_type = 'daily'
        AND ka.period_start = ka.period_end AND ka.period_start BETWEEN $1::date AND $2::date
        AND kd.kpi_code IN ('NET_SALES','ITEM_COUNT','TICKET_COUNT','FF')
        AND COALESCE(ka.source_type,'') <> 'demo_seed' AND s.kpi_import_enabled = TRUE
        AND (cardinality($3::uuid[]) = 0 OR ka.company_id = ANY($3::uuid[]))
      GROUP BY ka.employee_id, ka.store_id, kd.kpi_code
    ), facts AS (
      SELECT employee_id, store_id,
        MAX(value) FILTER (WHERE kpi_code='NET_SALES') AS sales,
        MAX(value) FILTER (WHERE kpi_code='ITEM_COUNT') AS items,
        MAX(value) FILTER (WHERE kpi_code='TICKET_COUNT') AS tickets,
        MAX(value) FILTER (WHERE kpi_code='FF') AS footfall
      FROM components GROUP BY employee_id,store_id
    ), store_sales AS (
      SELECT store_id, SUM(sales) AS sales FROM facts GROUP BY store_id
    )
    SELECT e.employee_id::text, e.first_name, e.last_name,
      s.store_id::text, s.store_name, r.region_id::text, r.region_name,
      manager.user_id AS region_manager_user_id, manager.display_name AS region_manager_name,
      position.position_code, f.sales::text AS net_sales_value, store_sales.sales::text AS store_net_sales_value,
      kd.kpi_code, kd.kpi_name,
      CASE kd.kpi_code WHEN 'TARGET_ACHIEVEMENT' THEN f.sales WHEN 'NET_SALES' THEN f.sales
        WHEN 'ATV' THEN f.sales / NULLIF(f.tickets,0) WHEN 'UPT' THEN f.items / NULLIF(f.tickets,0)
        WHEN 'CR' THEN f.tickets / NULLIF(f.footfall,0) END::text AS actual_value,
      CASE WHEN kd.kpi_code IN ('TARGET_ACHIEVEMENT','NET_SALES') THEN target.value END::text AS target_value
    FROM facts f JOIN ops.employee e USING (employee_id) JOIN ops.store s ON s.store_id=f.store_id
    LEFT JOIN ops.region r ON r.region_id=s.region_id
    LEFT JOIN store_sales ON store_sales.store_id=s.store_id
    LEFT JOIN LATERAL (
      SELECT position_id FROM ops.employee_assignment_history a
      WHERE a.employee_id=e.employee_id AND a.assignment_status='active'
      ORDER BY a.is_primary_assignment DESC,a.start_date DESC LIMIT 1
    ) assignment ON TRUE
    LEFT JOIN ops.position position USING (position_id)
    LEFT JOIN LATERAL (
      SELECT CASE WHEN COUNT(*) = $2::date - $1::date + 1 AND COUNT(DISTINCT day) = COUNT(*)
        THEN SUM(ptr.target_value / (ptr.period_end-ptr.period_start+1)) END AS value
      FROM generate_series($1::date,$2::date,interval '1 day') day
      JOIN ops.personnel_target_reference ptr ON ptr.employee_id=e.employee_id AND ptr.store_id=s.store_id
        AND day::date BETWEEN ptr.period_start AND ptr.period_end
        AND ptr.target_type='monthly_sales_target' AND ptr.status='approved'
    ) target ON TRUE
    LEFT JOIN LATERAL (
      SELECT ua.user_id::text, COALESCE(NULLIF(TRIM(CONCAT(me.first_name,' ',me.last_name)),''),ua.username,ua.email,ua.user_id::text) AS display_name
      FROM ops.user_role_assignment ura JOIN ops.role role USING (role_id)
      JOIN ops.user_account ua USING (user_id) LEFT JOIN ops.employee me ON me.employee_id=ua.employee_id
      WHERE role.role_code='REGION_MANAGER' AND ura.region_id=s.region_id AND ua.is_active=TRUE
        AND ura.start_at<=NOW() AND (ura.end_at IS NULL OR ura.end_at>=NOW())
      ORDER BY ua.username,ua.user_id LIMIT 1
    ) manager ON TRUE
    CROSS JOIN ops.kpi_definition kd
    WHERE kd.kpi_code=ANY($4::text[])
    ORDER BY e.last_name,e.first_name,e.employee_id,kd.kpi_code
  `, [input.periodStart,input.periodEnd,input.companyIds,input.metricCodes])).rows;
}
