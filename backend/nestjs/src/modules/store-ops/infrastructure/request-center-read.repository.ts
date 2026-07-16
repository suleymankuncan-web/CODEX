import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { REQUEST_CENTER_SLA_POLICY } from "../application/request-center-sla-policy";

export type RequestCenterRequestType = "target" | "sellerCode" | "offboarding";

export type RequestCenterReadRow = {
  request_id: string;
  request_type: RequestCenterRequestType;
  store_id: string;
  store_name: string | null;
  region_id: string;
  region_name: string | null;
  region_manager_names: string[];
  request_status: string;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
  target_label: string | null;
  request_month: string | null;
  allocation_count: number | null;
  approval_mode: "direct" | "adjusted" | null;
  person_display_name: string | null;
  national_id_last4: string | null;
  external_employee_ref: string | null;
};

export type RequestCenterAuditRow = {
  request_id: string;
  event_id: string;
  event_type: string;
  occurred_at: string;
  actor_display_name: string | null;
  event_total: string;
};

const requestCenterAuditEventTypes = [
  "target_distribution_request.created",
  "target_distribution_request.approved",
  "seller_code_request.created",
  "seller_code_request.approved",
  "seller_code_request.rejected",
  "seller_code_request.resubmitted",
  "employee_offboarding_request.created",
  "employee_offboarding_request.approved",
  "employee_offboarding_request.rejected",
  "employee_offboarding_request.resubmitted",
] as const;

type RequestCenterListInput = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  bucket: "open" | "done";
  type: "all" | RequestCenterRequestType;
  status: "all" | "pending" | "returned" | "approved";
  period?: string;
  storeId?: string;
  query?: string;
  limit: number;
  offset: number;
};

const targetRequestBranch = `
  SELECT
    tdr.target_distribution_request_id::text AS request_id,
    'target'::text AS request_type,
    tdr.company_id,
    tdr.region_id,
    tdr.store_id,
    s.store_name,
    tdr.request_status,
    'ops.target_distribution_request'::text AS entity_name,
    tdr.created_at,
    tdr.approved_at AS reviewed_at,
    tdr.updated_at,
    tdr.target_label,
    tdr.request_month::text AS request_month,
    tdr.allocation_count,
    CASE
      WHEN tdr.approval_evidence_json->>'approvalMode' IN ('direct', 'adjusted')
        THEN tdr.approval_evidence_json->>'approvalMode'
      ELSE NULL
    END AS approval_mode,
    NULL::text AS person_display_name,
    NULL::text AS national_id_last4,
    NULL::text AS external_employee_ref,
    CONCAT_WS(' ', tdr.target_label, s.store_name) AS search_text
  FROM ops.target_distribution_request tdr
  INNER JOIN ops.store s
    ON s.store_id = tdr.store_id
`;

const sellerCodeRequestBranch = `
  SELECT
    scr.seller_code_request_id::text AS request_id,
    'sellerCode'::text AS request_type,
    scr.company_id,
    scr.region_id,
    scr.store_id,
    s.store_name,
    scr.request_status,
    'ops.seller_code_request'::text AS entity_name,
    scr.created_at,
    scr.reviewed_at,
    scr.updated_at,
    NULL::text AS target_label,
    NULL::text AS request_month,
    NULL::integer AS allocation_count,
    NULL::text AS approval_mode,
    NULLIF(BTRIM(CONCAT_WS(' ', scr.first_name, scr.last_name)), '') AS person_display_name,
    scr.national_id_last4,
    NULL::text AS external_employee_ref,
    CONCAT_WS(' ', scr.first_name, scr.last_name, scr.national_id_last4, s.store_name)
      AS search_text
  FROM ops.seller_code_request scr
  INNER JOIN ops.store s
    ON s.store_id = scr.store_id
`;

const offboardingRequestBranch = `
  SELECT
    eor.offboarding_request_id::text AS request_id,
    'offboarding'::text AS request_type,
    eor.company_id,
    eor.region_id,
    eor.store_id,
    s.store_name,
    eor.request_status,
    'ops.employee_offboarding_request'::text AS entity_name,
    eor.created_at,
    eor.reviewed_at,
    eor.updated_at,
    NULL::text AS target_label,
    NULL::text AS request_month,
    NULL::integer AS allocation_count,
    NULL::text AS approval_mode,
    NULLIF(BTRIM(CONCAT_WS(' ', e.first_name, e.last_name)), '') AS person_display_name,
    NULL::text AS national_id_last4,
    e.external_employee_ref,
    CONCAT_WS(' ', e.first_name, e.last_name, e.external_employee_ref, s.store_name)
      AS search_text
  FROM ops.employee_offboarding_request eor
  INNER JOIN ops.store s
    ON s.store_id = eor.store_id
  INNER JOIN ops.employee e
    ON e.employee_id = eor.employee_id
`;

@Injectable()
export class RequestCenterReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRequests(input: RequestCenterListInput) {
    const params: unknown[] = [];
    const scopeClauses: string[] = [];
    const periodClauses: string[] = [];
    const selectionClauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      scopeClauses.push(`store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      scopeClauses.push(`region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      scopeClauses.push(`company_id = ANY($${params.length}::uuid[])`);
    } else {
      scopeClauses.push("FALSE");
    }

    if (input.storeId) {
      params.push(input.storeId);
      scopeClauses.push(`store_id = $${params.length}::uuid`);
    }

    selectionClauses.push(
      input.bucket === "done"
        ? "request_status = 'approved'"
        : "request_status <> 'approved'",
    );

    if (input.status === "pending") {
      selectionClauses.push("request_status NOT IN ('approved', 'rejected')");
    } else if (input.status === "returned") {
      selectionClauses.push("request_status = 'rejected'");
    } else if (input.status === "approved") {
      selectionClauses.push("request_status = 'approved'");
    }

    if (input.period) {
      params.push(`${input.period}-01`);
      periodClauses.push(
        `updated_at >= ($${params.length}::date::timestamp ` +
          `AT TIME ZONE 'Europe/Istanbul') AND ` +
          `updated_at < (($${params.length}::date + INTERVAL '1 month')::timestamp ` +
          `AT TIME ZONE 'Europe/Istanbul')`,
      );
    }

    if (input.query) {
      params.push(`%${escapeLikePattern(input.query)}%`);
      scopeClauses.push(`search_text ILIKE $${params.length} ESCAPE '\\'`);
    }

    const requestRowsSql = this.buildRequestRowsSql(input.type);
    const scopeWhereSql = scopeClauses.join(" AND ");
    const periodWhereSql = periodClauses.join(" AND ") || "TRUE";
    const selectionWhereSql = selectionClauses.join(" AND ");
    const whereSql = `${scopeWhereSql} AND ${periodWhereSql} AND ${selectionWhereSql}`;
    const countResult = await this.databaseService.query<{
      total_count: string;
      open_count: string;
      done_count: string;
      returned_count: string;
      overdue_count: string;
      available_periods: string[] | null;
    }>(
      `
        WITH request_rows AS (
          ${requestRowsSql}
        ), scoped_rows AS (
          SELECT *
          FROM request_rows
          WHERE ${scopeWhereSql}
        ), timing_rows AS (
          SELECT
            scoped_rows.*,
            CASE
              WHEN request_status = 'approved' THEN NULL
              WHEN request_type = 'target' AND request_status = 'pending_region_approval'
                THEN created_at
              WHEN request_status = 'pending_hr_approval' THEN COALESCE(
                (
                  SELECT MAX(event.occurred_at)
                  FROM audit.event_log AS event
                  WHERE event.entity_name = scoped_rows.entity_name
                    AND event.entity_id = scoped_rows.request_id::uuid
                    AND event.event_type IN (
                      'seller_code_request.created',
                      'seller_code_request.resubmitted',
                      'employee_offboarding_request.created',
                      'employee_offboarding_request.resubmitted'
                    )
                ),
                created_at
              )
              WHEN request_type = 'target' AND request_status = 'rejected' THEN reviewed_at
              WHEN request_type <> 'target' AND request_status = 'rejected' THEN COALESCE(
                (
                  SELECT MAX(event.occurred_at)
                  FROM audit.event_log AS event
                  WHERE event.entity_name = scoped_rows.entity_name
                    AND event.entity_id = scoped_rows.request_id::uuid
                    AND event.event_type IN (
                      'seller_code_request.rejected',
                      'employee_offboarding_request.rejected'
                    )
                ),
                reviewed_at
              )
              ELSE NULL
            END AS waiting_since
          FROM scoped_rows
        )
        SELECT
          COUNT(*) FILTER (WHERE ${selectionWhereSql})::text AS total_count,
          COUNT(*) FILTER (WHERE request_status <> 'approved')::text AS open_count,
          COUNT(*) FILTER (WHERE request_status = 'approved')::text AS done_count,
          COUNT(*) FILTER (WHERE request_status = 'rejected')::text AS returned_count,
          COUNT(*) FILTER (WHERE
            (request_type = 'target' AND request_status = 'pending_region_approval'
              AND CURRENT_TIMESTAMP >= waiting_since + INTERVAL '${REQUEST_CENTER_SLA_POLICY.targetPendingRegionDays} days')
            OR (request_type <> 'target' AND request_status = 'pending_hr_approval'
              AND CURRENT_TIMESTAMP >= waiting_since + INTERVAL '${REQUEST_CENTER_SLA_POLICY.workforcePendingHrDays} days')
            OR (request_type <> 'target' AND request_status = 'rejected'
              AND CURRENT_TIMESTAMP >= waiting_since + INTERVAL '${REQUEST_CENTER_SLA_POLICY.workforceReturnedStoreDays} days')
          )::text AS overdue_count,
          (SELECT COALESCE(
             ARRAY_AGG(
               DISTINCT TO_CHAR(updated_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM')
               ORDER BY TO_CHAR(updated_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') DESC
             ),
             ARRAY[]::text[]
           ) FROM scoped_rows) AS available_periods
        FROM timing_rows
        WHERE ${periodWhereSql}
      `,
      params,
    );

    const pageParams = [...params, input.limit, input.offset];
    const limitParameter = pageParams.length - 1;
    const offsetParameter = pageParams.length;
    const pageResult = await this.databaseService.query<RequestCenterReadRow>(
      `
        WITH request_rows AS (
          ${requestRowsSql}
        ), filtered_rows AS (
          SELECT * FROM request_rows WHERE ${whereSql}
        )
        SELECT
          rr.request_id,
          rr.request_type,
          rr.store_id,
          rr.store_name,
          rr.region_id,
          region.region_name,
          COALESCE(region_managers.display_names, ARRAY[]::text[]) AS region_manager_names,
          rr.request_status,
          rr.created_at,
          rr.reviewed_at,
          rr.updated_at,
          rr.target_label,
          rr.request_month,
          rr.allocation_count,
          rr.approval_mode,
          rr.person_display_name,
          rr.national_id_last4,
          rr.external_employee_ref
        FROM filtered_rows rr
        LEFT JOIN ops.region region ON region.region_id = rr.region_id
        LEFT JOIN LATERAL (
          SELECT ARRAY_AGG(manager.display_name ORDER BY manager.display_name, manager.user_id)
            AS display_names
          FROM (
            SELECT DISTINCT
              account.user_id::text AS user_id,
              COALESCE(
                NULLIF(BTRIM(CONCAT_WS(' ', employee.first_name, employee.last_name)), ''),
                account.username,
                account.email,
                account.user_id::text
              ) AS display_name
            FROM ops.user_role_assignment assignment
            INNER JOIN ops.role role
              ON role.role_id = assignment.role_id
              AND role.role_code = 'REGION_MANAGER'
            INNER JOIN ops.user_account account
              ON account.user_id = assignment.user_id
              AND account.is_active = TRUE
            LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
            WHERE assignment.region_id = rr.region_id
              AND assignment.start_at <= CURRENT_TIMESTAMP
              AND (assignment.end_at IS NULL OR assignment.end_at >= CURRENT_TIMESTAMP)
          ) manager
        ) region_managers ON TRUE
        ORDER BY rr.updated_at DESC, rr.request_type ASC, rr.request_id DESC
        LIMIT $${limitParameter}::int
        OFFSET $${offsetParameter}::int
      `,
      pageParams,
    );

    const events = pageResult.rows.length > 0
      ? await this.listPageEvents(pageResult.rows)
      : [];
    const eventsByRequest = new Map<string, RequestCenterAuditRow[]>();
    for (const event of events) {
      const requestEvents = eventsByRequest.get(event.request_id) ?? [];
      requestEvents.push(event);
      eventsByRequest.set(event.request_id, requestEvents);
    }

    return {
      items: pageResult.rows.map((row) => ({
        ...row,
        events: eventsByRequest.get(row.request_id) ?? [],
        event_total: Number(eventsByRequest.get(row.request_id)?.[0]?.event_total ?? 0),
      })),
      total: Number(countResult.rows[0]?.total_count ?? 0),
      summary: {
        open: Number(countResult.rows[0]?.open_count ?? 0),
        done: Number(countResult.rows[0]?.done_count ?? 0),
        returned: Number(countResult.rows[0]?.returned_count ?? 0),
        overdue: Number(countResult.rows[0]?.overdue_count ?? 0),
        periods: countResult.rows[0]?.available_periods ?? [],
      },
      limit: input.limit,
      offset: input.offset,
    };
  }

  private async listPageEvents(rows: RequestCenterReadRow[]) {
    const entityNames = rows.map((row) => requestEntityName(row.request_type));
    const entityIds = rows.map((row) => row.request_id);
    const result = await this.databaseService.query<RequestCenterAuditRow>(
      `
        WITH requested(entity_name, entity_id) AS (
          SELECT * FROM UNNEST($1::text[], $2::uuid[])
        ), ranked_events AS (
          SELECT
            event.entity_id::text AS request_id,
            event.event_log_id::text AS event_id,
            event.event_type,
            event.occurred_at,
            NULLIF(BTRIM(CONCAT_WS(' ', employee.first_name, employee.last_name)), '')
              AS actor_display_name,
            COUNT(*) OVER (PARTITION BY event.entity_name, event.entity_id)::text
              AS event_total,
            ROW_NUMBER() OVER (
              PARTITION BY event.entity_name, event.entity_id
              ORDER BY event.occurred_at DESC, event.event_log_id DESC
            ) AS event_rank
          FROM requested
          INNER JOIN audit.event_log AS event
            ON event.entity_name = requested.entity_name
            AND event.entity_id = requested.entity_id
          LEFT JOIN ops.user_account AS account ON account.user_id = event.actor_user_id
          LEFT JOIN ops.employee AS employee ON employee.employee_id = account.employee_id
          WHERE event.event_type = ANY($3::text[])
        )
        SELECT request_id, event_id, event_type, occurred_at, actor_display_name, event_total
        FROM ranked_events
        WHERE event_rank <= 20
        ORDER BY request_id ASC, occurred_at ASC, event_id ASC
      `,
      [entityNames, entityIds, [...requestCenterAuditEventTypes]],
    );
    return result.rows;
  }

  private buildRequestRowsSql(type: RequestCenterListInput["type"]) {
    if (type === "target") {
      return targetRequestBranch;
    }
    if (type === "sellerCode") {
      return sellerCodeRequestBranch;
    }
    if (type === "offboarding") {
      return offboardingRequestBranch;
    }
    return [
      targetRequestBranch,
      sellerCodeRequestBranch,
      offboardingRequestBranch,
    ].join("\nUNION ALL\n");
  }
}

function requestEntityName(type: RequestCenterRequestType) {
  if (type === "target") return "ops.target_distribution_request";
  if (type === "sellerCode") return "ops.seller_code_request";
  return "ops.employee_offboarding_request";
}

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
