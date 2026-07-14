import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  ChecklistCommandReadResult,
  ChecklistCommandSort,
  ChecklistCommandStatus,
} from "../application/checklist-command-read.contract";
import type { ChecklistCommandReadScope } from "../application/checklist-command-read-scope";

type ChecklistCommandListInput = Omit<ChecklistCommandReadScope, "view"> & {
  period?: string;
  regionId?: string;
  query?: string;
  status: ChecklistCommandStatus;
  sort: ChecklistCommandSort;
  limit: number;
  offset: number;
};

type ChecklistCommandQueryRow = {
  period_key: string;
  total_count: number;
  metrics_json: ChecklistCommandReadResult["metrics"];
  items_json: ChecklistCommandReadResult["items"];
};

const sortSql: Record<ChecklistCommandSort, string> = {
  store_asc: "store_name ASC, store_id ASC",
  store_desc: "store_name DESC, store_id ASC",
  bm_score_desc: "bm_score DESC NULLS LAST, store_name ASC, store_id ASC",
  vm_score_desc: "vm_score DESC NULLS LAST, store_name ASC, store_id ASC",
  last_visit_asc: "last_completed_visit_at ASC NULLS FIRST, store_name ASC, store_id ASC",
  last_visit_desc: "last_completed_visit_at DESC NULLS LAST, store_name ASC, store_id ASC",
  open_actions_desc: "open_action_count DESC, store_name ASC, store_id ASC",
  status_asc: "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END ASC, store_name ASC, store_id ASC",
  status_desc: "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END DESC, store_name ASC, store_id ASC",
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
          INNER JOIN ops.region r ON r.region_id = s.region_id
          WHERE s.status = 'active'
            AND (
              (cardinality($1::uuid[]) > 0 AND s.company_id = ANY($1::uuid[]))
              OR (cardinality($2::uuid[]) > 0 AND s.region_id = ANY($2::uuid[]))
              OR (cardinality($3::uuid[]) > 0 AND s.store_id = ANY($3::uuid[]))
            )
            AND ($6::uuid IS NULL OR s.region_id = $6::uuid)
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
            AND ci.total_score IS NOT NULL
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
            COUNT(*)::int AS completed_type_count
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
            ura.region_id,
            jsonb_agg(
              DISTINCT jsonb_build_object(
                'displayName',
                COALESCE(
                  NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
                  ua.username,
                  'Bilinmiyor'
                )
              )
            ) AS managers
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id AND ua.is_active = TRUE
          LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
          INNER JOIN (SELECT DISTINCT region_id FROM scoped_stores) sr
            ON sr.region_id = ura.region_id
          WHERE ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          GROUP BY ura.region_id
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
            lc.last_completed_visit_at,
            CASE
              WHEN lc.last_completed_visit_at IS NULL THEN NULL
              ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
                - (lc.last_completed_visit_at AT TIME ZONE 'Europe/Istanbul')::date
            END AS elapsed_days_since_last_visit,
            COALESCE(ac.active_checklist_count, 0) AS active_checklist_count,
            COALESCE(pa.pending_acknowledgement_count, 0) AS pending_acknowledgement_count,
            COALESCE(ast.open_action_count, 0) AS open_action_count,
            COALESCE(ast.blocked_action_count, 0) AS blocked_action_count,
            GREATEST(lc.last_completed_visit_at, ac.last_active_at, ast.last_action_at) AS last_operational_at,
            CASE
              WHEN COALESCE(ac.active_checklist_count, 0) > 0 THEN 'active'
              WHEN COALESCE(pa.pending_acknowledgement_count, 0) > 0 THEN 'pending'
              WHEN COALESCE(pc.completed_type_count, 0) >= cardinality($4::text[]) THEN 'completed'
              ELSE 'needs_visit'
            END AS command_status
          FROM scoped_stores ss
          LEFT JOIN period_completed pc ON pc.store_id = ss.store_id
          LEFT JOIN latest_completed lc ON lc.store_id = ss.store_id
          LEFT JOIN active_checklists ac ON ac.store_id = ss.store_id
          LEFT JOIN pending_acknowledgements pa ON pa.store_id = ss.store_id
          LEFT JOIN action_stats ast ON ast.store_id = ss.store_id
          LEFT JOIN region_managers rm ON rm.region_id = ss.region_id
        ),
        filtered_command AS (
          SELECT *
          FROM command_base
          WHERE $8::text = 'all' OR command_status = $8::text
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
            'needsVisit', (SELECT COUNT(*)::int FROM command_base WHERE command_status = 'needs_visit'),
            'active', (SELECT COUNT(*)::int FROM command_base WHERE command_status = 'active'),
            'pending', (SELECT COUNT(*)::int FROM command_base WHERE command_status = 'pending'),
            'completed', (SELECT COUNT(*)::int FROM command_base WHERE command_status = 'completed')
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
                  'pendingAcknowledgementCount', pc.pending_acknowledgement_count,
                  'openActionCount', pc.open_action_count,
                  'blockedActionCount', pc.blocked_action_count,
                  'status', pc.command_status,
                  'reasonCodes', array_remove(ARRAY[
                    CASE WHEN pc.command_status = 'active' THEN 'active_checklist' END,
                    CASE WHEN pc.command_status = 'pending' THEN 'pending_acknowledgement' END,
                    CASE WHEN pc.bm_score IS NULL AND 'BM_STORE_VISIT' = ANY($4::text[]) THEN 'missing_bm_visit' END,
                    CASE WHEN pc.vm_score IS NULL AND 'VM_STORE_VISIT' = ANY($4::text[]) THEN 'missing_vm_visit' END,
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
