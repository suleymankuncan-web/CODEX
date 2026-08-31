import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  ChecklistCommandRegionMetrics,
  ChecklistCommandRegionReadResult,
  ChecklistCommandRegionSort,
  ChecklistCommandReadResult,
  ChecklistCommandSignal,
  ChecklistCommandSort,
  ChecklistCommandStatus,
} from "../application/checklist-command-read.contract";
import type { ChecklistCommandReadScope } from "../application/checklist-command-read-scope";

type ChecklistCommandListInput = Omit<ChecklistCommandReadScope, "view"> & {
  period?: string;
  managerUserId?: string;
  regionId?: string;
  query?: string;
  status: ChecklistCommandStatus;
  signal?: ChecklistCommandSignal;
  sort: ChecklistCommandSort;
  limit: number;
  offset: number;
};

type ChecklistCommandRegionListInput = {
  companyIds: string[];
  period?: string;
  query?: string;
  signal: ChecklistCommandSignal;
  sort: ChecklistCommandRegionSort;
  limit: number;
  offset: number;
};

type ChecklistCommandQueryRow = {
  period_key: string;
  total_count: number;
  metrics_json: ChecklistCommandReadResult["metrics"];
  items_json: ChecklistCommandReadResult["items"];
};

type ChecklistCommandRegionQueryRow = {
  period_key: string;
  total_count: number;
  metrics_json: ChecklistCommandRegionMetrics;
  items_json: ChecklistCommandRegionReadResult["items"];
};

const sortSql: Record<ChecklistCommandSort, string> = {
  store_asc: "store_name ASC, store_id ASC",
  store_desc: "store_name DESC, store_id ASC",
  bm_score_asc: "bm_score ASC NULLS LAST, store_name ASC, store_id ASC",
  bm_score_desc: "bm_score DESC NULLS LAST, store_name ASC, store_id ASC",
  vm_score_desc: "vm_score DESC NULLS LAST, store_name ASC, store_id ASC",
  last_visit_asc: "last_completed_visit_at ASC NULLS FIRST, store_name ASC, store_id ASC",
  last_visit_desc: "last_completed_visit_at DESC NULLS LAST, store_name ASC, store_id ASC",
  elapsed_asc: "elapsed_days_since_last_visit ASC NULLS FIRST, store_name ASC, store_id ASC",
  elapsed_desc: "elapsed_days_since_last_visit DESC NULLS LAST, store_name ASC, store_id ASC",
  open_actions_desc: "open_action_count DESC, store_name ASC, store_id ASC",
  status_asc: "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END ASC, store_name ASC, store_id ASC",
  status_desc: "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END DESC, store_name ASC, store_id ASC",
};

const regionSortSql: Record<ChecklistCommandRegionSort, string> = {
  manager_asc: "manager_sort ASC, manager_user_id ASC",
  manager_desc: "manager_sort DESC, manager_user_id ASC",
  stores_desc: "total_stores DESC, manager_sort ASC, manager_user_id ASC",
  missing_desc: "missing_visit_stores DESC, manager_sort ASC, manager_user_id ASC",
  open_actions_desc: "open_action_count DESC, manager_sort ASC, manager_user_id ASC",
  score_desc: "visit_average_score DESC NULLS LAST, manager_sort ASC, manager_user_id ASC",
};

@Injectable()
export class ChecklistCommandReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(input: ChecklistCommandListInput) {
    const orderBy = sortSql[input.sort];
    const result = await this.databaseService.query<ChecklistCommandQueryRow>(
      `
        WITH period_bounds AS (
          SELECT
            COALESCE(
              to_date($5::text, 'YYYY-MM'),
              date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
            ) AS period_start
        ),
        scoped_stores AS (
          SELECT
            s.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name
          FROM ops.store s
          INNER JOIN ops.company company ON company.company_id = s.company_id
          INNER JOIN ops.region r
            ON r.region_id = s.region_id
           AND r.company_id = s.company_id
          WHERE company.status = 'active'
            AND r.status = 'active'
            AND s.status = 'active'
            AND (
              (cardinality($1::uuid[]) > 0 AND s.company_id = ANY($1::uuid[]))
              OR (cardinality($2::uuid[]) > 0 AND s.region_id = ANY($2::uuid[]))
              OR (cardinality($3::uuid[]) > 0 AND s.store_id = ANY($3::uuid[]))
            )
            AND ($6::uuid IS NULL OR s.region_id = $6::uuid)
            AND (
              $13::uuid IS NULL
              OR EXISTS (
                SELECT 1
                FROM ops.user_action_store_assignment manager_store
                INNER JOIN ops.user_role_assignment manager_role
                  ON manager_role.user_id = manager_store.user_id
                 AND manager_role.start_at <= NOW()
                 AND (manager_role.end_at IS NULL OR manager_role.end_at > NOW())
                 AND (manager_role.company_id IS NULL OR manager_role.company_id = s.company_id)
                INNER JOIN ops.role manager_role_definition
                  ON manager_role_definition.role_id = manager_role.role_id
                 AND manager_role_definition.role_code = 'REGION_MANAGER'
                INNER JOIN ops.user_account manager_account
                  ON manager_account.user_id = manager_store.user_id
                 AND manager_account.is_active = TRUE
                WHERE manager_store.user_id = $13::uuid
                  AND manager_store.store_id = s.store_id
                  AND manager_store.start_at <= NOW()
                  AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
              )
            )
            AND (
              $7::text IS NULL
              OR s.store_name ILIKE '%' || $7::text || '%'
              OR s.store_code ILIKE '%' || $7::text || '%'
              OR r.region_name ILIKE '%' || $7::text || '%'
            )
        ),
        period_completed_ranked AS (
          SELECT
            ci.store_id,
            ct.template_type,
            ci.completed_at,
            ci.total_score,
            ROW_NUMBER() OVER (
              PARTITION BY ci.store_id, ct.template_type
              ORDER BY ci.completed_at DESC, ci.checklist_instance_id DESC
            ) AS completed_rank
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          CROSS JOIN period_bounds pb
          WHERE ci.status = 'completed'
            AND ci.completed_at IS NOT NULL
            AND ct.template_type = ANY($4::text[])
            AND ci.completed_at >= (pb.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
            AND ci.completed_at < ((pb.period_start + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul')
        ),
        period_completed AS (
          SELECT
            store_id,
            MAX(total_score) FILTER (WHERE template_type = 'BM_STORE_VISIT')::numeric AS bm_score,
            MAX(total_score) FILTER (WHERE template_type = 'VM_STORE_VISIT')::numeric AS vm_score,
            MAX(completed_at) FILTER (WHERE template_type = 'BM_STORE_VISIT') AS bm_completed_at,
            MAX(completed_at) FILTER (WHERE template_type = 'VM_STORE_VISIT') AS vm_completed_at,
            COUNT(*)::int AS completed_type_count,
            COUNT(*) FILTER (WHERE template_type = ANY($12::text[]))::int AS execution_completed_type_count
          FROM period_completed_ranked
          WHERE completed_rank = 1
          GROUP BY store_id
        ),
        latest_completed AS (
          SELECT
            ci.store_id,
            MAX(ci.completed_at) AS last_completed_visit_at
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          WHERE ci.status = 'completed'
            AND ci.completed_at IS NOT NULL
            AND ct.template_type = ANY($4::text[])
          GROUP BY ci.store_id
        ),
        active_checklists AS (
          SELECT
            ci.store_id,
            COUNT(*)::int AS active_checklist_count,
            COUNT(*) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::int AS active_bm_checklist_count,
            COUNT(*) FILTER (WHERE ct.template_type = 'VM_STORE_VISIT')::int AS active_vm_checklist_count,
            COUNT(*) FILTER (WHERE ct.template_type = ANY($12::text[]))::int AS execution_active_checklist_count,
            MAX(COALESCE(ci.started_at, ci.created_at)) AS last_active_at
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          WHERE ci.status IN ('planned', 'in_progress')
            AND ct.template_type = ANY($4::text[])
          GROUP BY ci.store_id
        ),
        pending_acknowledgements AS (
          SELECT
            ci.store_id,
            COUNT(*)::int AS pending_acknowledgement_count
            ,COUNT(*) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::int AS pending_bm_acknowledgement_count
            ,COUNT(*) FILTER (WHERE ct.template_type = 'VM_STORE_VISIT')::int AS pending_vm_acknowledgement_count
            ,COUNT(*) FILTER (WHERE ct.template_type = ANY($12::text[]))::int AS execution_pending_acknowledgement_count
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          LEFT JOIN ops.checklist_acknowledgement ca
            ON ca.checklist_instance_id = ci.checklist_instance_id
          CROSS JOIN period_bounds pb
          WHERE ci.status = 'completed'
            AND ci.completed_at IS NOT NULL
            AND ca.checklist_acknowledgement_id IS NULL
            AND ct.template_type = ANY($4::text[])
            AND ci.completed_at >= (pb.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
            AND ci.completed_at < ((pb.period_start + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul')
          GROUP BY ci.store_id
        ),
        action_stats AS (
          SELECT
            sap.store_id,
            COUNT(*) FILTER (WHERE sap.status IN ('open', 'in_progress', 'blocked'))::int AS open_action_count,
            COUNT(*) FILTER (WHERE sap.status = 'blocked')::int AS blocked_action_count,
            MAX(sap.updated_at) FILTER (WHERE sap.status IN ('open', 'in_progress', 'blocked')) AS last_action_at
          FROM ops.store_action_plan sap
          INNER JOIN scoped_stores ss ON ss.store_id = sap.store_id
          GROUP BY sap.store_id
        ),
        region_managers AS (
          SELECT
            manager_store.store_id,
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'displayName',
                COALESCE(
                  NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
                  NULLIF(TRIM(ua.username), ''),
                  'Bilinmiyor'
                )
              )
            ) AS managers
          FROM ops.user_action_store_assignment manager_store
          INNER JOIN ops.user_role_assignment ura
            ON ura.user_id = manager_store.user_id
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id AND ua.is_active = TRUE
          LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
          INNER JOIN scoped_stores ss ON ss.store_id = manager_store.store_id
          WHERE manager_store.start_at <= NOW()
            AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
            AND (ura.company_id IS NULL OR ura.company_id = ss.company_id)
          GROUP BY manager_store.store_id
        ),
        command_base AS (
          SELECT
            ss.store_id,
            ss.store_code,
            ss.store_name,
            ss.region_id,
            ss.region_name,
            COALESCE(rm.managers, '[]'::jsonb) AS region_managers,
            pc.bm_score,
            pc.vm_score,
            pc.bm_completed_at,
            pc.vm_completed_at,
            COALESCE(pc.completed_type_count, 0)::int AS completed_type_count,
            COALESCE(pc.execution_completed_type_count, 0)::int AS execution_completed_type_count,
            lc.last_completed_visit_at,
            CASE
              WHEN lc.last_completed_visit_at IS NULL THEN NULL
              ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
                - (lc.last_completed_visit_at AT TIME ZONE 'Europe/Istanbul')::date
            END AS elapsed_days_since_last_visit,
            COALESCE(ac.active_checklist_count, 0) AS active_checklist_count,
            COALESCE(ac.active_bm_checklist_count, 0) AS active_bm_checklist_count,
            COALESCE(ac.active_vm_checklist_count, 0) AS active_vm_checklist_count,
            COALESCE(ac.execution_active_checklist_count, 0) AS execution_active_checklist_count,
            COALESCE(pa.pending_acknowledgement_count, 0) AS pending_acknowledgement_count,
            COALESCE(pa.pending_bm_acknowledgement_count, 0) AS pending_bm_acknowledgement_count,
            COALESCE(pa.pending_vm_acknowledgement_count, 0) AS pending_vm_acknowledgement_count,
            COALESCE(pa.execution_pending_acknowledgement_count, 0) AS execution_pending_acknowledgement_count,
            COALESCE(ast.open_action_count, 0) AS open_action_count,
            COALESCE(ast.blocked_action_count, 0) AS blocked_action_count,
            GREATEST(lc.last_completed_visit_at, ac.last_active_at, ast.last_action_at) AS last_operational_at,
            CASE
              WHEN COALESCE(pa.execution_pending_acknowledgement_count, 0) > 0 THEN 'pending'
              WHEN COALESCE(ac.execution_active_checklist_count, 0) > 0 THEN 'active'
              WHEN COALESCE(pc.execution_completed_type_count, 0) >= cardinality($12::text[]) THEN 'completed'
              ELSE 'needs_visit'
            END AS command_status
          FROM scoped_stores ss
          LEFT JOIN period_completed pc ON pc.store_id = ss.store_id
          LEFT JOIN latest_completed lc ON lc.store_id = ss.store_id
          LEFT JOIN active_checklists ac ON ac.store_id = ss.store_id
          LEFT JOIN pending_acknowledgements pa ON pa.store_id = ss.store_id
          LEFT JOIN action_stats ast ON ast.store_id = ss.store_id
          LEFT JOIN region_managers rm ON rm.store_id = ss.store_id
        ),
        filtered_command AS (
          SELECT *
          FROM command_base
          WHERE ($8::text = 'all' OR command_status = $8::text)
            AND (
              $11::text = 'all'
              OR ($11::text = 'missing_visit' AND execution_completed_type_count < cardinality($12::text[]))
              OR ($11::text = 'open_actions' AND open_action_count > 0)
              OR ($11::text = 'completed_coverage' AND execution_completed_type_count >= cardinality($12::text[]))
            )
        ),
        paged_command AS (
          SELECT
            filtered_command.*,
            ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS sort_rank
          FROM filtered_command
          ORDER BY ${orderBy}
          LIMIT $9 OFFSET $10
        )
        SELECT
          to_char(pb.period_start, 'YYYY-MM') AS period_key,
          (SELECT COUNT(*)::int FROM filtered_command) AS total_count,
          jsonb_build_object(
            'totalStores', (SELECT COUNT(*)::int FROM command_base),
            'needsVisit', (SELECT COUNT(*)::int FROM command_base WHERE execution_completed_type_count < cardinality($12::text[])),
            'active', (SELECT COUNT(*)::int FROM command_base WHERE execution_active_checklist_count > 0),
            'pending', (SELECT COUNT(*)::int FROM command_base WHERE execution_pending_acknowledgement_count > 0),
            'completed', (SELECT COUNT(*)::int FROM command_base WHERE execution_completed_type_count >= cardinality($12::text[]))
          ) AS metrics_json,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'storeId', pc.store_id,
                  'storeCode', pc.store_code,
                  'storeName', pc.store_name,
                  'regionId', pc.region_id,
                  'regionName', pc.region_name,
                  'regionManagers', pc.region_managers,
                  'bmScore', pc.bm_score,
                  'vmScore', pc.vm_score,
                  'bmCompletedAt', pc.bm_completed_at,
                  'vmCompletedAt', pc.vm_completed_at,
                  'lastCompletedVisitAt', pc.last_completed_visit_at,
                  'elapsedDaysSinceLastVisit', pc.elapsed_days_since_last_visit,
                  'activeChecklistCount', pc.active_checklist_count,
                  'activeBmChecklistCount', pc.active_bm_checklist_count,
                  'activeVmChecklistCount', pc.active_vm_checklist_count,
                  'pendingAcknowledgementCount', pc.pending_acknowledgement_count,
                  'pendingBmAcknowledgementCount', pc.pending_bm_acknowledgement_count,
                  'pendingVmAcknowledgementCount', pc.pending_vm_acknowledgement_count,
                  'openActionCount', pc.open_action_count,
                  'blockedActionCount', pc.blocked_action_count,
                  'status', pc.command_status,
                  'reasonCodes', array_remove(ARRAY[
                    CASE WHEN pc.command_status = 'active' THEN 'active_checklist' END,
                    CASE WHEN pc.command_status = 'pending' THEN 'pending_acknowledgement' END,
                    CASE WHEN pc.bm_completed_at IS NULL AND 'BM_STORE_VISIT' = ANY($4::text[]) THEN 'missing_bm_visit' END,
                    CASE WHEN pc.vm_completed_at IS NULL AND 'VM_STORE_VISIT' = ANY($4::text[]) THEN 'missing_vm_visit' END,
                    CASE WHEN pc.open_action_count > 0 THEN 'open_actions' END,
                    CASE WHEN pc.command_status = 'completed' THEN 'completed_period' END
                  ], NULL),
                  'lastOperationalAt', pc.last_operational_at
                )
                ORDER BY pc.sort_rank
              )
              FROM paged_command pc
            ),
            '[]'::jsonb
          ) AS items_json
        FROM period_bounds pb
      `,
      [
        input.companyIds,
        input.regionIds,
        input.storeIds,
        input.allowedTemplateTypes,
        input.period ?? null,
        input.regionId ?? null,
        input.query?.trim() || null,
        input.status,
        input.limit,
        input.offset,
        input.signal ?? "all",
        input.executionTemplateTypes,
        input.managerUserId ?? null,
      ],
    );

    const row = result.rows[0];
    return {
      period: row?.period_key ?? input.period ?? "",
      metrics: row?.metrics_json ?? emptyMetrics(),
      items: row?.items_json ?? [],
      total: Number(row?.total_count ?? 0),
    };
  }

  async listRegions(input: ChecklistCommandRegionListInput) {
    const orderBy = regionSortSql[input.sort];
    const result = await this.databaseService.query<ChecklistCommandRegionQueryRow>(
      `
        WITH period_bounds AS (
          SELECT COALESCE(
            to_date($2::text, 'YYYY-MM'),
            date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
          ) AS period_start
        ),
        scoped_stores AS (
          SELECT s.store_id, s.company_id, s.region_id, r.region_name
          FROM ops.store s
          INNER JOIN ops.company company ON company.company_id = s.company_id
          INNER JOIN ops.region r
            ON r.region_id = s.region_id
           AND r.company_id = s.company_id
          WHERE company.status = 'active'
            AND r.status = 'active'
            AND s.status = 'active'
            AND cardinality($1::uuid[]) > 0
            AND s.company_id = ANY($1::uuid[])
        ),
        period_completed_ranked AS (
          SELECT
            ci.store_id,
            ct.template_type,
            ci.total_score,
            ci.completed_at,
            ROW_NUMBER() OVER (
              PARTITION BY ci.store_id, ct.template_type
              ORDER BY ci.completed_at DESC, ci.checklist_instance_id DESC
            ) AS completed_rank
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          CROSS JOIN period_bounds pb
          WHERE ci.status = 'completed'
            AND ci.completed_at IS NOT NULL
            AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
            AND ci.completed_at >= (pb.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
            AND ci.completed_at < ((pb.period_start + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul')
        ),
        period_completed AS (
          SELECT
            store_id,
            COUNT(*)::int AS completed_type_count,
            SUM(total_score)::numeric AS score_sum,
            COUNT(total_score)::int AS score_sample_count,
            MAX(completed_at) AS last_completed_at
          FROM period_completed_ranked
          WHERE completed_rank = 1
          GROUP BY store_id
        ),
        latest_completed AS (
          SELECT ci.store_id, MAX(ci.completed_at) AS last_completed_at
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          WHERE ci.status = 'completed'
            AND ci.completed_at IS NOT NULL
            AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
          GROUP BY ci.store_id
        ),
        active_checklists AS (
          SELECT ci.store_id, MAX(COALESCE(ci.started_at, ci.created_at)) AS last_active_at
          FROM ops.checklist_instance ci
          INNER JOIN scoped_stores ss ON ss.store_id = ci.store_id
          INNER JOIN ops.checklist_template ct
            ON ct.checklist_template_id = ci.checklist_template_id
          WHERE ci.status IN ('planned', 'in_progress')
            AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
          GROUP BY ci.store_id
        ),
        action_stats AS (
          SELECT
            sap.store_id,
            COUNT(*) FILTER (WHERE sap.status IN ('open', 'in_progress', 'blocked'))::int AS open_action_count,
            COUNT(*) FILTER (WHERE sap.status = 'blocked')::int AS blocked_action_count,
            MAX(sap.updated_at) FILTER (WHERE sap.status IN ('open', 'in_progress', 'blocked')) AS last_action_at
          FROM ops.store_action_plan sap
          INNER JOIN scoped_stores ss ON ss.store_id = sap.store_id
          GROUP BY sap.store_id
        ),
        store_signals AS (
          SELECT
            ss.company_id,
            ss.region_id,
            ss.region_name,
            ss.store_id,
            COALESCE(pc.completed_type_count, 0)::int AS completed_type_count,
            COALESCE(pc.score_sum, 0)::numeric AS score_sum,
            COALESCE(pc.score_sample_count, 0)::int AS score_sample_count,
            COALESCE(ast.open_action_count, 0)::int AS open_action_count,
            COALESCE(ast.blocked_action_count, 0)::int AS blocked_action_count,
            GREATEST(lc.last_completed_at, ac.last_active_at, ast.last_action_at) AS last_operational_at
          FROM scoped_stores ss
          LEFT JOIN period_completed pc ON pc.store_id = ss.store_id
          LEFT JOIN latest_completed lc ON lc.store_id = ss.store_id
          LEFT JOIN active_checklists ac ON ac.store_id = ss.store_id
          LEFT JOIN action_stats ast ON ast.store_id = ss.store_id
        ),
        manager_accounts AS (
          SELECT
            ura.user_id AS manager_user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
              NULLIF(TRIM(ua.username), ''),
              'Bilinmiyor'
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id AND ua.is_active = TRUE
          LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
          WHERE ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
            AND ura.company_id = ANY($1::uuid[])
          GROUP BY ura.user_id, display_name
        ),
        manager_store_scope AS (
          SELECT
            ma.manager_user_id,
            ma.display_name,
            ss.region_id,
            ss.region_name,
            ss.store_id
          FROM manager_accounts ma
          INNER JOIN ops.user_action_store_assignment manager_store
            ON manager_store.user_id = ma.manager_user_id
           AND manager_store.start_at <= NOW()
           AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
          INNER JOIN scoped_stores ss ON ss.store_id = manager_store.store_id
          GROUP BY ma.manager_user_id, ma.display_name, ss.region_id, ss.region_name, ss.store_id
        ),
        region_base AS (
          SELECT
            manager.manager_user_id,
            MIN(manager.region_id::text)::uuid AS region_id,
            MIN(manager.display_name) AS region_name,
            jsonb_build_array(jsonb_build_object('displayName', MIN(manager.display_name))) AS region_managers,
            MIN(manager.display_name) AS manager_sort,
            COUNT(signal.store_id)::int AS total_stores,
            COUNT(signal.store_id) FILTER (WHERE signal.completed_type_count < 2)::int AS missing_visit_stores,
            COUNT(signal.store_id) FILTER (WHERE signal.open_action_count > 0)::int AS stores_with_open_actions,
            COALESCE(SUM(signal.open_action_count), 0)::int AS open_action_count,
            COALESCE(SUM(signal.blocked_action_count), 0)::int AS blocked_action_count,
            COUNT(signal.store_id) FILTER (WHERE signal.completed_type_count >= 2)::int AS completed_coverage_stores,
            CASE
              WHEN SUM(signal.score_sample_count) = 0 THEN NULL
              ELSE ROUND(SUM(signal.score_sum) / SUM(signal.score_sample_count), 2)
            END AS visit_average_score,
            COALESCE(SUM(signal.score_sample_count), 0)::int AS score_sample_count,
            MAX(signal.last_operational_at) AS last_operational_at
          FROM manager_store_scope manager
          LEFT JOIN store_signals signal ON signal.store_id = manager.store_id
          GROUP BY manager.manager_user_id
        ),
        filtered_regions AS (
          SELECT *
          FROM region_base
          WHERE (
            $3::text = 'all'
            OR ($3::text = 'missing_visit' AND missing_visit_stores > 0)
            OR ($3::text = 'open_actions' AND open_action_count > 0)
            OR ($3::text = 'completed_coverage' AND completed_coverage_stores > 0)
          )
            AND (
              $6::text IS NULL
              OR manager_user_id::text ILIKE '%' || $6::text || '%' ESCAPE '\\'
              OR region_name ILIKE '%' || $6::text || '%' ESCAPE '\\'
            )
        ),
        paged_regions AS (
          SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS sort_rank
          FROM filtered_regions
          ORDER BY ${orderBy}
          LIMIT $4 OFFSET $5
        )
        SELECT
          to_char(pb.period_start, 'YYYY-MM') AS period_key,
          (SELECT COUNT(*)::int FROM filtered_regions) AS total_count,
          jsonb_build_object(
            'totalStores', COALESCE((SELECT SUM(total_stores)::int FROM region_base), 0),
            'missingVisitStores', COALESCE((SELECT SUM(missing_visit_stores)::int FROM region_base), 0),
            'storesWithOpenActions', COALESCE((SELECT SUM(stores_with_open_actions)::int FROM region_base), 0),
            'openActionCount', COALESCE((SELECT SUM(open_action_count)::int FROM region_base), 0),
            'completedCoverageStores', COALESCE((SELECT SUM(completed_coverage_stores)::int FROM region_base), 0)
          ) AS metrics_json,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'managerUserId', pr.manager_user_id,
                'regionId', pr.region_id,
                'regionName', pr.region_name,
                'regionManagers', pr.region_managers,
                'metrics', jsonb_build_object(
                  'totalStores', pr.total_stores,
                  'missingVisitStores', pr.missing_visit_stores,
                  'storesWithOpenActions', pr.stores_with_open_actions,
                  'openActionCount', pr.open_action_count,
                  'blockedActionCount', pr.blocked_action_count,
                  'completedCoverageStores', pr.completed_coverage_stores
                ),
                'visitAverageScore', pr.visit_average_score,
                'scoreSampleCount', pr.score_sample_count,
                'lastOperationalAt', pr.last_operational_at
              ) ORDER BY pr.sort_rank
            ) FROM paged_regions pr
          ), '[]'::jsonb) AS items_json
        FROM period_bounds pb
      `,
      [
        input.companyIds,
        input.period ?? null,
        input.signal,
        input.limit,
        input.offset,
        input.query?.trim() ? escapeLike(input.query.trim()) : null,
      ],
    );

    const row = result.rows[0];
    return {
      period: row?.period_key ?? input.period ?? "",
      metrics: row?.metrics_json ?? emptyRegionMetrics(),
      items: row?.items_json ?? [],
      total: Number(row?.total_count ?? 0),
    };
  }
}

function emptyMetrics(): ChecklistCommandReadResult["metrics"] {
  return {
    totalStores: 0,
    needsVisit: 0,
    active: 0,
    pending: 0,
    completed: 0,
  };
}

function emptyRegionMetrics(): ChecklistCommandRegionMetrics {
  return {
    totalStores: 0,
    missingVisitStores: 0,
    storesWithOpenActions: 0,
    openActionCount: 0,
    completedCoverageStores: 0,
  };
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
