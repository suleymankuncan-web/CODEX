import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../shared/database/database.service";

type RoleCatalogRow = {
  role_id: string;
  role_code: string;
  role_name: string;
  role_scope_type: string;
  description: string | null;
  is_system_role: boolean;
  permission_code: string | null;
  resource_name: string | null;
  action_name: string | null;
};

type PermissionCatalogRow = {
  permission_id: string;
  permission_code: string;
  resource_name: string;
  action_name: string;
  description: string | null;
};

type RolePermissionRow = {
  role_id: string;
  permission_id: string;
};

type StoreLookupRow = {
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
};

type CompanyLookupRow = {
  company_id: string;
};

type RegionLookupRow = {
  region_id: string;
  company_id: string;
};

function escapePostgresLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

@Injectable()
export class AuthAdminLookupRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getRoleByCode(roleCode: string) {
    const result = await this.databaseService.query<{
      role_id: string;
      role_code: string;
      role_scope_type: string;
      role_name: string;
    }>(
      `
        SELECT r.role_id, r.role_code, r.role_scope_type, r.role_name
        FROM ops.role r
        WHERE r.role_code = $1
      `,
      [roleCode],
    );

    return result.rows[0] ?? null;
  }

  async getRoleById(roleId: string) {
    const result = await this.databaseService.query<{
      role_id: string;
      role_code: string;
      role_scope_type: string;
      role_name: string;
    }>(
      `
        SELECT r.role_id, r.role_code, r.role_scope_type, r.role_name
        FROM ops.role r
        WHERE r.role_id = $1::uuid
      `,
      [roleId],
    );

    return result.rows[0] ?? null;
  }

  async getCompanyLookupById(companyId: string) {
    const result = await this.databaseService.query<CompanyLookupRow>(
      `
        SELECT c.company_id
        FROM ops.company c
        WHERE c.company_id = $1::uuid
          AND c.status = 'active'
      `,
      [companyId],
    );

    return result.rows[0] ?? null;
  }

  async getRegionLookupById(regionId: string) {
    const result = await this.databaseService.query<RegionLookupRow>(
      `
        SELECT r.region_id, r.company_id
        FROM ops.region r
        INNER JOIN ops.company c
          ON c.company_id = r.company_id
        WHERE r.region_id = $1::uuid
          AND r.status = 'active'
          AND c.status = 'active'
      `,
      [regionId],
    );

    return result.rows[0] ?? null;
  }

  async getStoreLookupById(storeId: string) {
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r
          ON r.region_id = s.region_id
         AND r.company_id = s.company_id
        INNER JOIN ops.company c
          ON c.company_id = s.company_id
        WHERE s.store_id = $1::uuid
          AND s.status = 'active'
          AND r.status = 'active'
          AND c.status = 'active'
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async listRoles() {
    const result = await this.databaseService.query<RoleCatalogRow>(
      `
        SELECT
          r.role_id,
          r.role_code,
          r.role_name,
          r.role_scope_type,
          r.description,
          r.is_system_role,
          p.permission_code,
          p.resource_name,
          p.action_name
        FROM ops.role r
        LEFT JOIN ops.role_permission rp ON rp.role_id = r.role_id
        LEFT JOIN ops.permission p ON p.permission_id = rp.permission_id
        ORDER BY r.role_code ASC, p.permission_code ASC NULLS LAST
      `,
    );

    return result.rows;
  }

  async listPermissions() {
    const result = await this.databaseService.query<PermissionCatalogRow>(
      `
        SELECT
          permission_id,
          permission_code,
          resource_name,
          action_name,
          description
        FROM ops.permission
        ORDER BY permission_code ASC
      `,
    );

    return result.rows;
  }

  async listActiveUserLookups() {
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      email: string;
      auth_provider: string;
    }>(
      `
        SELECT user_id, username, email, auth_provider
        FROM ops.user_account
        WHERE is_active = TRUE
        ORDER BY username ASC
        LIMIT 50
      `,
    );

    return result.rows;
  }

  async searchActiveUserLookups(input: { query: string; limit: number }) {
    const searchTerm = `%${escapePostgresLikePattern(input.query)}%`;
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      email: string;
      auth_provider: string;
      provider_subject: string | null;
    }>(
      `
        SELECT user_id, username, email, auth_provider, provider_subject
        FROM ops.user_account
        WHERE is_active = TRUE
          AND (
            username ILIKE $1 ESCAPE '\\'
            OR email ILIKE $1 ESCAPE '\\'
            OR provider_subject ILIKE $1 ESCAPE '\\'
          )
        ORDER BY username ASC, user_id ASC
        LIMIT $2
      `,
      [searchTerm, input.limit],
    );

    return result.rows;
  }

  async listActiveStoreLookups() {
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r
          ON r.region_id = s.region_id
         AND r.company_id = s.company_id
        INNER JOIN ops.company c
          ON c.company_id = s.company_id
        WHERE s.status = 'active'
          AND r.status = 'active'
          AND c.status = 'active'
        ORDER BY s.store_code ASC, s.store_id ASC
        LIMIT 200
      `,
    );

    return result.rows;
  }

  async searchActiveStoreLookups(input: { query: string; limit: number }) {
    const searchTerm = `%${escapePostgresLikePattern(input.query)}%`;
    const result = await this.databaseService.query<StoreLookupRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.company_id,
          s.region_id,
          r.region_name
        FROM ops.store s
        INNER JOIN ops.region r
          ON r.region_id = s.region_id
         AND r.company_id = s.company_id
        INNER JOIN ops.company c
          ON c.company_id = s.company_id
        WHERE s.status = 'active'
          AND r.status = 'active'
          AND c.status = 'active'
          AND (
            s.store_code ILIKE $1 ESCAPE '\\'
            OR s.store_name ILIKE $1 ESCAPE '\\'
            OR r.region_name ILIKE $1 ESCAPE '\\'
          )
        ORDER BY s.store_code ASC, s.store_id ASC
        LIMIT $2
      `,
      [searchTerm, input.limit],
    );

    return result.rows;
  }

  async getPermissionByCode(permissionCode: string) {
    const result = await this.databaseService.query<{
      permission_id: string;
      permission_code: string;
    }>(
      `
        SELECT p.permission_id, p.permission_code
        FROM ops.permission p
        WHERE p.permission_code = $1
      `,
      [permissionCode],
    );

    return result.rows[0] ?? null;
  }

  async getRolePermission(input: { roleId: string; permissionId: string }) {
    const result = await this.databaseService.query<RolePermissionRow>(
      `
        SELECT rp.role_id, rp.permission_id
        FROM ops.role_permission rp
        WHERE rp.role_id = $1::uuid
          AND rp.permission_id = $2::uuid
      `,
      [input.roleId, input.permissionId],
    );

    return result.rows[0] ?? null;
  }
}
