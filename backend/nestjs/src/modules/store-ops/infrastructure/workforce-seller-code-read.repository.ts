import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

export type SellerCodeRequestRow = {
  seller_code_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: string;
  request_type: string;
  request_status: string;
  first_name: string;
  last_name: string;
  national_id_hash: string;
  national_id_last4: string;
  phone_number: string;
  requested_hire_date: string;
  requested_position_id: string;
  position_code: string;
  position_name: string;
  employment_type: string;
  requested_seller_code: string | null;
  approved_seller_code: string | null;
  last_reference_seller_code: string | null;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class WorkforceSellerCodeReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listSellerCodeRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    status?: string;
  }) {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`scr.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`scr.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`scr.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.status) {
      params.push(input.status);
      clauses.push(`scr.request_status = $${params.length}`);
    }

    const result = await this.databaseService.query<SellerCodeRequestRow>(
      `
        SELECT
          scr.seller_code_request_id,
          scr.company_id,
          scr.region_id,
          scr.store_id,
          s.store_code,
          s.store_name,
          scr.store_type,
          scr.request_type,
          scr.request_status,
          scr.first_name,
          scr.last_name,
          scr.national_id_hash,
          scr.national_id_last4,
          scr.phone_number,
          scr.requested_hire_date,
          scr.requested_position_id,
          p.position_code,
          p.position_name,
          scr.employment_type,
          scr.requested_seller_code,
          scr.approved_seller_code,
          scr.last_reference_seller_code,
          scr.submitted_by_user_id,
          scr.reviewed_by_user_id,
          scr.reviewed_at,
          scr.review_note,
          scr.employee_id,
          scr.created_at,
          scr.updated_at
        FROM ops.seller_code_request scr
        INNER JOIN ops.store s
          ON s.store_id = scr.store_id
        INNER JOIN ops.position p
          ON p.position_id = scr.requested_position_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY scr.created_at DESC, scr.seller_code_request_id DESC
        LIMIT 50
      `,
      params,
    );

    return result.rows;
  }

  async getSellerCodeRequestById(requestId: string) {
    const result = await this.databaseService.query<SellerCodeRequestRow>(
      `
        SELECT
          scr.seller_code_request_id,
          scr.company_id,
          scr.region_id,
          scr.store_id,
          s.store_code,
          s.store_name,
          scr.store_type,
          scr.request_type,
          scr.request_status,
          scr.first_name,
          scr.last_name,
          scr.national_id_hash,
          scr.national_id_last4,
          scr.phone_number,
          scr.requested_hire_date,
          scr.requested_position_id,
          p.position_code,
          p.position_name,
          scr.employment_type,
          scr.requested_seller_code,
          scr.approved_seller_code,
          scr.last_reference_seller_code,
          scr.submitted_by_user_id,
          scr.reviewed_by_user_id,
          scr.reviewed_at,
          scr.review_note,
          scr.employee_id,
          scr.created_at,
          scr.updated_at
        FROM ops.seller_code_request scr
        INNER JOIN ops.store s
          ON s.store_id = scr.store_id
        INNER JOIN ops.position p
          ON p.position_id = scr.requested_position_id
        WHERE scr.seller_code_request_id = $1::uuid
        LIMIT 1
      `,
      [requestId],
    );

    return result.rows[0] ?? null;
  }
}
