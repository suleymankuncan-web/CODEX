import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class KpiImportStoreReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listKpiImportStoreExternalRefs(input: {
    integrationSourceId: string;
    actorCompanyIds: string[];
  }) {
    const result = await this.databaseService.query<{ external_ref: string }>(
      `
        SELECT DISTINCT external_ref
        FROM (
          SELECT s.store_name AS external_ref
          FROM ops.store s
          WHERE s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])

          UNION

          SELECT s.store_code AS external_ref
          FROM ops.store s
          WHERE s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])

          UNION

          SELECT map.external_id AS external_ref
          FROM stg.external_id_map map
          INNER JOIN ops.store s
            ON s.store_id = map.internal_id
          WHERE map.integration_source_id = $1::uuid
            AND map.entity_type = 'store'
            AND map.is_active = TRUE
            AND s.status = 'active'
            AND s.kpi_import_enabled = TRUE
            AND s.company_id = ANY($2::uuid[])
        ) refs
        WHERE external_ref IS NOT NULL
          AND BTRIM(external_ref) <> ''
        ORDER BY external_ref ASC
      `,
      [input.integrationSourceId, input.actorCompanyIds],
    );

    return result.rows;
  }

  async listKpiImportStoreScope(input: {
    actorCompanyIds: string[];
    q?: string;
    enabled?: boolean;
    status?: "active" | "inactive" | "closed";
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = ["s.company_id = ANY($1::uuid[])"];
    const params: unknown[] = [input.actorCompanyIds];

    const search = input.q?.trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        s.store_name ILIKE $${params.length}
        OR s.store_code ILIKE $${params.length}
        OR r.region_name ILIKE $${params.length}
        OR region_manager.region_manager_name ILIKE $${params.length}
        OR region_manager.region_manager_email ILIKE $${params.length}
      )`);
    }

    if (typeof input.enabled === "boolean") {
      params.push(input.enabled);
      conditions.push(`s.kpi_import_enabled = $${params.length}`);
    }

    if (input.status) {
      params.push(input.status);
      conditions.push(`s.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const fromClause = `
      FROM ops.store s
      LEFT JOIN ops.region r
        ON r.region_id = s.region_id
      LEFT JOIN LATERAL (
        SELECT
          manager_store.user_id::text AS region_manager_user_id,
          COALESCE(
            NULLIF(BTRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
            NULLIF(BTRIM(ua.username), ''),
            ua.email
          ) AS region_manager_name,
          ua.email AS region_manager_email
        FROM ops.user_action_store_assignment manager_store
        INNER JOIN ops.user_account ua
          ON ua.user_id = manager_store.user_id
          AND ua.is_active = TRUE
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        WHERE manager_store.store_id = s.store_id
          AND manager_store.start_at <= NOW()
          AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
          AND EXISTS (
            SELECT 1
            FROM ops.user_role_assignment manager_role
            INNER JOIN ops.role role
              ON role.role_id = manager_role.role_id
              AND role.role_code = 'REGION_MANAGER'
            WHERE manager_role.user_id = manager_store.user_id
              AND manager_role.start_at <= NOW()
              AND (manager_role.end_at IS NULL OR manager_role.end_at > NOW())
          )
        ORDER BY manager_store.start_at DESC, manager_store.created_at DESC, ua.user_id ASC
        LIMIT 1
      ) region_manager ON TRUE
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
      store_id: string;
      store_code: string;
      store_name: string;
      store_type: string;
      status: string;
      kpi_import_enabled: boolean;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      updated_at: string;
    }>(
      `
        SELECT
          s.store_id::text AS store_id,
          s.store_code,
          s.store_name,
          s.store_type,
          s.status,
          s.kpi_import_enabled,
          r.region_id::text AS region_id,
          r.region_name,
          region_manager.region_manager_user_id,
          region_manager.region_manager_name,
          s.updated_at::text AS updated_at
        ${fromClause}
        ${whereClause}
        ORDER BY s.store_name ASC, s.store_code ASC
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

  async listStoreMasterRegions(input: { actorCompanyIds: string[] }) {
    const result = await this.databaseService.query<{
      region_id: string;
      region_code: string;
      region_name: string;
    }>(
      `
        SELECT
          r.region_id::text AS region_id,
          r.region_code,
          r.region_name
        FROM ops.region r
        WHERE r.status = 'active'
          AND r.company_id = ANY($1::uuid[])
        ORDER BY r.region_name ASC, r.region_code ASC
      `,
      [input.actorCompanyIds],
    );

    return result.rows;
  }

  async listStoreMasterRegionManagers(input: { actorCompanyIds: string[] }) {
    const result = await this.databaseService.query<{
      assignment_id: string;
      user_id: string;
      display_name: string;
      email: string;
      region_id: string;
      region_code: string;
      region_name: string;
    }>(
      `
        WITH manager_accounts AS (
          SELECT
            MIN(ura.user_role_assignment_id::text)::uuid AS assignment_id,
            ua.user_id,
            COALESCE(
              NULLIF(BTRIM(CONCAT(e.first_name, ' ', e.last_name)), ''),
              NULLIF(BTRIM(ua.username), ''),
              ua.email
            ) AS display_name,
            ua.email
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
            AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
            AND ua.is_active = TRUE
          LEFT JOIN ops.employee e
            ON e.employee_id = ua.employee_id
          LEFT JOIN ops.region role_region
            ON role_region.region_id = ura.region_id
          WHERE ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at > NOW())
            AND (
              ura.company_id = ANY($1::uuid[])
              OR role_region.company_id = ANY($1::uuid[])
              OR EXISTS (
                SELECT 1
                FROM ops.user_action_store_assignment manager_store
                INNER JOIN ops.store assigned_store
                  ON assigned_store.store_id = manager_store.store_id
                  AND assigned_store.company_id = ANY($1::uuid[])
                WHERE manager_store.user_id = ura.user_id
                  AND manager_store.start_at <= NOW()
                  AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
              )
            )
          GROUP BY ua.user_id, display_name, ua.email
        )
        SELECT
          manager.assignment_id::text AS assignment_id,
          manager.user_id::text AS user_id,
          manager.display_name,
          manager.email,
          r.region_id::text AS region_id,
          r.region_code,
          r.region_name
        FROM manager_accounts manager
        INNER JOIN LATERAL (
          SELECT candidate_region.region_id, candidate_region.region_code, candidate_region.region_name
          FROM ops.region candidate_region
          WHERE candidate_region.status = 'active'
            AND candidate_region.company_id = ANY($1::uuid[])
          ORDER BY
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM ops.user_role_assignment direct_role
                WHERE direct_role.user_id = manager.user_id
                  AND direct_role.region_id = candidate_region.region_id
                  AND direct_role.start_at <= NOW()
                  AND (direct_role.end_at IS NULL OR direct_role.end_at > NOW())
              ) THEN 0
              WHEN EXISTS (
                SELECT 1
                FROM ops.user_action_store_assignment manager_store
                INNER JOIN ops.store assigned_store
                  ON assigned_store.store_id = manager_store.store_id
                  AND assigned_store.region_id = candidate_region.region_id
                WHERE manager_store.user_id = manager.user_id
                  AND manager_store.start_at <= NOW()
                  AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
              ) THEN 1
              ELSE 2
            END,
            candidate_region.region_name ASC,
            candidate_region.region_id ASC
          LIMIT 1
        ) r ON TRUE
        ORDER BY manager.display_name ASC, manager.user_id ASC
      `,
      [input.actorCompanyIds],
    );

    return result.rows;
  }
}
