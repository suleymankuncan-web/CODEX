import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type RequestCenterRequestType = "target" | "sellerCode" | "offboarding";

export type RequestCenterReadRow = {
  request_id: string;
  request_type: RequestCenterRequestType;
  store_id: string;
  store_name: string | null;
  request_status: string;
  updated_at: string;
  target_label: string | null;
  request_month: string | null;
  allocation_count: number | null;
  approval_mode: "direct" | "adjusted" | null;
  person_display_name: string | null;
  national_id_last4: string | null;
  external_employee_ref: string | null;
};

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
      scopeClauses.push(
        `updated_at >= $${params.length}::date AND ` +
          `updated_at < ($${params.length}::date + INTERVAL '1 month')`,
      );
    }

    if (input.query) {
      params.push(`%${escapeLikePattern(input.query)}%`);
      scopeClauses.push(`search_text ILIKE $${params.length} ESCAPE '\\'`);
    }

    const requestRowsSql = this.buildRequestRowsSql(input.type);
    const scopeWhereSql = scopeClauses.join(" AND ");
    const selectionWhereSql = selectionClauses.join(" AND ");
    const whereSql = `${scopeWhereSql} AND ${selectionWhereSql}`;
    const countResult = await this.databaseService.query<{
      total_count: string;
      open_count: string;
      done_count: string;
      returned_count: string;
    }>(
      `
        WITH request_rows AS (
          ${requestRowsSql}
        )
        SELECT
          COUNT(*) FILTER (WHERE ${selectionWhereSql})::text AS total_count,
          COUNT(*) FILTER (WHERE request_status <> 'approved')::text AS open_count,
          COUNT(*) FILTER (WHERE request_status = 'approved')::text AS done_count,
          COUNT(*) FILTER (WHERE request_status = 'rejected')::text AS returned_count
        FROM request_rows
        WHERE ${scopeWhereSql}
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
        )
        SELECT
          request_id,
          request_type,
          store_id,
          store_name,
          request_status,
          updated_at,
          target_label,
          request_month,
          allocation_count,
          approval_mode,
          person_display_name,
          national_id_last4,
          external_employee_ref
        FROM request_rows
        WHERE ${whereSql}
        ORDER BY updated_at DESC, request_type ASC, request_id DESC
        LIMIT $${limitParameter}::int
        OFFSET $${offsetParameter}::int
      `,
      pageParams,
    );

    return {
      items: pageResult.rows,
      total: Number(countResult.rows[0]?.total_count ?? 0),
      summary: {
        open: Number(countResult.rows[0]?.open_count ?? 0),
        done: Number(countResult.rows[0]?.done_count ?? 0),
        returned: Number(countResult.rows[0]?.returned_count ?? 0),
      },
      limit: input.limit,
      offset: input.offset,
    };
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

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
