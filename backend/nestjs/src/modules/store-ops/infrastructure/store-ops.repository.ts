import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class StoreOpsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStoresByScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    requestedCompanyId?: string;
    requestedRegionId?: string;
    requestedStoreId?: string;
  }) {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.requestedCompanyId) {
      params.push(input.requestedCompanyId);
      clauses.push(`s.company_id = $${params.length}`);
    }

    if (input.requestedRegionId) {
      params.push(input.requestedRegionId);
      clauses.push(`s.region_id = $${params.length}`);
    }

    if (input.requestedStoreId) {
      params.push(input.requestedStoreId);
      clauses.push(`s.store_id = $${params.length}`);
    }

    const whereClause = `WHERE ${clauses.join(" AND ")}`;

    const result = await this.databaseService.query<{
      store_id: string;
      store_code: string;
      store_name: string;
      region_id: string;
      company_id: string;
      status: string;
    }>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.region_id,
          s.company_id,
          s.status
        FROM ops.store s
        ${whereClause}
        ORDER BY s.store_name ASC
      `,
      params,
    );

    return result.rows;
  }

  async listStorePersonnelTargetingRows(input: { storeId: string }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      external_employee_ref: string | null;
      period_start: string | null;
      period_end: string | null;
      net_sales_value: string | null;
    }>(
      `
        WITH latest_period AS (
          SELECT
            ka.period_start,
            ka.period_end
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          WHERE ka.scope_type = 'employee'
            AND ka.store_id = $1::uuid
            AND ka.period_type = 'monthly'
            AND kd.kpi_code = 'NET_SALES'
          ORDER BY ka.period_start DESC, ka.period_end DESC
          LIMIT 1
        )
        SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          e.external_employee_ref,
          lp.period_start,
          lp.period_end,
          ka.actual_value::text AS net_sales_value
        FROM latest_period lp
        INNER JOIN ops.kpi_actual ka
          ON ka.scope_type = 'employee'
          AND ka.store_id = $1::uuid
          AND ka.period_type = 'monthly'
          AND ka.period_start = lp.period_start
          AND ka.period_end = lp.period_end
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
          AND kd.kpi_code = 'NET_SALES'
        INNER JOIN ops.employee e
          ON e.employee_id = ka.employee_id
        ORDER BY e.first_name ASC, e.last_name ASC, e.employee_id ASC
      `,
      [input.storeId],
    );

    return result.rows;
  }

  async getStoreHeadcountGap(input: {
    storeId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      store_id: string;
      planned_headcount: string;
      active_headcount: string;
      headcount_gap: string;
      planned_fte: string;
      active_fte: string;
      fte_gap: string;
      shortage_started_on: string | null;
      shortage_days: number | null;
    }>(
      `
        WITH as_of_date AS (
          SELECT LEAST($3::date, CURRENT_DATE)::date AS value
        ),
        active_assignments AS (
          SELECT
            eah.store_id,
            COUNT(*)::numeric(10,2) AS active_headcount,
            COALESCE(SUM(eah.fte_ratio), 0)::numeric(10,2) AS active_fte
          FROM ops.employee_assignment_history eah
          WHERE eah.store_id = $1
            AND eah.start_date <= $3::date
            AND (eah.end_date IS NULL OR eah.end_date >= $2::date)
            AND eah.assignment_status = 'active'
          GROUP BY eah.store_id
        ),
        norm_plan AS (
          SELECT
            wnp.store_id,
            COALESCE(SUM(wnp.planned_headcount), 0)::numeric(10,2) AS planned_headcount,
            COALESCE(SUM(wnp.planned_fte), 0)::numeric(10,2) AS planned_fte
          FROM ops.workforce_norm_plan wnp
          WHERE wnp.store_id = $1
            AND wnp.period_start <= $3::date
            AND wnp.period_end >= $2::date
          GROUP BY wnp.store_id
        ),
        shortage_source AS (
          SELECT
            source.store_id,
            MAX(source.shortage_started_on)::date AS shortage_started_on
          FROM (
            SELECT
              eah.store_id,
              eah.end_date::date AS shortage_started_on
            FROM ops.employee_assignment_history eah
            CROSS JOIN as_of_date asof
            WHERE eah.store_id = $1
              AND eah.end_date IS NOT NULL
              AND eah.end_date <= asof.value
            UNION ALL
            SELECT
              te.store_id,
              te.event_date::date AS shortage_started_on
            FROM ops.turnover_event te
            CROSS JOIN as_of_date asof
            WHERE te.store_id = $1
              AND te.event_date <= asof.value
          ) source
          GROUP BY source.store_id
        ),
        headcount_projection AS (
          SELECT
            COALESCE(np.store_id, aa.store_id) AS store_id,
            COALESCE(np.planned_headcount, 0) AS planned_headcount,
            COALESCE(aa.active_headcount, 0) AS active_headcount,
            COALESCE(np.planned_headcount, 0) - COALESCE(aa.active_headcount, 0) AS headcount_gap,
            COALESCE(np.planned_fte, 0) AS planned_fte,
            COALESCE(aa.active_fte, 0) AS active_fte,
            COALESCE(np.planned_fte, 0) - COALESCE(aa.active_fte, 0) AS fte_gap
          FROM norm_plan np
          FULL OUTER JOIN active_assignments aa
            ON aa.store_id = np.store_id
        )
        SELECT
          hp.store_id,
          hp.planned_headcount,
          hp.active_headcount,
          hp.headcount_gap,
          hp.planned_fte,
          hp.active_fte,
          hp.fte_gap,
          CASE
            WHEN hp.headcount_gap > 0 THEN ss.shortage_started_on
            ELSE NULL
          END AS shortage_started_on,
          CASE
            WHEN hp.headcount_gap > 0 AND ss.shortage_started_on IS NOT NULL
              THEN (SELECT value FROM as_of_date) - ss.shortage_started_on
            ELSE NULL
          END AS shortage_days
        FROM headcount_projection hp
        LEFT JOIN shortage_source ss
          ON ss.store_id = hp.store_id
      `,
      [input.storeId, input.periodStart, input.periodEnd],
    );

    return result.rows[0] ?? null;
  }

  async createChecklistInstance(input: {
    templateId: string;
    storeId: string;
    assignedEmployeeId?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        checklist_instance_id: string;
        status: string;
        created_at: string;
      }>(
        `
          INSERT INTO ops.checklist_instance (
            checklist_template_id,
            store_id,
            assigned_employee_id,
            status
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, 'planned')
          RETURNING checklist_instance_id, status, created_at
        `,
        [input.templateId, input.storeId, input.assignedEmployeeId ?? null],
      );

      const instance = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            store_id,
            metadata_json
          )
          VALUES ($1::uuid, 'checklist_instance.created', 'ops.checklist_instance', $2::uuid, 'store', $3::uuid, $4::jsonb)
        `,
        [
          input.actorUserId,
          instance.checklist_instance_id,
          input.storeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            templateId: input.templateId,
            assignedEmployeeId: input.assignedEmployeeId ?? null,
          }),
        ],
      );

      return instance;
    });
  }

  async addChecklistResponse(input: {
    checklistInstanceId: string;
    templateItemId: string;
    responseValue?: string;
    scoreValue?: number;
    isNonCompliant?: boolean;
    commentText?: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const responseResult = await client.query<{
        response_id: string;
        responded_at: string;
      }>(
        `
          INSERT INTO ops.checklist_response (
            checklist_instance_id,
            template_item_id,
            response_value,
            score_value,
            is_non_compliant,
            comment_text
          )
          VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
          ON CONFLICT (checklist_instance_id, template_item_id) DO UPDATE
          SET
            response_value = EXCLUDED.response_value,
            score_value = EXCLUDED.score_value,
            is_non_compliant = EXCLUDED.is_non_compliant,
            comment_text = EXCLUDED.comment_text,
            responded_at = NOW()
          RETURNING response_id, responded_at
        `,
        [
          input.checklistInstanceId,
          input.templateItemId,
          input.responseValue ?? null,
          input.scoreValue ?? null,
          input.isNonCompliant ?? false,
          input.commentText ?? null,
        ],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'checklist_response.upserted', 'ops.checklist_response', $2::uuid, 'store', $3::jsonb)
        `,
        [
          input.actorUserId,
          responseResult.rows[0].response_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            checklistInstanceId: input.checklistInstanceId,
            templateItemId: input.templateItemId,
          }),
        ],
      );

      return responseResult.rows[0];
    });
  }

  async completeChecklistInstance(input: {
    checklistInstanceId: string;
    auditorEmployeeId: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const aggregateResult = await client.query<{
        total_score: string;
        compliance_rate: string;
      }>(
        `
          SELECT
            COALESCE(SUM(COALESCE(cr.score_value, 0)), 0)::numeric(12,2) AS total_score,
            COALESCE(
              AVG(
                CASE
                  WHEN cr.is_non_compliant = TRUE THEN 0
                  ELSE 1
                END
              ),
              0
            )::numeric(7,4) AS compliance_rate
          FROM ops.checklist_response cr
          WHERE cr.checklist_instance_id = $1::uuid
        `,
        [input.checklistInstanceId],
      );

      const aggregates = aggregateResult.rows[0];

      const checklistResult = await client.query<{
        checklist_instance_id: string;
        status: string;
        total_score: string;
        compliance_rate: string;
      }>(
        `
          UPDATE ops.checklist_instance
          SET
            auditor_employee_id = $2::uuid,
            completed_at = NOW(),
            status = 'completed',
            total_score = $3::numeric,
            compliance_rate = $4::numeric
          WHERE checklist_instance_id = $1::uuid
          RETURNING checklist_instance_id, status, total_score, compliance_rate
        `,
        [
          input.checklistInstanceId,
          input.auditorEmployeeId,
          aggregates.total_score,
          aggregates.compliance_rate,
        ],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'checklist_instance.completed', 'ops.checklist_instance', $2::uuid, 'store', $3::jsonb)
        `,
        [
          input.actorUserId,
          input.checklistInstanceId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            auditorEmployeeId: input.auditorEmployeeId,
            totalScore: checklistResult.rows[0]?.total_score,
            complianceRate: checklistResult.rows[0]?.compliance_rate,
          }),
        ],
      );

      return checklistResult.rows[0];
    });
  }
}
