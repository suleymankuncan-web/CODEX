import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

type StoreForSellerCodeRequestRow = {
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: "company" | "franchise" | "operator";
  company_id: string;
  region_id: string;
};

type PositionOptionRow = {
  position_id: string;
  position_code: string;
  position_name: string;
  job_family: string | null;
  is_managerial: boolean;
};

type ActiveStoreEmployeeRow = {
  employee_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  assignment_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  position_id: string;
  position_code: string;
  position_name: string;
  assignment_start_date: string;
  employment_status: string;
};

@Injectable()
export class WorkforceLookupReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getLatestFranchiseSellerCode() {
    const result = await this.databaseService.query<{ seller_code: string }>(
      `
        WITH seller_code_candidates AS (
          SELECT UPPER(e.external_employee_ref) AS seller_code
          FROM ops.employee e
          WHERE e.external_employee_ref ~* '^FM[0-9]+$'

          UNION ALL

          SELECT UPPER(scr.approved_seller_code) AS seller_code
          FROM ops.seller_code_request scr
          WHERE scr.approved_seller_code ~* '^FM[0-9]+$'
            AND scr.request_status = 'approved'
        )
        SELECT seller_code
        FROM seller_code_candidates
        WHERE LEFT(seller_code, 2) = 'FM'
        ORDER BY SUBSTRING(seller_code FROM 3)::integer DESC
        LIMIT 1
      `,
    );

    return result.rows[0]?.seller_code ?? null;
  }

  async getStoreForSellerCodeRequest(storeId: string) {
    const result = await this.databaseService.query<StoreForSellerCodeRequestRow>(
      `
        SELECT
          s.store_id,
          s.store_code,
          s.store_name,
          s.store_type,
          s.company_id,
          s.region_id
        FROM ops.store s
        WHERE s.store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async listPositionOptionsForStore(input: { storeId: string }) {
    const result = await this.databaseService.query<PositionOptionRow>(
      `
        SELECT
          p.position_id,
          p.position_code,
          p.position_name,
          p.job_family,
          p.is_managerial
        FROM ops.store s
        INNER JOIN ops.position p
          ON p.company_id = s.company_id
        WHERE s.store_id = $1::uuid
        ORDER BY p.is_managerial ASC, p.position_name ASC, p.position_code ASC
      `,
      [input.storeId],
    );

    return result.rows;
  }

  async listActiveStoreEmployees(input: { storeId: string }) {
    const result = await this.databaseService.query<ActiveStoreEmployeeRow>(
      `
        SELECT
          e.employee_id,
          e.company_id,
          eah.region_id,
          eah.store_id,
          eah.assignment_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          eah.position_id,
          p.position_code,
          p.position_name,
          eah.start_date AS assignment_start_date,
          e.employment_status
        FROM ops.employee_assignment_history eah
        INNER JOIN ops.employee e
          ON e.employee_id = eah.employee_id
        INNER JOIN ops.position p
          ON p.position_id = eah.position_id
        WHERE eah.store_id = $1::uuid
          AND eah.assignment_status = 'active'
          AND eah.end_date IS NULL
          AND e.employment_status = 'active'
        ORDER BY e.first_name ASC, e.last_name ASC, e.employee_id ASC
      `,
      [input.storeId],
    );

    return result.rows;
  }

  async getActiveStoreEmployeeForOffboarding(input: {
    storeId: string;
    employeeId: string;
  }) {
    const result = await this.databaseService.query<ActiveStoreEmployeeRow>(
      `
        SELECT
          e.employee_id,
          e.company_id,
          eah.region_id,
          eah.store_id,
          eah.assignment_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          eah.position_id,
          p.position_code,
          p.position_name,
          eah.start_date AS assignment_start_date,
          e.employment_status
        FROM ops.employee_assignment_history eah
        INNER JOIN ops.employee e
          ON e.employee_id = eah.employee_id
        INNER JOIN ops.position p
          ON p.position_id = eah.position_id
        WHERE eah.store_id = $1::uuid
          AND eah.employee_id = $2::uuid
          AND eah.assignment_status = 'active'
          AND eah.end_date IS NULL
          AND e.employment_status = 'active'
        LIMIT 1
      `,
      [input.storeId, input.employeeId],
    );

    return result.rows[0] ?? null;
  }
}
