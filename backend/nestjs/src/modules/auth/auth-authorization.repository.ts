import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

@Injectable()
export class AuthAuthorizationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserAccountStatusById(userId: string) {
    if (!isUuid(userId)) {
      return null;
    }

    const result = await this.databaseService.query<{
      is_active: boolean;
      employee_id?: string | null;
      display_name?: string | null;
      username?: string;
      email?: string;
    }>(
      `
        SELECT account.is_active,account.employee_id,account.username,account.email,
          NULLIF(CONCAT_WS(' ',COALESCE(employee.first_name,account.first_name),
            COALESCE(employee.last_name,account.last_name)),'') AS display_name
        FROM ops.user_account account
        LEFT JOIN ops.employee employee ON employee.employee_id=account.employee_id
        WHERE account.user_id = $1::uuid
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async getUserAccountByProviderSubject(input: {
    authProvider: string;
    providerSubject: string;
  }) {
    const result = await this.databaseService.query<{
      user_id: string;
      employee_id: string | null;
      display_name: string | null;
      username: string;
      email: string;
      is_active: boolean;
    }>(
      `
        SELECT
          ua.user_id,
          ua.employee_id,
          NULLIF(CONCAT_WS(' ', COALESCE(e.first_name, ua.first_name),
            COALESCE(e.last_name, ua.last_name)), '') AS display_name,
          ua.username,
          ua.email,
          ua.is_active
        FROM ops.user_account ua
        LEFT JOIN ops.employee e
          ON e.employee_id = ua.employee_id
        WHERE ua.auth_provider = $1
          AND ua.provider_subject = $2
        LIMIT 1
      `,
      [input.authProvider, input.providerSubject],
    );

    return result.rows[0] ?? null;
  }

  async getActiveRoleAssignments(userId: string) {
    if (!isUuid(userId)) {
      return [];
    }

    const result = await this.databaseService.query<{
      role_code: string;
      role_scope_type?: string;
      scope_type: string;
      company_id: string | null;
      region_id: string | null;
      store_id: string | null;
      store_type?: string | null;
      permission_codes?: string[];
      is_personal_permission?: boolean;
    }>(
      `
        SELECT
          r.role_code,
          r.role_scope_type,
          ura.scope_type,
          ura.company_id,
          ura.region_id,
          ura.store_id,
          store.store_type,
          (ARRAY(
            SELECT permission.permission_code
            FROM ops.role_permission role_permission
            INNER JOIN ops.permission permission
              ON permission.permission_id = role_permission.permission_id
            WHERE role_permission.role_id = ura.role_id
              AND permission.permission_code <> 'INCENTIVE_FINAL_APPROVAL'
            ORDER BY permission.permission_code ASC
          ) || CASE WHEN ura.incentive_approval AND r.role_code = 'REPORT_VIEWER'
                     AND ura.scope_type = 'company' AND r.role_scope_type = 'company'
                     AND ura.company_id IS NOT NULL
                     AND (ura.end_at IS NULL OR ura.end_at > NOW())
               THEN ARRAY['INCENTIVE_FINAL_APPROVAL']::text[] ELSE ARRAY[]::text[] END) AS permission_codes,
          FALSE AS is_personal_permission
        FROM ops.user_account ua
        INNER JOIN ops.user_role_assignment ura
          ON ura.user_id = ua.user_id
        INNER JOIN ops.role r
          ON r.role_id = ura.role_id
        LEFT JOIN ops.company c
          ON c.company_id = ura.company_id
        LEFT JOIN ops.region region
          ON region.region_id = ura.region_id
         AND region.company_id = ura.company_id
        LEFT JOIN ops.store store
          ON store.store_id = ura.store_id
         AND store.region_id = ura.region_id
         AND store.company_id = ura.company_id
        WHERE ua.user_id = $1::uuid
          AND ua.is_active = TRUE
          AND ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          AND (
            (ura.scope_type = 'company' AND c.status = 'active')
            OR (
              ura.scope_type = 'region'
              AND c.status = 'active'
              AND region.status = 'active'
            )
            OR (
              ura.scope_type = 'store'
              AND c.status = 'active'
              AND region.status = 'active'
              AND store.status = 'active'
            )
          )
        UNION ALL
        SELECT
          r.role_code,
          r.role_scope_type,
          permission_assignment.scope_type,
          permission_assignment.company_id,
          permission_assignment.region_id,
          permission_assignment.store_id,
          permission_store.store_type,
          ARRAY[permission.permission_code]::text[] AS permission_codes,
          TRUE AS is_personal_permission
        FROM ops.user_account ua
        INNER JOIN ops.user_role_assignment ura
          ON ura.user_id = ua.user_id
        INNER JOIN ops.role r
          ON r.role_id = ura.role_id
        INNER JOIN ops.user_permission_assignment permission_assignment
          ON permission_assignment.user_role_assignment_id = ura.user_role_assignment_id
         AND permission_assignment.user_id = ura.user_id
        INNER JOIN ops.permission permission
          ON permission.permission_id = permission_assignment.permission_id
        LEFT JOIN ops.company permission_company
          ON permission_company.company_id = permission_assignment.company_id
        LEFT JOIN ops.region permission_region
          ON permission_region.region_id = permission_assignment.region_id
         AND permission_region.company_id = permission_assignment.company_id
        LEFT JOIN ops.store permission_store
          ON permission_store.store_id = permission_assignment.store_id
         AND permission_store.region_id = permission_assignment.region_id
         AND permission_store.company_id = permission_assignment.company_id
        WHERE ua.user_id = $1::uuid
          AND ua.is_active = TRUE
          AND ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          AND permission_assignment.revoked_at IS NULL
          AND permission_assignment.starts_at <= NOW()
          AND (permission_assignment.ends_at IS NULL OR permission_assignment.ends_at > NOW())
          AND (
            (permission_assignment.scope_type = 'company' AND permission_company.status = 'active')
            OR (
              permission_assignment.scope_type = 'region'
              AND permission_company.status = 'active'
              AND permission_region.status = 'active'
            )
            OR (
              permission_assignment.scope_type = 'store'
              AND permission_company.status = 'active'
              AND permission_region.status = 'active'
              AND permission_store.status = 'active'
            )
          )
      `,
      [userId],
    );

    return result.rows;
  }

  async getActiveActionStoreAssignments(userId: string) {
    if (!isUuid(userId)) {
      return [];
    }

    const result = await this.databaseService.query<{
      store_id: string;
      store_type?: string | null;
    }>(
      `
        SELECT
          uasa.store_id,
          s.store_type
        FROM ops.user_account ua
        INNER JOIN ops.user_action_store_assignment uasa
          ON uasa.user_id = ua.user_id
        INNER JOIN ops.store s
          ON s.store_id = uasa.store_id
        INNER JOIN ops.region r
          ON r.region_id = s.region_id
         AND r.company_id = s.company_id
        INNER JOIN ops.company c
          ON c.company_id = s.company_id
        WHERE ua.user_id = $1::uuid
          AND ua.is_active = TRUE
          AND s.status = 'active'
          AND r.status = 'active'
          AND c.status = 'active'
          AND uasa.start_at <= NOW()
          AND (uasa.end_at IS NULL OR uasa.end_at > NOW())
        ORDER BY s.store_code ASC, uasa.store_id ASC
      `,
      [userId],
    );

    return result.rows;
  }
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    input,
  );
}
