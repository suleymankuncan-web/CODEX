import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  TaskCommandAuditEvent,
  TaskCommandWorkspaceItem,
} from "../application/task-command-workspace.contract";
import {
  StoreActionPlanPriority,
  StoreActionPlanSourceType,
  StoreActionPlanStatus,
} from "../application/store-action-plan.contract";

type PlanRow = {
  store_action_plan_id: string;
  store_id: string;
  store_name: string | null;
  source_type: StoreActionPlanSourceType;
  source_id: string;
  source_deep_link: string | null;
  title: string;
  summary: string | null;
  priority: StoreActionPlanPriority;
  status: StoreActionPlanStatus;
  due_on: string;
  resolution_note: string | null;
  cancel_reason: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type AuditRow = {
  event_log_id: string;
  entity_id: string;
  event_type: string;
  occurred_at: string;
  actor_display_name: string | null;
  actor_role_label: string | null;
  note: string | null;
  event_total: number;
};

@Injectable()
export class TaskCommandWorkspaceReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async readPage(input: {
    companyIds: readonly string[];
    regionIds: readonly string[];
    storeIds: readonly string[];
    statuses: readonly StoreActionPlanStatus[];
    periodStart: string;
    periodEnd: string;
    limit: number;
    offset: number;
    eventLimit: number;
  }) {
    const params: unknown[] = [];
    const filters = this.scopeFilters(params, input);
    params.push([...input.statuses]);
    filters.push(`p.status = ANY($${params.length}::text[])`);
    params.push(input.periodStart);
    const periodStartParam = params.length;
    params.push(input.periodEnd);
    const periodEndParam = params.length;
    filters.push(`(
      p.due_on BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
      OR (p.closed_at AT TIME ZONE 'Europe/Istanbul')::date BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
      OR (p.cancelled_at AT TIME ZONE 'Europe/Istanbul')::date BETWEEN $${periodStartParam}::date AND $${periodEndParam}::date
      OR (p.status IN ('open', 'in_progress', 'blocked') AND p.due_on < $${periodStartParam}::date)
    )`);
    const whereSql = filters.join(" AND ");
    const countResult = await this.databaseService.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM ops.store_action_plan p WHERE ${whereSql}`,
      params,
    );
    const pageParams = [...params, input.limit, input.offset];
    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const pageResult = await this.databaseService.query<PlanRow>(
      `
        SELECT
          p.store_action_plan_id,
          p.store_id,
          s.store_name,
          p.source_type,
          p.source_id,
          p.source_deep_link,
          p.title,
          p.summary,
          p.priority,
          p.status,
          p.due_on,
          p.resolution_note,
          p.cancel_reason,
          p.closed_at,
          p.cancelled_at,
          p.created_at,
          p.updated_at
        FROM ops.store_action_plan p
        INNER JOIN ops.store s ON s.store_id = p.store_id
        WHERE ${whereSql}
        ORDER BY COALESCE(p.closed_at, p.cancelled_at, p.updated_at) DESC, p.store_action_plan_id
        LIMIT $${limitParam}
        OFFSET $${offsetParam}
      `,
      pageParams,
    );
    const eventsByPlan = await this.readEventPreview(
      pageResult.rows.map((row) => row.store_action_plan_id),
      input.eventLimit,
    );
    return {
      items: pageResult.rows.map((row) => this.mapPlan(row, eventsByPlan.get(row.store_action_plan_id))),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async readEvents(input: {
    actionPlanId: string;
    companyIds: readonly string[];
    regionIds: readonly string[];
    storeIds: readonly string[];
    statuses: readonly StoreActionPlanStatus[];
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [input.actionPlanId];
    const scopeFilters = this.scopeFilters(params, input, "p");
    params.push([...input.statuses]);
    const statusesParam = params.length;
    const planResult = await this.databaseService.query<{ action_plan_id: string; event_total: number }>(
      `
        SELECT
          p.store_action_plan_id AS action_plan_id,
          (
            SELECT COUNT(*)::int
            FROM audit.event_log event
            WHERE event.entity_name = 'ops.store_action_plan'
              AND event.entity_id = p.store_action_plan_id
              AND event.event_type IN (
                'store_action_plan.created',
                'store_action_plan.status_updated',
                'store_action_plan.closed',
                'store_action_plan.cancelled'
              )
          ) AS event_total
        FROM ops.store_action_plan p
        WHERE p.store_action_plan_id = $1::uuid
          AND ${scopeFilters.join(" AND ")}
          AND p.status = ANY($${statusesParam}::text[])
      `,
      params,
    );
    if (!planResult.rows[0]) return null;
    const events = await this.queryEvents([input.actionPlanId], input.limit, input.offset);
    return {
      items: events.map((row) => this.mapEvent(row)),
      total: Number(planResult.rows[0].event_total),
      limit: input.limit,
      offset: input.offset,
    };
  }

  private async readEventPreview(actionPlanIds: readonly string[], limit: number) {
    if (actionPlanIds.length === 0) return new Map<string, { items: TaskCommandAuditEvent[]; total: number }>();
    const rows = await this.queryEvents(actionPlanIds, limit, 0);
    const result = new Map<string, { items: TaskCommandAuditEvent[]; total: number }>();
    for (const row of rows) {
      const current = result.get(row.entity_id) ?? { items: [], total: Number(row.event_total) };
      current.items.push(this.mapEvent(row));
      result.set(row.entity_id, current);
    }
    return result;
  }

  private async queryEvents(actionPlanIds: readonly string[], limit: number, offset: number) {
    const result = await this.databaseService.query<AuditRow>(
      `
        WITH ranked_events AS (
          SELECT
            event.event_log_id,
            event.entity_id,
            event.event_type,
            event.occurred_at,
            COALESCE(
              NULLIF(event.metadata_json ->> 'actorDisplayName', ''),
              NULLIF(BTRIM(CONCAT_WS(' ', employee.first_name, employee.last_name)), ''),
              'Operasyon kullanıcısı'
            ) AS actor_display_name,
            COALESCE(
              NULLIF(event.metadata_json ->> 'actorRoleLabel', ''),
              historical_role.role_name
            ) AS actor_role_label,
            COALESCE(
              NULLIF(event.metadata_json ->> 'resolutionNote', ''),
              NULLIF(event.metadata_json ->> 'cancelReason', ''),
              NULLIF(event.metadata_json ->> 'note', '')
            ) AS note,
            COUNT(*) OVER (PARTITION BY event.entity_id)::int AS event_total,
            ROW_NUMBER() OVER (
              PARTITION BY event.entity_id
              ORDER BY event.occurred_at DESC, event.event_log_id DESC
            ) AS event_rank
          FROM audit.event_log event
          LEFT JOIN ops.user_account account ON account.user_id = event.actor_user_id
          LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
          LEFT JOIN LATERAL (
            SELECT role.role_name
            FROM ops.user_role_assignment assignment
            INNER JOIN ops.role role ON role.role_id = assignment.role_id
            WHERE assignment.user_id = event.actor_user_id
              AND assignment.start_at <= event.occurred_at
              AND (assignment.end_at IS NULL OR assignment.end_at >= event.occurred_at)
            ORDER BY assignment.start_at DESC
            LIMIT 1
          ) historical_role ON TRUE
          WHERE event.entity_name = 'ops.store_action_plan'
            AND event.entity_id = ANY($1::uuid[])
            AND event.event_type IN (
              'store_action_plan.created',
              'store_action_plan.status_updated',
              'store_action_plan.closed',
              'store_action_plan.cancelled'
            )
        )
        SELECT
          event_log_id,
          entity_id,
          event_type,
          occurred_at,
          actor_display_name,
          actor_role_label,
          note,
          event_total
        FROM ranked_events
        WHERE event_rank > $3
          AND event_rank <= ($3 + $2)
        ORDER BY entity_id, occurred_at DESC, event_log_id DESC
      `,
      [[...actionPlanIds], limit, offset],
    );
    return result.rows;
  }

  private scopeFilters(
    params: unknown[],
    input: { companyIds: readonly string[]; regionIds: readonly string[]; storeIds: readonly string[] },
    alias = "p",
  ) {
    if (input.companyIds.length > 0) {
      params.push([...input.companyIds]);
      return [`${alias}.company_id = ANY($${params.length}::uuid[])`];
    }
    const alternatives: string[] = [];
    if (input.regionIds.length > 0) {
      params.push([...input.regionIds]);
      alternatives.push(`${alias}.region_id = ANY($${params.length}::uuid[])`);
    }
    if (input.storeIds.length > 0) {
      params.push([...input.storeIds]);
      alternatives.push(`${alias}.store_id = ANY($${params.length}::uuid[])`);
    }
    return [`(${alternatives.join(" OR ")})`];
  }

  private mapPlan(
    row: PlanRow,
    events: { items: TaskCommandAuditEvent[]; total: number } | undefined,
  ): TaskCommandWorkspaceItem {
    const eventItems = events?.items ?? [];
    const eventTotal = events?.total ?? 0;
    return {
      actionPlanId: row.store_action_plan_id,
      storeId: row.store_id,
      storeName: row.store_name,
      title: row.title,
      summary: row.summary,
      priority: row.priority,
      status: row.status,
      dueOn: row.due_on,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.closed_at ?? row.cancelled_at,
      resultNote: row.resolution_note ?? row.cancel_reason,
      source: {
        type: row.source_type,
        id: row.source_id,
        deepLink: safeSourceDeepLink(row.source_type, row.source_deep_link),
      },
      events: {
        items: eventItems,
        total: eventTotal,
        limit: eventItems.length,
        hasMore: eventTotal > eventItems.length,
      },
    };
  }

  private mapEvent(row: AuditRow): TaskCommandAuditEvent {
    return {
      eventId: row.event_log_id,
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      actorDisplayName: row.actor_display_name ?? "Operasyon kullanıcısı",
      actorRoleLabel: row.actor_role_label,
      note: row.note,
    };
  }
}

function safeSourceDeepLink(sourceType: StoreActionPlanSourceType, candidate: string | null) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;
  const expectedRoute = sourceType === "checklist_remediation" ? "/store/checklists" : "/store/kpis";
  return isApprovedSource(candidate, expectedRoute) ? candidate : null;
}

function isApprovedSource(candidate: string, route: string) {
  return candidate === route || candidate.startsWith(`${route}?`);
}
