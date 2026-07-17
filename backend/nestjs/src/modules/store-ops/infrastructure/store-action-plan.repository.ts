import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  StoreActionPlanPriority,
  StoreActionPlanSourceType,
  StoreActionPlanStatus,
  storeActionPlanAuditEventTypes,
} from "../application/store-action-plan.contract";

export type StoreActionPlan = {
  actionPlanId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  storeName: string | null;
  ownerUserId: string;
  ownerDisplayName: string | null;
  createdByUserId: string;
  sourceType: StoreActionPlanSourceType;
  sourceId: string;
  sourceDeepLink: string | null;
  sourceSnapshotRunId: string | null;
  sourceKpiId: string | null;
  title: string;
  summary: string | null;
  priority: StoreActionPlanPriority;
  status: StoreActionPlanStatus;
  dueOn: string;
  resolutionNote: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
  cancelReason: string | null;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreActionPlanRow = {
  store_action_plan_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_name?: string | null;
  owner_user_id: string;
  owner_display_name?: string | null;
  created_by_user_id: string;
  source_type: StoreActionPlanSourceType;
  source_id: string;
  source_deep_link: string | null;
  source_snapshot_run_id: string | null;
  source_kpi_id: string | null;
  title: string;
  summary: string | null;
  priority: StoreActionPlanPriority;
  status: StoreActionPlanStatus;
  due_on: string;
  resolution_note: string | null;
  closed_by_user_id: string | null;
  closed_at: string | null;
  cancel_reason: string | null;
  cancelled_by_user_id: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type Queryable = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export class StoreActionPlanTransitionConflictError extends Error {
  constructor() {
    super("Store action plan status transition is not allowed");
    this.name = "StoreActionPlanTransitionConflictError";
  }
}

const STORE_ACTION_PLAN_COLUMNS = `
  store_action_plan_id,
  company_id,
  region_id,
  store_id,
  owner_user_id,
  created_by_user_id,
  source_type,
  source_id,
  source_deep_link,
  source_snapshot_run_id,
  source_kpi_id,
  title,
  summary,
  priority,
  status,
  due_on,
  resolution_note,
  closed_by_user_id,
  closed_at,
  cancel_reason,
  cancelled_by_user_id,
  cancelled_at,
  created_at,
  updated_at
`;

const STORE_ACTION_PLAN_READ_COLUMNS = `
  p.store_action_plan_id,
  p.company_id,
  p.region_id,
  p.store_id,
  s.store_name,
  p.owner_user_id,
  COALESCE(
    NULLIF(BTRIM(CONCAT_WS(' ', owner_employee.first_name, owner_employee.last_name)), ''),
    NULLIF(owner_account.username, ''),
    NULLIF(owner_account.email, '')
  ) AS owner_display_name,
  p.created_by_user_id,
  p.source_type,
  p.source_id,
  p.source_deep_link,
  p.source_snapshot_run_id,
  p.source_kpi_id,
  p.title,
  p.summary,
  p.priority,
  p.status,
  p.due_on,
  p.resolution_note,
  p.closed_by_user_id,
  p.closed_at,
  p.cancel_reason,
  p.cancelled_by_user_id,
  p.cancelled_at,
  p.created_at,
  p.updated_at
`;

const STORE_ACTION_PLAN_READ_JOINS = `
  INNER JOIN ops.store s
    ON s.store_id = p.store_id
  LEFT JOIN ops.user_account owner_account
    ON owner_account.user_id = p.owner_user_id
  LEFT JOIN ops.employee owner_employee
    ON owner_employee.employee_id = owner_account.employee_id
`;

@Injectable()
export class StoreActionPlanRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPlanById(actionPlanId: string) {
    const result = await this.databaseService.query<StoreActionPlanRow>(
      `
        SELECT ${STORE_ACTION_PLAN_READ_COLUMNS}
        FROM ops.store_action_plan p
        ${STORE_ACTION_PLAN_READ_JOINS}
        WHERE p.store_action_plan_id = $1::uuid
      `,
      [actionPlanId],
    );

    return result.rows[0] ? this.mapPlan(result.rows[0]) : null;
  }

  async getPlanByIdInCompanyScope(input: {
    actionPlanId: string;
    companyIds: readonly string[];
  }) {
    if (input.companyIds.length === 0) {
      return null;
    }

    const result = await this.databaseService.query<StoreActionPlanRow>(
      `
        SELECT ${STORE_ACTION_PLAN_READ_COLUMNS}
        FROM ops.store_action_plan p
        ${STORE_ACTION_PLAN_READ_JOINS}
        WHERE p.store_action_plan_id = $1::uuid
          AND p.company_id = ANY($2::uuid[])
      `,
      [input.actionPlanId, [...input.companyIds]],
    );

    return result.rows[0] ? this.mapPlan(result.rows[0]) : null;
  }

  async listPlans(input: {
    companyIds?: readonly string[];
    storeIds: readonly string[];
    statuses?: readonly StoreActionPlanStatus[];
    periodStart?: string;
    periodEnd?: string;
    limit: number;
    offset: number;
  }) {
    if (input.storeIds.length === 0 && (input.companyIds?.length ?? 0) === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const params: unknown[] = [];
    const filters: string[] = [];

    if (input.storeIds.length > 0) {
      params.push([...input.storeIds]);
      filters.push(`p.store_id = ANY($${params.length}::uuid[])`);
    }

    if (input.companyIds?.length) {
      params.push([...input.companyIds]);
      filters.push(`p.company_id = ANY($${params.length}::uuid[])`);
    }

    if (input.statuses?.length) {
      params.push([...input.statuses]);
      filters.push(`p.status = ANY($${params.length}::text[])`);
    }

    if (input.periodStart && input.periodEnd) {
      params.push(input.periodStart);
      const periodStartParam = params.length;
      params.push(input.periodEnd);
      const periodEndParam = params.length;
      filters.push(`(
        p.due_on BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
        OR (
          p.status IN ('open', 'in_progress', 'blocked')
          AND p.due_on < $${periodStartParam}::date
        )
        OR p.closed_at::date BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
        OR p.cancelled_at::date BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
      )`);
    }

    const whereSql = filters.join(" AND ");
    const countResult = await this.databaseService.query<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM ops.store_action_plan p
        WHERE ${whereSql}
      `,
      params,
    );
    const listParams = [...params, input.limit, input.offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const result = await this.databaseService.query<StoreActionPlanRow>(
      `
        SELECT ${STORE_ACTION_PLAN_READ_COLUMNS}
        FROM ops.store_action_plan p
        ${STORE_ACTION_PLAN_READ_JOINS}
        WHERE ${whereSql}
        ORDER BY p.due_on ASC, p.updated_at DESC
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapPlan(row)),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async listWorkflowInboxPlans(input: {
    companyIds?: readonly string[];
    regionIds?: readonly string[];
    storeIds?: readonly string[];
    statuses: readonly StoreActionPlanStatus[];
    sourceTypes?: readonly StoreActionPlanSourceType[];
    limit: number;
  }) {
    if (input.statuses.length === 0) {
      return [];
    }

    const params: unknown[] = [];
    const filters: string[] = [];
    this.addScopeFilters(
      filters,
      params,
      {
        companyIds: input.companyIds ?? [],
        regionIds: input.regionIds ?? [],
        storeIds: input.storeIds ?? [],
      },
      "p",
    );

    if (filters.length === 0) {
      return [];
    }

    params.push([...input.statuses]);
    filters.push(`p.status = ANY($${params.length}::text[])`);

    if (input.sourceTypes?.length) {
      params.push([...input.sourceTypes]);
      filters.push(`p.source_type = ANY($${params.length}::text[])`);
    }

    params.push(input.limit);
    const limitParam = params.length;
    const whereSql = filters.join(" AND ");

    const result = await this.databaseService.query<StoreActionPlanRow>(
      `
        SELECT ${STORE_ACTION_PLAN_READ_COLUMNS}
        FROM ops.store_action_plan p
        ${STORE_ACTION_PLAN_READ_JOINS}
        WHERE ${whereSql}
        ORDER BY p.due_on ASC, p.updated_at DESC
        LIMIT $${limitParam}
      `,
      params,
    );

    return result.rows.map((row) => this.mapPlan(row));
  }

  async createPlan(input: {
    companyId: string;
    regionId: string;
    storeId: string;
    ownerUserId: string;
    createdByUserId: string;
    sourceType: StoreActionPlanSourceType;
    sourceId: string;
    sourceDeepLink?: string;
    sourceSnapshotRunId?: string;
    sourceKpiId?: string;
    title: string;
    summary?: string;
    priority: StoreActionPlanPriority;
    dueOn: string;
    actorDisplayName?: string;
    actorRoleLabel?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<StoreActionPlanRow>(
        `
          INSERT INTO ops.store_action_plan (
            company_id,
            region_id,
            store_id,
            owner_user_id,
            created_by_user_id,
            source_type,
            source_id,
            source_deep_link,
            source_snapshot_run_id,
            source_kpi_id,
            title,
            summary,
            priority,
            due_on
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6,
            $7,
            $8,
            $9::uuid,
            $10::uuid,
            $11,
            $12,
            $13,
            $14::date
          )
          RETURNING ${STORE_ACTION_PLAN_COLUMNS}
        `,
        [
          input.companyId,
          input.regionId,
          input.storeId,
          input.ownerUserId,
          input.createdByUserId,
          input.sourceType,
          input.sourceId,
          input.sourceDeepLink ?? null,
          input.sourceSnapshotRunId ?? null,
          input.sourceKpiId ?? null,
          input.title,
          input.summary ?? null,
          input.priority,
          input.dueOn,
        ],
      );

      const plan = this.mapPlan(result.rows[0]);
      await this.insertAuditEvent(client, {
        actorUserId: input.createdByUserId,
        eventType: storeActionPlanAuditEventTypes.created,
        plan,
        metadata: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          priority: input.priority,
          dueOn: input.dueOn,
          ...actorSnapshot(input),
        },
      });

      return plan;
    });
  }

  async updateStatus(input: {
    actionPlanId: string;
    actorUserId: string;
    expectedStatus: StoreActionPlanStatus;
    status: Exclude<StoreActionPlanStatus, "closed" | "cancelled">;
    note?: string;
    actorDisplayName?: string;
    actorRoleLabel?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<StoreActionPlanRow>(
        `
          UPDATE ops.store_action_plan
          SET
            status = $2,
            updated_at = now()
          WHERE store_action_plan_id = $1::uuid
            AND status = $3
          RETURNING ${STORE_ACTION_PLAN_COLUMNS}
        `,
        [input.actionPlanId, input.status, input.expectedStatus],
      );
      const plan = this.mapUpdatedPlan(result.rows[0]);

      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: storeActionPlanAuditEventTypes.statusUpdated,
        plan,
        metadata: {
          status: input.status,
          note: input.note ?? null,
          ...actorSnapshot(input),
        },
      });

      return plan;
    });
  }

  async closePlan(input: {
    actionPlanId: string;
    actorUserId: string;
    expectedStatus: StoreActionPlanStatus;
    resolutionNote: string;
    actorDisplayName?: string;
    actorRoleLabel?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<StoreActionPlanRow>(
        `
          UPDATE ops.store_action_plan
          SET
            status = 'closed',
            resolution_note = $2,
            closed_by_user_id = $3::uuid,
            closed_at = now(),
            updated_at = now()
          WHERE store_action_plan_id = $1::uuid
            AND status = $4
          RETURNING ${STORE_ACTION_PLAN_COLUMNS}
        `,
        [input.actionPlanId, input.resolutionNote, input.actorUserId, input.expectedStatus],
      );
      const plan = this.mapUpdatedPlan(result.rows[0]);

      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: storeActionPlanAuditEventTypes.closed,
        plan,
        metadata: {
          status: "closed",
          resolutionNote: input.resolutionNote,
          ...actorSnapshot(input),
        },
      });

      return plan;
    });
  }

  async cancelPlan(input: {
    actionPlanId: string;
    actorUserId: string;
    expectedStatus: StoreActionPlanStatus;
    cancelReason: string;
    actorDisplayName?: string;
    actorRoleLabel?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<StoreActionPlanRow>(
        `
          UPDATE ops.store_action_plan
          SET
            status = 'cancelled',
            cancel_reason = $2,
            cancelled_by_user_id = $3::uuid,
            cancelled_at = now(),
            updated_at = now()
          WHERE store_action_plan_id = $1::uuid
            AND status = $4
          RETURNING ${STORE_ACTION_PLAN_COLUMNS}
        `,
        [input.actionPlanId, input.cancelReason, input.actorUserId, input.expectedStatus],
      );
      const plan = this.mapUpdatedPlan(result.rows[0]);

      await this.insertAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: storeActionPlanAuditEventTypes.cancelled,
        plan,
        metadata: {
          status: "cancelled",
          cancelReason: input.cancelReason,
          ...actorSnapshot(input),
        },
      });

      return plan;
    });
  }

  private async insertAuditEvent(
    client: Queryable,
    input: {
      actorUserId: string;
      eventType: string;
      plan: StoreActionPlan;
      metadata: Record<string, unknown>;
    },
  ) {
    await client.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          company_id,
          region_id,
          store_id,
          metadata_json
        )
        VALUES (
          $1::uuid,
          $2,
          'ops.store_action_plan',
          $3::uuid,
          'store',
          $4::uuid,
          $5::uuid,
          $6::uuid,
          $7::jsonb
        )
      `,
      [
        input.actorUserId,
        input.eventType,
        input.plan.actionPlanId,
        input.plan.companyId,
        input.plan.regionId,
        input.plan.storeId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          ...input.metadata,
        }),
      ],
    );
  }

  private mapUpdatedPlan(row: StoreActionPlanRow | undefined) {
    if (!row) {
      throw new StoreActionPlanTransitionConflictError();
    }

    return this.mapPlan(row);
  }

  private addScopeFilters(
    filters: string[],
    params: unknown[],
    scope: {
      companyIds: readonly string[];
      regionIds: readonly string[];
      storeIds: readonly string[];
    },
    alias = "",
  ) {
    const prefix = alias ? `${alias}.` : "";
    if (scope.companyIds.length > 0) {
      params.push([...scope.companyIds]);
      filters.push(`${prefix}company_id = ANY($${params.length}::uuid[])`);
    }

    if (scope.regionIds.length > 0) {
      params.push([...scope.regionIds]);
      filters.push(`${prefix}region_id = ANY($${params.length}::uuid[])`);
    }

    if (scope.storeIds.length > 0) {
      params.push([...scope.storeIds]);
      filters.push(`${prefix}store_id = ANY($${params.length}::uuid[])`);
    }
  }

  private mapPlan(row: StoreActionPlanRow): StoreActionPlan {
    return {
      actionPlanId: row.store_action_plan_id,
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
      storeName: row.store_name ?? null,
      ownerUserId: row.owner_user_id,
      ownerDisplayName: row.owner_display_name ?? null,
      createdByUserId: row.created_by_user_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceDeepLink: row.source_deep_link,
      sourceSnapshotRunId: row.source_snapshot_run_id,
      sourceKpiId: row.source_kpi_id,
      title: row.title,
      summary: row.summary,
      priority: row.priority,
      status: row.status,
      dueOn: row.due_on,
      resolutionNote: row.resolution_note,
      closedByUserId: row.closed_by_user_id,
      closedAt: row.closed_at,
      cancelReason: row.cancel_reason,
      cancelledByUserId: row.cancelled_by_user_id,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function actorSnapshot(input: { actorDisplayName?: string; actorRoleLabel?: string }) {
  return {
    ...(input.actorDisplayName ? { actorDisplayName: input.actorDisplayName } : {}),
    ...(input.actorRoleLabel ? { actorRoleLabel: input.actorRoleLabel } : {}),
  };
}
