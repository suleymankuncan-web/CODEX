import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ExternalIdMappingReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listExternalIdMapCandidates(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    q?: string;
    limit: number;
  }) {
    const search = `%${(input.q ?? "").trim()}%`;

    if (input.entityType === "store") {
      const result = await this.databaseService.query<{
        internal_id: string;
        label: string;
        secondary_label: string;
      }>(
        `
          SELECT
            store_id::text AS internal_id,
            store_name AS label,
            CONCAT(store_code, ' / ', status) AS secondary_label
          FROM ops.store
          WHERE status = 'active'
            AND company_id = ANY($1::uuid[])
            AND (
              $2 = '%%'
              OR store_name ILIKE $2
              OR store_code ILIKE $2
            )
          ORDER BY store_name ASC, store_code ASC
          LIMIT $3
        `,
        [input.actorCompanyIds, search, input.limit],
      );

      return result.rows;
    }

    const result = await this.databaseService.query<{
      internal_id: string;
      label: string;
      secondary_label: string;
    }>(
      `
        SELECT
          employee_id::text AS internal_id,
          TRIM(CONCAT(first_name, ' ', last_name)) AS label,
          CONCAT(COALESCE(external_employee_ref, 'no external ref'), ' / ', employment_status)
            AS secondary_label
        FROM ops.employee
        WHERE employment_status = 'active'
          AND company_id = ANY($1::uuid[])
          AND (
            $2 = '%%'
            OR first_name ILIKE $2
            OR last_name ILIKE $2
            OR external_employee_ref ILIKE $2
            OR CONCAT(first_name, ' ', last_name) ILIKE $2
          )
        ORDER BY first_name ASC, last_name ASC, employee_id ASC
        LIMIT $3
      `,
      [input.actorCompanyIds, search, input.limit],
    );

    return result.rows;
  }

  async getScopedExternalIdMappingTarget(input: {
    actorCompanyIds: string[];
    entityType: "employee" | "store";
    internalId: string;
  }) {
    if (input.entityType === "store") {
      const result = await this.databaseService.query<{ internal_id: string }>(
        `
          SELECT store_id::text AS internal_id
          FROM ops.store
          WHERE store_id = $1::uuid
            AND company_id = ANY($2::uuid[])
            AND status = 'active'
          LIMIT 1
        `,
        [input.internalId, input.actorCompanyIds],
      );

      return result.rows[0] ?? null;
    }

    const result = await this.databaseService.query<{ internal_id: string }>(
      `
        SELECT employee_id::text AS internal_id
        FROM ops.employee
        WHERE employee_id = $1::uuid
          AND company_id = ANY($2::uuid[])
          AND employment_status = 'active'
        LIMIT 1
      `,
      [input.internalId, input.actorCompanyIds],
    );

    return result.rows[0] ?? null;
  }
}
