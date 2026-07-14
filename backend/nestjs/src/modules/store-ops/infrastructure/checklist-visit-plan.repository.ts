import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import { checklistVisitPlanScoreBands } from "../application/checklist-visit-plan.contract";
import type {
  ChecklistVisitPlanCandidate,
  ChecklistVisitPlanItem,
  ChecklistVisitPlanPeriodResult,
  ChecklistVisitPlanPeriodSort,
  ChecklistVisitPlanPeriodStatus,
  ChecklistVisitPlanRegionOption,
  ChecklistVisitPlanReason,
  ChecklistVisitPlanRisk,
  ChecklistVisitPlanResult,
  SaveChecklistVisitPlanItem,
} from "../application/checklist-visit-plan.contract";

type ReadInput = {
  regionId: string;
  weekStart: string;
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

type SaveInput = {
  regionId: string;
  weekStart: string;
  actorUserId: string;
  expectedRevision: number;
  idempotencyKey: string;
  requestSha256: string;
  items: SaveChecklistVisitPlanItem[];
};

type ListPeriodInput = {
  regionId: string;
  period: string;
  query: string | null;
  risk: ChecklistVisitPlanRisk | "all";
  reason: ChecklistVisitPlanReason | "all";
  planStatus: ChecklistVisitPlanPeriodStatus | "all";
  sort: ChecklistVisitPlanPeriodSort;
  limit: number;
  offset: number;
};

type ListCandidatesInput = {
  regionId: string;
  query: string | null;
  limit: number;
  offset: number;
};

type PlanRow = {
  plan_id: string | null;
  region_id: string;
  region_name: string;
  week_start_date: string;
  revision_no: number | null;
  created_at: string | null;
  items_json: ChecklistVisitPlanItem[];
};

type PeriodRow = {
  region_name: string;
  metrics_json: ChecklistVisitPlanPeriodResult["metrics"];
  total_count: number;
  items_json: ChecklistVisitPlanPeriodResult["items"];
};

type CandidateRow = {
  total_count: number;
  items_json: ChecklistVisitPlanCandidate[];
};

type RegionOptionPageRow = { total_count: number; items_json: ChecklistVisitPlanRegionOption[] };

const periodSortSql: Record<ChecklistVisitPlanPeriodSort, string> = {
  risk_desc: "risk_score DESC, last_completed_visit_at ASC NULLS FIRST, store_name ASC, store_id ASC",
  store_asc: "store_name ASC, store_id ASC",
  store_desc: "store_name DESC, store_id ASC",
  last_visit_asc: "last_completed_visit_at ASC NULLS FIRST, store_name ASC, store_id ASC",
  last_visit_desc: "last_completed_visit_at DESC NULLS LAST, store_name ASC, store_id ASC",
  next_plan_asc: "next_plan_date ASC NULLS LAST, store_name ASC, store_id ASC",
  next_plan_desc: "next_plan_date DESC NULLS LAST, store_name ASC, store_id ASC",
};

@Injectable()
export class ChecklistVisitPlanRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRegionOptions(input: { regionIds: string[]; query: string | null; limit: number; offset: number }) {
    const result = await this.databaseService.query<RegionOptionPageRow>(
      `WITH scoped AS (
         SELECT region.region_id, region.region_name
         FROM ops.region region
         INNER JOIN ops.company company ON company.company_id = region.company_id
         WHERE region.region_id = ANY($1::uuid[])
           AND region.status = 'active'
           AND company.status = 'active'
           AND ($2::text IS NULL OR region.region_name ILIKE '%' || $2::text || '%' ESCAPE '\\')
       ), paged AS (
         SELECT * FROM scoped
         ORDER BY region_name ASC, region_id ASC
         LIMIT $3 OFFSET $4
       )
       SELECT (SELECT COUNT(*)::int FROM scoped) AS total_count,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'regionId', region_id, 'regionName', region_name
              ) ORDER BY region_name, region_id) FROM paged), '[]'::jsonb) AS items_json`,
      [input.regionIds, input.query ? escapeLike(input.query) : null, input.limit, input.offset],
    );
    return { items: result.rows[0]?.items_json ?? [], total: Number(result.rows[0]?.total_count ?? 0) };
  }

  async listPeriod(input: ListPeriodInput) {
    const result = await this.databaseService.query<PeriodRow>(periodPlanSql(periodSortSql[input.sort]), [
      input.regionId,
      input.period,
      input.query ? escapeLike(input.query) : null,
      input.risk,
      input.reason,
      input.planStatus,
      input.limit,
      input.offset,
    ]);
    const row = result.rows[0];
    return {
      regionName: row?.region_name ?? "",
      metrics: row?.metrics_json ?? emptyPeriodMetrics(),
      items: row?.items_json ?? [],
      total: Number(row?.total_count ?? 0),
    };
  }

  async listCandidates(input: ListCandidatesInput) {
    const search = input.query ? escapeLike(input.query) : null;
    const result = await this.databaseService.query<CandidateRow>(
      `
        WITH candidates AS (
          SELECT store.store_id, store.store_code, store.store_name,
                 region.region_id, region.region_name
          FROM ops.store store
          INNER JOIN ops.region region
            ON region.region_id = store.region_id
           AND region.company_id = store.company_id
          INNER JOIN ops.company company ON company.company_id = store.company_id
          WHERE store.region_id = $1::uuid
            AND store.status = 'active'
            AND region.status = 'active'
            AND company.status = 'active'
            AND (
              $2::text IS NULL
              OR store.store_code ILIKE '%' || $2::text || '%' ESCAPE '\\'
              OR store.store_name ILIKE '%' || $2::text || '%' ESCAPE '\\'
            )
        ),
        paged AS (
          SELECT * FROM candidates
          ORDER BY store_code ASC, store_id ASC
          LIMIT $3 OFFSET $4
        )
        SELECT
          (SELECT COUNT(*)::int FROM candidates) AS total_count,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'storeId', store_id,
            'storeCode', store_code,
            'storeName', store_name,
            'regionId', region_id,
            'regionName', region_name
          ) ORDER BY store_code, store_id) FROM paged), '[]'::jsonb) AS items_json
      `,
      [input.regionId, search, input.limit, input.offset],
    );
    return {
      items: result.rows[0]?.items_json ?? [],
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  async getWeeklyPlan(input: ReadInput): Promise<ChecklistVisitPlanResult> {
    const result = await this.databaseService.query<PlanRow>(readPlanSql(), [
      input.regionId,
      input.weekStart,
      input.companyIds,
      input.regionIds,
      input.storeIds,
      null,
    ]);
    return this.mapPlan(result.rows[0], input.regionId, input.weekStart);
  }

  async saveWeeklyPlan(input: SaveInput): Promise<ChecklistVisitPlanResult> {
    try {
      return await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `INSERT INTO ops.region_weekly_visit_plan (region_id, week_start_date)
           VALUES ($1::uuid, $2::date)
           ON CONFLICT (region_id, week_start_date, visit_type) DO NOTHING`,
          [input.regionId, input.weekStart],
        );
        const header = await client.query<{ plan_id: string }>(
          `SELECT plan_id FROM ops.region_weekly_visit_plan
           WHERE region_id = $1::uuid AND week_start_date = $2::date AND visit_type = 'BM_STORE_VISIT'
           FOR UPDATE`,
          [input.regionId, input.weekStart],
        );
        const planId = header.rows[0]?.plan_id;
        if (!planId) throw new NotFoundException("Weekly visit plan region was not found");

        const replay = await client.query<{ revision_id: string; revision_no: number; request_sha256: string }>(
          `SELECT revision_id, revision_no, request_sha256
           FROM ops.region_weekly_visit_plan_revision
           WHERE plan_id = $1::uuid AND idempotency_key = $2::uuid`,
          [planId, input.idempotencyKey],
        );
        if (replay.rows[0]) {
          if (replay.rows[0].request_sha256 !== input.requestSha256) {
            throw new ConflictException("Idempotency key was already used with different plan content");
          }
          return this.readPlanInTransaction(client, input.regionId, input.weekStart, replay.rows[0].revision_id);
        }

        const current = await client.query<{ revision_no: number }>(
          `SELECT revision_no FROM ops.region_weekly_visit_plan_revision
           WHERE plan_id = $1::uuid AND is_current = TRUE`,
          [planId],
        );
        const currentRevision = current.rows[0]?.revision_no ?? 0;
        if (currentRevision !== input.expectedRevision) {
          throw new ConflictException("Weekly visit plan revision is stale");
        }
        if (currentRevision > 0) {
          await client.query(
            `UPDATE ops.region_weekly_visit_plan_revision SET is_current = FALSE
             WHERE plan_id = $1::uuid AND is_current = TRUE`,
            [planId],
          );
        }
        const revision = await client.query<{ revision_id: string; revision_no: number }>(
          `INSERT INTO ops.region_weekly_visit_plan_revision (
             plan_id, region_id, week_start_date, revision_no, created_by_user_id,
             idempotency_key, request_sha256
           ) VALUES ($1::uuid, $2::uuid, $3::date, $4, $5::uuid, $6::uuid, $7)
           RETURNING revision_id, revision_no`,
          [planId, input.regionId, input.weekStart, currentRevision + 1, input.actorUserId, input.idempotencyKey, input.requestSha256],
        );
        const revisionId = revision.rows[0].revision_id;
        await client.query(
          `INSERT INTO ops.region_weekly_visit_plan_item (
             revision_id, plan_id, region_id, week_start_date, store_id, planned_date, display_order
           )
           SELECT $1::uuid, $2::uuid, $3::uuid, $4::date, item.store_id, item.planned_date, item.display_order
           FROM jsonb_to_recordset($5::jsonb) AS item(store_id uuid, planned_date date, display_order integer)`,
          [
            revisionId,
            planId,
            input.regionId,
            input.weekStart,
            JSON.stringify(
              input.items.map((item) => ({
                store_id: item.storeId,
                planned_date: item.plannedDate,
                display_order: item.displayOrder,
              })),
            ),
          ],
        );
        await client.query(
          `INSERT INTO audit.event_log (
             actor_user_id, event_type, entity_name, entity_id, scope_type, region_id, request_id, metadata_json
           ) VALUES ($1::uuid, 'region_weekly_visit_plan.revised', 'ops.region_weekly_visit_plan',
             $2::uuid, 'region', $3::uuid, $4, $5::jsonb)`,
          [
            input.actorUserId,
            planId,
            input.regionId,
            RequestContextStore.getCorrelationId(),
            JSON.stringify({ revision: currentRevision + 1, itemCount: input.items.length, requestSha256: input.requestSha256 }),
          ],
        );
        return this.readPlanInTransaction(client, input.regionId, input.weekStart, revisionId);
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (["23503", "23505", "23514"].includes(code)) {
        throw new ConflictException("Weekly visit plan contains an invalid or conflicting store/date entry");
      }
      throw error;
    }
  }

  private async readPlanInTransaction(client: PoolClient, regionId: string, weekStart: string, revisionId: string) {
    const result = await client.query<PlanRow>(readPlanSql(), [regionId, weekStart, [], [regionId], [], revisionId]);
    return this.mapPlan(result.rows[0], regionId, weekStart);
  }

  private mapPlan(row: PlanRow | undefined, regionId: string, weekStart: string): ChecklistVisitPlanResult {
    if (!row) throw new NotFoundException("Weekly visit plan is outside the authenticated scope");
    return {
      planId: row.plan_id,
      regionId: row.region_id ?? regionId,
      regionName: row.region_name,
      weekStart: row.week_start_date ?? weekStart,
      revision: Number(row.revision_no ?? 0),
      revisedAt: row.created_at,
      items: row.items_json ?? [],
    };
  }
}

function readPlanSql() {
  return `
    SELECT
      plan.plan_id,
      region.region_id,
      region.region_name,
      $2::date::text AS week_start_date,
      revision.revision_no,
      revision.created_at,
      COALESCE(items.items_json, '[]'::jsonb) AS items_json
    FROM ops.region region
    LEFT JOIN ops.region_weekly_visit_plan plan
      ON plan.region_id = region.region_id
     AND plan.week_start_date = $2::date
     AND plan.visit_type = 'BM_STORE_VISIT'
    LEFT JOIN ops.region_weekly_visit_plan_revision revision
      ON revision.plan_id = plan.plan_id
     AND (($6::uuid IS NULL AND revision.is_current = TRUE) OR revision.revision_id = $6::uuid)
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'planItemId', item.plan_item_id,
        'storeId', store.store_id,
        'storeCode', store.store_code,
        'storeName', store.store_name,
        'plannedDate', item.planned_date,
        'displayOrder', item.display_order,
        'status', CASE
          WHEN completed.checklist_instance_id IS NOT NULL THEN 'completed'
          WHEN item.planned_date >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'
          ELSE 'missed'
        END,
        'checklistInstanceId', completed.checklist_instance_id,
        'completedAt', completed.completed_at
      ) ORDER BY item.planned_date, item.display_order, store.store_name) AS items_json
      FROM ops.region_weekly_visit_plan_item item
      JOIN ops.store store ON store.store_id = item.store_id
      LEFT JOIN LATERAL (
        SELECT ci.checklist_instance_id, ci.completed_at
        FROM ops.checklist_instance ci
        JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.store_id = item.store_id
          AND ci.status = 'completed'
          AND ct.template_type = 'BM_STORE_VISIT'
          AND (ci.completed_at AT TIME ZONE 'Europe/Istanbul')::date = item.planned_date
        ORDER BY ci.completed_at ASC, ci.checklist_instance_id ASC
        LIMIT 1
      ) completed ON TRUE
      WHERE item.revision_id = revision.revision_id
        AND (cardinality($5::uuid[]) = 0 OR item.store_id = ANY($5::uuid[]))
    ) items ON TRUE
    WHERE region.region_id = $1::uuid
      AND (
        region.company_id = ANY($3::uuid[])
        OR region.region_id = ANY($4::uuid[])
        OR EXISTS (
          SELECT 1 FROM ops.store scoped_store
          WHERE scoped_store.region_id = region.region_id AND scoped_store.store_id = ANY($5::uuid[])
        )
      )
  `;
}

function periodPlanSql(orderBy: string) {
  const { highBelow, mediumFrom, mediumThrough, strongFrom } = checklistVisitPlanScoreBands;
  return `
    WITH period_bounds AS (
      SELECT
        to_date($2::text, 'YYYY-MM') AS period_start,
        (to_date($2::text, 'YYYY-MM') + INTERVAL '1 month')::date AS period_end
    ),
    scoped_stores AS (
      SELECT store.store_id, store.store_code, store.store_name,
             region.region_id, region.region_name
      FROM ops.store store
      INNER JOIN ops.region region
        ON region.region_id = store.region_id
       AND region.company_id = store.company_id
      INNER JOIN ops.company company ON company.company_id = store.company_id
      WHERE store.region_id = $1::uuid
        AND store.status = 'active'
        AND region.status = 'active'
        AND company.status = 'active'
    ),
    monthly_checklist AS (
      SELECT
        ci.store_id,
        AVG(ci.total_score) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::numeric(12,2) AS bm_score,
        AVG(ci.total_score) FILTER (WHERE ct.template_type = 'VM_STORE_VISIT')::numeric(12,2) AS vm_score,
        COUNT(*) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::int AS bm_completed_count
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      CROSS JOIN period_bounds bounds
      WHERE ci.status = 'completed'
        AND ci.completed_at IS NOT NULL
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
        AND ci.completed_at >= (bounds.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
        AND ci.completed_at < (bounds.period_end::timestamp AT TIME ZONE 'Europe/Istanbul')
      GROUP BY ci.store_id
    ),
    latest_completed AS (
      SELECT ci.store_id, MAX(ci.completed_at) AS last_completed_visit_at
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      WHERE ci.status = 'completed'
        AND ci.completed_at IS NOT NULL
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
      GROUP BY ci.store_id
    ),
    active_drafts AS (
      SELECT ci.store_id, COUNT(*)::int AS active_draft_count
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      WHERE ci.status IN ('planned', 'in_progress')
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
      GROUP BY ci.store_id
    ),
    pending_acknowledgements AS (
      SELECT
        ci.store_id,
        COUNT(*)::int AS pending_count,
        BOOL_OR(EXISTS (
          SELECT 1
          FROM ops.checklist_response response
          INNER JOIN ops.checklist_template_item item
            ON item.template_item_id = response.template_item_id
          WHERE response.checklist_instance_id = ci.checklist_instance_id
            AND item.max_score > 0
            AND ROUND((response.score_value / item.max_score) * 100) < ${highBelow}
        )) AS has_low_response
      FROM ops.checklist_instance ci
      INNER JOIN scoped_stores store ON store.store_id = ci.store_id
      INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
      LEFT JOIN ops.checklist_acknowledgement acknowledgement
        ON acknowledgement.checklist_instance_id = ci.checklist_instance_id
      CROSS JOIN period_bounds bounds
      WHERE ci.status = 'completed'
        AND ci.completed_at IS NOT NULL
        AND acknowledgement.checklist_acknowledgement_id IS NULL
        AND ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')
        AND ci.completed_at >= (bounds.period_start::timestamp AT TIME ZONE 'Europe/Istanbul')
        AND ci.completed_at < (bounds.period_end::timestamp AT TIME ZONE 'Europe/Istanbul')
      GROUP BY ci.store_id
    ),
    plan_occurrences AS (
      SELECT
        item.store_id,
        item.plan_item_id,
        plan.plan_id,
        revision.revision_no,
        plan.week_start_date,
        item.planned_date,
        item.display_order,
        CASE
          WHEN completed.checklist_instance_id IS NOT NULL THEN 'completed'
          WHEN item.planned_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'
          ELSE 'missed'
        END AS plan_item_status,
        completed.checklist_instance_id,
        completed.completed_at
      FROM ops.region_weekly_visit_plan plan
      INNER JOIN ops.region_weekly_visit_plan_revision revision
        ON revision.plan_id = plan.plan_id AND revision.is_current = TRUE
      INNER JOIN ops.region_weekly_visit_plan_item item
        ON item.revision_id = revision.revision_id
      INNER JOIN scoped_stores store ON store.store_id = item.store_id
      CROSS JOIN period_bounds bounds
      LEFT JOIN LATERAL (
        SELECT ci.checklist_instance_id, ci.completed_at
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.store_id = item.store_id
          AND ci.status = 'completed'
          AND ct.template_type = 'BM_STORE_VISIT'
          AND (ci.completed_at AT TIME ZONE 'Europe/Istanbul')::date = item.planned_date
        ORDER BY ci.completed_at ASC, ci.checklist_instance_id ASC
        LIMIT 1
      ) completed ON TRUE
      WHERE plan.region_id = $1::uuid
        AND plan.visit_type = 'BM_STORE_VISIT'
        AND item.planned_date >= bounds.period_start
        AND item.planned_date < bounds.period_end
    ),
    plan_aggregate AS (
      SELECT
        occurrence.store_id,
        COUNT(*)::int AS plan_item_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'waiting')::int AS waiting_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'missed')::int AS missed_count,
        COUNT(*) FILTER (WHERE occurrence.plan_item_status = 'completed')::int AS completed_count,
        COUNT(DISTINCT occurrence.plan_item_status)::int AS distinct_status_count,
        MIN(occurrence.planned_date) FILTER (WHERE occurrence.plan_item_status <> 'completed') AS next_plan_date,
        MAX(occurrence.plan_item_status) AS only_status,
        jsonb_agg(jsonb_build_object(
          'planItemId', occurrence.plan_item_id,
          'planId', occurrence.plan_id,
          'revision', occurrence.revision_no,
          'weekStart', occurrence.week_start_date,
          'storeId', store.store_id,
          'storeCode', store.store_code,
          'storeName', store.store_name,
          'plannedDate', occurrence.planned_date,
          'displayOrder', occurrence.display_order,
          'status', occurrence.plan_item_status,
          'checklistInstanceId', occurrence.checklist_instance_id,
          'completedAt', occurrence.completed_at
        ) ORDER BY occurrence.planned_date, occurrence.display_order, occurrence.plan_item_id) AS plan_items
      FROM plan_occurrences occurrence
      INNER JOIN scoped_stores store ON store.store_id = occurrence.store_id
      GROUP BY occurrence.store_id
    ),
    fact_base AS (
      SELECT
        store.*,
        score.bm_score,
        score.vm_score,
        COALESCE(score.bm_completed_count, 0)::int AS bm_completed_count,
        latest.last_completed_visit_at,
        CASE WHEN latest.last_completed_visit_at IS NULL THEN NULL ELSE
          (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
          - (latest.last_completed_visit_at AT TIME ZONE 'Europe/Istanbul')::date
        END AS elapsed_days_since_last_visit,
        COALESCE(draft.active_draft_count, 0)::int AS active_draft_count,
        COALESCE(pending.pending_count, 0)::int AS pending_count,
        COALESCE(pending.has_low_response, FALSE) AS has_low_response,
        COALESCE(plan.plan_item_count, 0)::int AS plan_item_count,
        COALESCE(plan.waiting_count, 0)::int AS waiting_count,
        COALESCE(plan.missed_count, 0)::int AS missed_count,
        COALESCE(plan.completed_count, 0)::int AS completed_count,
        plan.next_plan_date,
        COALESCE(plan.plan_items, '[]'::jsonb) AS plan_items,
        CASE
          WHEN COALESCE(plan.plan_item_count, 0) = 0 THEN 'unplanned'
          WHEN plan.distinct_status_count = 1 THEN plan.only_status
          ELSE 'mixed'
        END AS plan_status,
        (COALESCE(score.bm_completed_count, 0) = 0) AS reason_missing,
        ((score.bm_score < ${highBelow} OR score.vm_score < ${highBelow}) OR COALESCE(pending.has_low_response, FALSE)) AS reason_low,
        (NOT COALESCE(score.bm_score < ${highBelow} OR score.vm_score < ${highBelow}, FALSE)
          AND COALESCE(score.bm_score BETWEEN ${mediumFrom} AND ${mediumThrough} OR score.vm_score BETWEEN ${mediumFrom} AND ${mediumThrough}, FALSE)) AS reason_watch,
        (COALESCE(draft.active_draft_count, 0) > 0) AS reason_active,
        (COALESCE(pending.pending_count, 0) > 0) AS reason_pending,
        (COALESCE(score.bm_completed_count, 0) > 0 AND score.bm_score IS NULL) AS reason_insufficient,
        (COALESCE(score.bm_completed_count, 0) > 0) AS reason_completed
      FROM scoped_stores store
      LEFT JOIN monthly_checklist score ON score.store_id = store.store_id
      LEFT JOIN latest_completed latest ON latest.store_id = store.store_id
      LEFT JOIN active_drafts draft ON draft.store_id = store.store_id
      LEFT JOIN pending_acknowledgements pending ON pending.store_id = store.store_id
      LEFT JOIN plan_aggregate plan ON plan.store_id = store.store_id
    ),
    reasoned AS (
      SELECT
        fact.*,
        CASE
          WHEN fact.reason_missing OR fact.reason_low THEN 'high'
          WHEN fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient THEN 'medium'
          ELSE 'low'
        END AS risk,
        array_remove(ARRAY[
          CASE WHEN fact.reason_missing THEN 'missing_current_month_visit' END,
          CASE WHEN fact.reason_low THEN 'low_checklist_score' END,
          CASE WHEN fact.reason_pending THEN 'pending_acknowledgement' END,
          CASE WHEN fact.reason_active THEN 'active_draft' END,
          CASE WHEN fact.reason_watch THEN 'watch_checklist_result' END,
          CASE WHEN fact.reason_insufficient THEN 'insufficient_signal' END,
          CASE WHEN fact.reason_completed
            AND NOT (fact.reason_missing OR fact.reason_low OR fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient)
            AND (fact.bm_score IS NOT NULL OR fact.vm_score IS NOT NULL)
            AND COALESCE(fact.bm_score, ${strongFrom}) >= ${strongFrom}
            AND COALESCE(fact.vm_score, ${strongFrom}) >= ${strongFrom}
            THEN 'strong_score' END,
          CASE WHEN fact.reason_completed THEN 'visit_completed' END
        ], NULL)::text[] AS reason_codes,
        (CASE
          WHEN fact.reason_missing OR fact.reason_low THEN 300
          WHEN fact.reason_pending OR fact.reason_active OR fact.reason_watch OR fact.reason_insufficient THEN 200
          ELSE 100
        END)
        + CASE WHEN fact.reason_missing THEN 80 ELSE 0 END
        + CASE WHEN fact.reason_low THEN 70 ELSE 0 END
        + CASE WHEN fact.reason_pending THEN 45 ELSE 0 END
        + CASE WHEN fact.reason_active THEN 40 ELSE 0 END
        + CASE WHEN fact.reason_watch THEN 35 ELSE 0 END
        + CASE WHEN fact.reason_insufficient THEN 30 ELSE 0 END
        + CASE WHEN fact.reason_completed THEN 10 ELSE 0 END
        + CASE WHEN fact.reason_missing THEN 5 ELSE 0 END AS risk_score
      FROM fact_base fact
    ),
    filtered AS (
      SELECT *
      FROM reasoned
      WHERE (
        $3::text IS NULL
        OR store_code ILIKE '%' || $3::text || '%' ESCAPE '\\'
        OR store_name ILIKE '%' || $3::text || '%' ESCAPE '\\'
      )
        AND ($4::text = 'all' OR risk = $4::text)
        AND ($5::text = 'all' OR $5::text = ANY(reason_codes))
        AND ($6::text = 'all' OR plan_status = $6::text)
    ),
    paged AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS sort_rank
      FROM filtered
      ORDER BY ${orderBy}
      LIMIT $7 OFFSET $8
    )
    SELECT
      COALESCE((SELECT MAX(region_name) FROM scoped_stores), '') AS region_name,
      (SELECT COUNT(*)::int FROM filtered) AS total_count,
      jsonb_build_object(
        'totalStores', (SELECT COUNT(*)::int FROM reasoned),
        'high', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'high'),
        'medium', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'medium'),
        'low', (SELECT COUNT(*)::int FROM reasoned WHERE risk = 'low'),
        'planned', (SELECT COUNT(*)::int FROM reasoned WHERE plan_item_count > 0),
        'unplanned', (SELECT COUNT(*)::int FROM reasoned WHERE plan_item_count = 0),
        'waiting', COALESCE((SELECT SUM(waiting_count)::int FROM reasoned), 0),
        'missed', COALESCE((SELECT SUM(missed_count)::int FROM reasoned), 0),
        'completed', COALESCE((SELECT SUM(completed_count)::int FROM reasoned), 0)
      ) AS metrics_json,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'storeId', page.store_id,
        'storeCode', page.store_code,
        'storeName', page.store_name,
        'regionId', page.region_id,
        'regionName', page.region_name,
        'bmScore', page.bm_score,
        'vmScore', page.vm_score,
        'lastCompletedVisitAt', page.last_completed_visit_at,
        'elapsedDaysSinceLastVisit', page.elapsed_days_since_last_visit,
        'risk', page.risk,
        'reasonCodes', page.reason_codes,
        'planStatus', page.plan_status,
        'planItems', page.plan_items
      ) ORDER BY page.sort_rank) FROM paged page), '[]'::jsonb) AS items_json
  `;
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function emptyPeriodMetrics(): ChecklistVisitPlanPeriodResult["metrics"] {
  return {
    totalStores: 0,
    high: 0,
    medium: 0,
    low: 0,
    planned: 0,
    unplanned: 0,
    waiting: 0,
    missed: 0,
    completed: 0,
  };
}
