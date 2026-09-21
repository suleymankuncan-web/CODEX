import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class PersonnelMasterReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPersonnelMaster(input: {
    actorCompanyIds: string[];
    q?: string;
    status?: "active" | "inactive" | "terminated";
    storeId?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = ["e.company_id = ANY($1::uuid[])"];
    const params: unknown[] = [input.actorCompanyIds];

    const search = input.q?.trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        e.external_employee_ref ILIKE $${params.length}
        OR e.first_name ILIKE $${params.length}
        OR e.last_name ILIKE $${params.length}
        OR CONCAT(e.first_name, ' ', e.last_name) ILIKE $${params.length}
        OR e.national_id_last4 ILIKE $${params.length}
        OR e.phone_number ILIKE $${params.length}
        OR s.store_name ILIKE $${params.length}
        OR s.store_code ILIKE $${params.length}
        OR p.position_name ILIKE $${params.length}
      )`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`e.employment_status = $${params.length}`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      conditions.push(`assignment.store_id = $${params.length}::uuid`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const fromClause = `
      FROM ops.employee e
      LEFT JOIN LATERAL (
        SELECT
          eah.assignment_id,
          eah.store_id,
          eah.region_id,
          eah.position_id,
          eah.start_date,
          eah.updated_at
        FROM ops.employee_assignment_history eah
        WHERE eah.employee_id = e.employee_id
          AND eah.is_primary_assignment = TRUE
          AND eah.assignment_status = 'active'
          AND eah.end_date IS NULL
        ORDER BY eah.start_date DESC, eah.created_at DESC
        LIMIT 1
      ) assignment ON TRUE
      LEFT JOIN ops.store s
        ON s.store_id = assignment.store_id
      LEFT JOIN ops.region r
        ON r.region_id = assignment.region_id
      LEFT JOIN ops.position p
        ON p.position_id = assignment.position_id
    `;
    const accountFromClause = `
      LEFT JOIN LATERAL (
        SELECT
          ua.user_id,
          ua.is_active,
          identity_job.status AS identity_status
        FROM ops.user_account ua
        LEFT JOIN LATERAL (
          SELECT job.status
          FROM ops.identity_lifecycle_job job
          WHERE job.user_id = ua.user_id
          ORDER BY job.created_at DESC, job.identity_lifecycle_job_id DESC
          LIMIT 1
        ) identity_job ON TRUE
        WHERE ua.employee_id = e.employee_id
        ORDER BY ua.is_active DESC, ua.updated_at DESC, ua.created_at DESC
        LIMIT 1
      ) account ON TRUE
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        ${fromClause}
        ${whereClause}
      `,
      params,
    );

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const listParams = [...params, limit, offset];
    const result = await this.databaseService.query<{
      employee_id: string;
      external_employee_ref: string | null;
      first_name: string;
      last_name: string;
      national_id_last4: string | null;
      phone_number: string | null;
      hire_date: string;
      termination_date: string | null;
      employment_status: string;
      employment_type: string;
      assignment_id: string | null;
      assignment_start_date: string | null;
      store_id: string | null;
      store_code: string | null;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      position_id: string | null;
      position_code: string | null;
      position_name: string | null;
      account_status: "none" | "pending" | "active" | "inactive" | "failed";
      updated_at: string;
    }>(
      `
        SELECT
          e.employee_id::text AS employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          e.national_id_last4,
          e.phone_number,
          e.hire_date::text AS hire_date,
          e.termination_date::text AS termination_date,
          e.employment_status,
          e.employment_type,
          assignment.assignment_id::text AS assignment_id,
          assignment.start_date::text AS assignment_start_date,
          s.store_id::text AS store_id,
          s.store_code,
          s.store_name,
          r.region_id::text AS region_id,
          r.region_name,
          p.position_id::text AS position_id,
          p.position_code,
          p.position_name,
          CASE
            WHEN account.user_id IS NULL THEN 'none'
            WHEN account.identity_status = 'failed' THEN 'failed'
            WHEN account.identity_status IN ('pending', 'processing') THEN 'pending'
            WHEN account.is_active = FALSE THEN 'inactive'
            ELSE 'active'
          END AS account_status,
          GREATEST(
            e.updated_at,
            COALESCE(assignment.updated_at, e.updated_at)
          )::text AS updated_at
        ${fromClause}
        ${accountFromClause}
        ${whereClause}
        ORDER BY e.first_name ASC, e.last_name ASC, e.external_employee_ref ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async listPersonnelMasterLookups(input: { actorCompanyIds: string[] }) {
    const [stores, positions] = await Promise.all([
      this.databaseService.query<{
        store_id: string;
        store_code: string;
        store_name: string;
        region_id: string;
        region_name: string;
      }>(
        `
          SELECT
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name
          FROM ops.store s
          INNER JOIN ops.region r
            ON r.region_id = s.region_id
          WHERE s.company_id = ANY($1::uuid[])
            AND s.status = 'active'
          ORDER BY s.store_name ASC, s.store_code ASC
        `,
        [input.actorCompanyIds],
      ),
      this.databaseService.query<{
        position_id: string;
        position_code: string;
        position_name: string;
        is_managerial: boolean;
      }>(
        `
          SELECT
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name,
            p.is_managerial
          FROM ops.position p
          WHERE p.company_id = ANY($1::uuid[])
            AND p.position_code IN (
              'STORE_MANAGER',
              'ASSISTANT_MANAGER',
              'SENIOR_SALES_CONSULTANT',
              'SALES_ASSOCIATE',
              'CASHIER', 'WAREHOUSE_SUPERVISOR'
            )
          ORDER BY p.is_managerial DESC, p.position_name ASC, p.position_code ASC
        `,
        [input.actorCompanyIds],
      ),
    ]);

    return {
      stores: stores.rows,
      positions: positions.rows,
    };
  }
}
