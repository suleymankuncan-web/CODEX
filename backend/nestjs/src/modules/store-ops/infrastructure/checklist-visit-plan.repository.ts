import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import type {
  ChecklistVisitPlanItem,
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

type PlanRow = {
  plan_id: string | null;
  region_id: string;
  region_name: string;
  week_start_date: string;
  revision_no: number | null;
  created_at: string | null;
  items_json: ChecklistVisitPlanItem[];
};

@Injectable()
export class ChecklistVisitPlanRepository {
  constructor(private readonly databaseService: DatabaseService) {}

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
