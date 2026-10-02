import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import { periodPlanSql } from "./checklist-visit-plan-period-query";
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
  ChecklistVisitPlanVisitCompletion,
  SaveChecklistVisitPlanItem,
} from "../application/checklist-visit-plan.contract";

type ReadInput = {
  regionId: string;
  weekStart: string;
  storeIds: string[];
};

type ManagerReadInput = {
  managerUserId: string;
  weekStart: string;
  companyIds: string[];
};

type SaveInput = {
  regionId: string;
  weekStart: string;
  actorUserId: string;
  expectedRevision: number;
  idempotencyKey: string;
  requestSha256: string;
  authorizedStoreIds: string[];
  items: SaveChecklistVisitPlanItem[];
};

type ListPeriodInput = {
  regionId: string | null;
  storeIds: string[];
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
  regionId: string | null;
  storeIds: string[];
  query: string | null;
  limit: number;
  offset: number;
};

type CompleteVisitInput = {
  planItemId: string;
  actorUserId: string;
  storeIds: string[];
  idempotencyKey: string;
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

  async listRegionOptions(input: { storeIds: string[]; query: string | null; limit: number; offset: number }) {
    const result = await this.databaseService.query<RegionOptionPageRow>(
      `WITH scoped AS (
         SELECT DISTINCT region.region_id, region.region_name
         FROM ops.store store
         INNER JOIN ops.region region
           ON region.region_id = store.region_id
          AND region.company_id = store.company_id
         INNER JOIN ops.company company ON company.company_id = store.company_id
         WHERE store.store_id = ANY($1::uuid[])
           AND store.status = 'active'
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
      [input.storeIds, input.query ? escapeLike(input.query) : null, input.limit, input.offset],
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
      input.storeIds,
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
          WHERE ($1::uuid IS NULL OR store.region_id = $1::uuid)
            AND store.store_id = ANY($5::uuid[])
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
      [input.regionId, search, input.limit, input.offset, input.storeIds],
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
      input.storeIds,
      null,
    ]);
    return this.mapPlan(result.rows[0], input.regionId, input.weekStart);
  }

  async getManagerWeeklyPlan(input: ManagerReadInput): Promise<ChecklistVisitPlanResult> {
    const result = await this.databaseService.query<PlanRow>(readManagerPlanSql(), [
      input.managerUserId,
      input.weekStart,
      input.companyIds,
    ]);
    return this.mapPlan(result.rows[0], input.managerUserId, input.weekStart);
  }

  async getAssignedWeeklyPlan(input: { actorUserId: string; weekStart: string; storeIds: string[] }) {
    return this.databaseService.withTransaction(async (client) => {
      const portfolio = await this.assignedPortfolio(client, input.actorUserId, input.storeIds);
      return this.readAssignedPlan(client, input.weekStart, portfolio);
    });
  }

  async saveAssignedWeeklyPlan(input: Omit<SaveInput, "regionId"> & { expectedScopeRevision: string }) {
    // The UI owns one direct-store portfolio. Existing regional plan records
    // remain storage partitions only, updated atomically and in stable lock order.
    return this.databaseService.withTransaction(async (client) => {
      const portfolio = await this.assignedPortfolio(client, input.actorUserId, input.authorizedStoreIds, true);
      const byStore = new Map(portfolio.map((row) => [row.store_id, row.region_id]));
      if (portfolio.length === 0 || input.items.some((item) => !byStore.has(item.storeId))) {
        throw new ConflictException("Weekly visit plan contains a store outside the direct active portfolio");
      }
      const regionIds = [...new Set(portfolio.map((row) => row.region_id))].sort();
      const headers: { regionId: string; planId: string }[] = [];
      for (const regionId of regionIds) {
        await client.query(
          `INSERT INTO ops.region_weekly_visit_plan (region_id, week_start_date)
           VALUES ($1::uuid, $2::date)
           ON CONFLICT (region_id, week_start_date, visit_type) DO NOTHING`,
          [regionId, input.weekStart],
        );
        const header = await client.query<{ plan_id: string }>(
          `SELECT plan_id FROM ops.region_weekly_visit_plan
           WHERE region_id = $1::uuid AND week_start_date = $2::date AND visit_type = 'BM_STORE_VISIT'
           FOR UPDATE`,
          [regionId, input.weekStart],
        );
        if (!header.rows[0]) throw new NotFoundException("Weekly visit plan was not found");
        headers.push({ regionId, planId: header.rows[0].plan_id });
      }
      const replay = await client.query<{ plan_id: string; request_sha256: string }>(
        `SELECT plan_id, request_sha256 FROM ops.region_weekly_visit_plan_revision
         WHERE plan_id = ANY($1::uuid[]) AND idempotency_key = $2::uuid`,
        [headers.map((header) => header.planId), input.idempotencyKey],
      );
      if (replay.rows.length > 0) {
        // Unchanged partitions do not receive a new revision. Since every
        // changed partition commits in this transaction, one matching receipt
        // proves the entire request committed, not a partially applied save.
        if (replay.rows.some((row) => row.request_sha256 !== input.requestSha256)) {
          throw new ConflictException("Idempotency key was already used with different plan content or store scope");
        }
        return this.readAssignedPlan(client, input.weekStart, portfolio);
      }
      const current = await this.readAssignedPlan(client, input.weekStart, portfolio);
      if (current.scopeRevision !== input.expectedScopeRevision) {
        throw new ConflictException("Weekly visit plan revision is stale");
      }
      for (const { regionId } of headers) {
        const existing = await client.query<PlanRow>(readPlanSql(), [regionId, input.weekStart, input.authorizedStoreIds, null]);
        const items = input.items.filter((item) => byStore.get(item.storeId) === regionId);
        const itemKeys = (rows: SaveChecklistVisitPlanItem[]) => rows.map((item) =>
          `${item.storeId}:${item.plannedDate}:${item.displayOrder}`).sort();
        // Preserve plan-item identities and attendance in untouched groups.
        if (JSON.stringify(itemKeys(existing.rows[0]?.items_json ?? [])) === JSON.stringify(itemKeys(items))) continue;
        await this.saveWeeklyPlan({
          ...input,
          regionId,
          expectedRevision: Number(existing.rows[0]?.revision_no ?? 0),
          items,
        }, client);
      }
      return this.readAssignedPlan(client, input.weekStart, portfolio);
    });
  }

  private async assignedPortfolio(client: PoolClient, actorUserId: string, storeIds: string[], lock = false) {
    const result = await client.query<{ store_id: string; region_id: string }>(
      `SELECT store.store_id, store.region_id
       FROM ops.user_action_store_assignment assignment
       INNER JOIN ops.store store ON store.store_id = assignment.store_id AND store.status = 'active'
       INNER JOIN ops.region region
         ON region.region_id = store.region_id
        AND region.company_id = store.company_id
        AND region.status = 'active'
       INNER JOIN ops.company company ON company.company_id = store.company_id AND company.status = 'active'
       WHERE assignment.user_id = $1::uuid AND store.store_id = ANY($2::uuid[])
         AND assignment.start_at <= CURRENT_TIMESTAMP
         AND (assignment.end_at IS NULL OR assignment.end_at > CURRENT_TIMESTAMP)
       ORDER BY store.store_id, assignment.start_at
       ${lock ? "FOR SHARE" : ""}`,
      [actorUserId, storeIds],
    );
    return [...new Map(result.rows.map((row) => [row.store_id, row])).values()];
  }

  private async readAssignedPlan(
    client: PoolClient,
    weekStart: string,
    portfolio: { store_id: string; region_id: string }[],
  ): Promise<ChecklistVisitPlanResult> {
    const regionIds = [...new Set(portfolio.map((row) => row.region_id))].sort();
    const plans: ChecklistVisitPlanResult[] = [];
    for (const regionId of regionIds) {
      const result = await client.query<PlanRow>(readPlanSql(), [regionId, weekStart, portfolio.map((row) => row.store_id), null]);
      plans.push(this.mapPlan(result.rows[0], regionId, weekStart));
    }
    const scopeRevision = createHash("sha256").update(JSON.stringify({
      weekStart,
      stores: portfolio.map((row) => `${row.store_id}:${row.region_id}`).sort(),
      revisions: plans.map((plan) => [plan.regionId, plan.revision]),
    })).digest("hex");
    return {
      planId: null,
      regionId: null,
      regionName: "Sorumlu mağazalar",
      weekStart,
      revision: plans.reduce((total, plan) => total + plan.revision, 0),
      scopeRevision,
      revisedAt: plans.map((plan) => plan.revisedAt).filter((value): value is string => value !== null).sort().at(-1) ?? null,
      items: plans.flatMap((plan) => plan.items).sort((left, right) =>
        left.plannedDate.localeCompare(right.plannedDate) || left.displayOrder - right.displayOrder || left.storeId.localeCompare(right.storeId)),
    };
  }

  async completeVisit(input: CompleteVisitInput): Promise<ChecklistVisitPlanVisitCompletion> {
    return this.databaseService.withTransaction(async (client) => {
      const item = await client.query<{
        plan_item_id: string;
        region_id: string;
        planned_date: string;
        week_start_date: string;
      }>(
        `SELECT item.plan_item_id, item.region_id, item.planned_date, item.week_start_date
         FROM ops.region_weekly_visit_plan_item item
         INNER JOIN ops.region_weekly_visit_plan_revision revision
           ON revision.revision_id = item.revision_id
          AND revision.is_current = TRUE
         INNER JOIN ops.store store
           ON store.store_id = item.store_id
          AND store.status = 'active'
         INNER JOIN ops.region region
           ON region.region_id = item.region_id
          AND region.region_id = store.region_id
          AND region.company_id = store.company_id
          AND region.status = 'active'
         INNER JOIN ops.company company
           ON company.company_id = store.company_id
          AND company.status = 'active'
         INNER JOIN ops.user_action_store_assignment assignment
           ON assignment.user_id = $2::uuid
          AND assignment.store_id = item.store_id
          AND assignment.start_at <= CURRENT_TIMESTAMP
          AND (assignment.end_at IS NULL OR assignment.end_at > CURRENT_TIMESTAMP)
         WHERE item.plan_item_id = $1::uuid
           AND item.store_id = ANY($3::uuid[])
           AND item.visit_type = 'BM_STORE_VISIT'
         FOR UPDATE`,
        [input.planItemId, input.actorUserId, input.storeIds],
      );
      const planItem = item.rows[0];
      if (!planItem) throw new NotFoundException("Weekly visit plan item is outside the authenticated scope");

      const existing = await client.query<{ completed_at: string }>(
        `SELECT completed_at
         FROM ops.region_weekly_visit_plan_completion
         WHERE plan_item_id = $1::uuid
         FOR UPDATE`,
        [input.planItemId],
      );
      if (existing.rows[0]) {
        return { planItemId: input.planItemId, completedAt: existing.rows[0].completed_at };
      }

      const inserted = await client.query<{ completed_at: string }>(
        `INSERT INTO ops.region_weekly_visit_plan_completion (
           plan_item_id, completed_by_user_id, idempotency_key
         )
         SELECT $1::uuid, $2::uuid, $3::uuid
         WHERE $4::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
         RETURNING completed_at`,
        [input.planItemId, input.actorUserId, input.idempotencyKey, planItem.planned_date],
      );
      const completedAt = inserted.rows[0]?.completed_at;
      if (!completedAt) throw new ConflictException("Visits can only be completed on the planned date");
      await client.query(
        `INSERT INTO audit.event_log (
           actor_user_id, event_type, entity_name, entity_id, scope_type, region_id, request_id, metadata_json
         ) VALUES ($1::uuid, 'region_weekly_visit_plan.visit_completed', 'ops.region_weekly_visit_plan_item',
           $2::uuid, 'region', $3::uuid, $4, $5::jsonb)`,
        [
          input.actorUserId,
          input.planItemId,
          planItem.region_id,
          RequestContextStore.getCorrelationId(),
          JSON.stringify({ plannedDate: planItem.planned_date, weekStart: planItem.week_start_date }),
        ],
      );
      return { planItemId: input.planItemId, completedAt };
    });
  }

  async saveWeeklyPlan(input: SaveInput, transactionClient?: PoolClient): Promise<ChecklistVisitPlanResult> {
    try {
      const save = async (client: PoolClient) => {
        const authorizedStoreIds = [...new Set(input.authorizedStoreIds.filter(Boolean))];
        const submittedStoreIds = [...new Set(input.items.map((item) => item.storeId).filter(Boolean))];
        const portfolio = await client.query<{ store_id: string; region_id: string }>(
          `SELECT store.store_id, store.region_id
           FROM ops.user_action_store_assignment assignment
           INNER JOIN ops.store store
             ON store.store_id = assignment.store_id
            AND store.status = 'active'
           INNER JOIN ops.region region
             ON region.region_id = store.region_id
            AND region.company_id = store.company_id
            AND region.status = 'active'
           INNER JOIN ops.company company
             ON company.company_id = store.company_id
            AND company.status = 'active'
           WHERE assignment.user_id = $1::uuid
             AND assignment.store_id = ANY($2::uuid[])
             AND assignment.start_at <= CURRENT_TIMESTAMP
             AND (assignment.end_at IS NULL OR assignment.end_at > CURRENT_TIMESTAMP)
           FOR SHARE`,
          [input.actorUserId, authorizedStoreIds],
        );
        const portfolioByStoreId = new Map(portfolio.rows.map((row) => [row.store_id, row.region_id]));
        const selectedRegionHasPortfolioStore = portfolio.rows.some((row) => row.region_id === input.regionId);
        const invalidSnapshot =
          !selectedRegionHasPortfolioStore ||
          submittedStoreIds.some((storeId) => portfolioByStoreId.get(storeId) !== input.regionId);
        if (invalidSnapshot) {
          throw new ConflictException("Weekly visit plan contains a store outside the direct active portfolio");
        }

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
          return this.readPlanInTransaction(
            client,
            input.regionId,
            input.weekStart,
            replay.rows[0].revision_id,
            authorizedStoreIds,
          );
        }

        const current = await client.query<{ revision_no: number; store_ids: string[] }>(
          `SELECT revision.revision_no,
                  COALESCE(ARRAY_AGG(item.store_id) FILTER (WHERE item.store_id IS NOT NULL), '{}'::uuid[]) AS store_ids
           FROM ops.region_weekly_visit_plan_revision revision
           LEFT JOIN ops.region_weekly_visit_plan_item item ON item.revision_id = revision.revision_id
           WHERE revision.plan_id = $1::uuid AND revision.is_current = TRUE
           GROUP BY revision.revision_id, revision.revision_no`,
          [planId],
        );
        const currentRevision = current.rows[0]?.revision_no ?? 0;
        if (currentRevision !== input.expectedRevision) {
          throw new ConflictException("Weekly visit plan revision is stale");
        }
        if (currentRevision > 0) {
          const currentStoreIds = current.rows[0]?.store_ids ?? [];
          if (currentStoreIds.some((storeId) => !portfolioByStoreId.has(storeId))) {
            throw new ConflictException("Weekly visit plan current revision is outside the direct active portfolio");
          }
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
        return this.readPlanInTransaction(client, input.regionId, input.weekStart, revisionId, authorizedStoreIds);
      };
      return transactionClient ? await save(transactionClient) : await this.databaseService.withTransaction(save);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (["23503", "23505", "23514"].includes(code)) {
        throw new ConflictException("Weekly visit plan contains an invalid or conflicting store/date entry");
      }
      throw error;
    }
  }

  private async readPlanInTransaction(
    client: PoolClient,
    regionId: string,
    weekStart: string,
    revisionId: string,
    storeIds: string[],
  ) {
    const result = await client.query<PlanRow>(readPlanSql(), [regionId, weekStart, storeIds, revisionId]);
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
     AND (($4::uuid IS NULL AND revision.is_current = TRUE) OR revision.revision_id = $4::uuid)
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
           WHEN visit.visit_completion_id IS NOT NULL THEN 'completed'
           WHEN item.planned_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'planned'
           WHEN item.planned_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'
           ELSE 'missed'
         END,
         'checklistInstanceId', completed.checklist_instance_id,
         'visitCompletedAt', visit.completed_at,
         'completedAt', COALESCE(completed.completed_at, visit.completed_at)
      ) ORDER BY item.planned_date, item.display_order, store.store_name) AS items_json
      FROM ops.region_weekly_visit_plan_item item
      JOIN ops.store store
        ON store.store_id = item.store_id
       AND store.status = 'active'
      JOIN ops.region item_region
        ON item_region.region_id = store.region_id
       AND item_region.company_id = store.company_id
       AND item_region.status = 'active'
      JOIN ops.company item_company
        ON item_company.company_id = store.company_id
       AND item_company.status = 'active'
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
       LEFT JOIN ops.region_weekly_visit_plan_completion visit
         ON visit.plan_item_id = item.plan_item_id
       WHERE item.revision_id = revision.revision_id
        AND item.store_id = ANY($3::uuid[])
    ) items ON TRUE
    INNER JOIN ops.company company
      ON company.company_id = region.company_id
     AND company.status = 'active'
    WHERE region.region_id = $1::uuid
      AND region.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM ops.store scoped_store
        INNER JOIN ops.region scoped_region
          ON scoped_region.region_id = scoped_store.region_id
         AND scoped_region.company_id = scoped_store.company_id
         AND scoped_region.status = 'active'
        INNER JOIN ops.company scoped_company
          ON scoped_company.company_id = scoped_store.company_id
         AND scoped_company.status = 'active'
        WHERE scoped_store.region_id = region.region_id
          AND scoped_store.store_id = ANY($3::uuid[])
          AND scoped_store.status = 'active'
      )
  `;
}

function readManagerPlanSql() {
  return `
    WITH manager_scope AS (
      SELECT
        ua.user_id AS manager_user_id,
        COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''), NULLIF(BTRIM(CONCAT_WS(' ', NULLIF(BTRIM(ua.first_name), ''), NULLIF(BTRIM(ua.last_name), ''))), ''), CASE WHEN ua.user_id IS NOT NULL THEN 'Kullanıcı' END) AS manager_name,
        store.store_id,
        store.store_code,
        store.store_name,
        store.region_id
      FROM ops.user_account ua
      INNER JOIN ops.user_action_store_assignment manager_store
        ON manager_store.user_id = ua.user_id
       AND manager_store.start_at <= CURRENT_TIMESTAMP
       AND (manager_store.end_at IS NULL OR manager_store.end_at > CURRENT_TIMESTAMP)
       INNER JOIN ops.store store
         ON store.store_id = manager_store.store_id
        AND store.status = 'active'
       INNER JOIN ops.region region
         ON region.region_id = store.region_id
        AND region.company_id = store.company_id
        AND region.status = 'active'
       INNER JOIN ops.company company
        ON company.company_id = store.company_id
       AND company.status = 'active'
      LEFT JOIN ops.employee employee ON employee.employee_id = ua.employee_id
      WHERE ua.user_id = $1::uuid
        AND ua.is_active = TRUE
        AND store.company_id = ANY($3::uuid[])
        AND EXISTS (
          SELECT 1
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
          WHERE ura.user_id = ua.user_id
            AND ura.start_at <= CURRENT_TIMESTAMP
            AND (ura.end_at IS NULL OR ura.end_at > CURRENT_TIMESTAMP)
            AND (ura.company_id IS NULL OR ura.company_id = store.company_id)
        )
    ), manager_identity AS (
      SELECT manager_user_id, manager_name,
             (MIN(region_id::text))::uuid AS representative_region_id
      FROM manager_scope
      GROUP BY manager_user_id, manager_name
    ), current_items AS (
      SELECT
        plan.plan_id,
        revision.revision_no,
        revision.created_at,
        item.plan_item_id,
        scope.store_id,
        scope.store_code,
        scope.store_name,
        item.planned_date,
        item.display_order,
        CASE
          WHEN completed.checklist_instance_id IS NOT NULL THEN 'completed'
          WHEN visit.visit_completion_id IS NOT NULL THEN 'completed'
          WHEN item.planned_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'planned'
          WHEN item.planned_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'
          ELSE 'missed'
        END AS status,
        completed.checklist_instance_id,
        visit.completed_at AS visit_completed_at,
        COALESCE(completed.completed_at, visit.completed_at) AS completed_at
      FROM manager_scope scope
      INNER JOIN ops.region_weekly_visit_plan plan
        ON plan.region_id = scope.region_id
       AND plan.week_start_date = $2::date
       AND plan.visit_type = 'BM_STORE_VISIT'
      INNER JOIN ops.region_weekly_visit_plan_revision revision
        ON revision.plan_id = plan.plan_id
       AND revision.is_current = TRUE
      INNER JOIN ops.region_weekly_visit_plan_item item
        ON item.revision_id = revision.revision_id
       AND item.store_id = scope.store_id
      LEFT JOIN LATERAL (
        SELECT ci.checklist_instance_id, ci.completed_at
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct ON ct.checklist_template_id = ci.checklist_template_id
        WHERE ci.store_id = item.store_id
          AND ci.status = 'completed'
          AND ct.template_type = 'BM_STORE_VISIT'
          AND (ci.completed_at AT TIME ZONE 'Europe/Istanbul')::date = item.planned_date
        ORDER BY ci.completed_at ASC, ci.checklist_instance_id ASC
        LIMIT 1
      ) completed ON TRUE
      LEFT JOIN ops.region_weekly_visit_plan_completion visit ON visit.plan_item_id = item.plan_item_id
    )
    SELECT
      NULL::uuid AS plan_id,
      identity.representative_region_id AS region_id,
      identity.manager_name AS region_name,
      $2::date::text AS week_start_date,
      COALESCE((SELECT MAX(revision_no) FROM current_items), 0) AS revision_no,
      (SELECT MAX(created_at) FROM current_items) AS created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'planItemId', item.plan_item_id,
          'storeId', item.store_id,
          'storeCode', item.store_code,
          'storeName', item.store_name,
          'plannedDate', item.planned_date,
          'displayOrder', item.display_order,
          'status', item.status,
          'checklistInstanceId', item.checklist_instance_id,
          'visitCompletedAt', item.visit_completed_at,
          'completedAt', item.completed_at
        ) ORDER BY item.planned_date, item.display_order, item.store_name, item.store_id)
        FROM current_items item
      ), '[]'::jsonb) AS items_json
    FROM manager_identity identity
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
