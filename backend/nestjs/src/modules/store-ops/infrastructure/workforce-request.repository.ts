import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

type StoreForSellerCodeRequestRow = {
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: "company" | "franchise" | "operator";
  company_id: string;
  region_id: string;
};

type SellerCodeRequestRow = {
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

type EmployeeOffboardingRequestRow = {
  offboarding_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  position_code: string | null;
  position_name: string | null;
  request_status: string;
  requested_termination_date: string;
  termination_reason: string;
  request_reason: string | null;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class WorkforceRequestRepository {
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

  async getActiveStoreEmployeeForOffboarding(input: { storeId: string; employeeId: string }) {
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

  async createSellerCodeRequest(input: {
    companyId: string;
    regionId: string;
    storeId: string;
    storeType: string;
    requestType: "create_code";
    firstName: string;
    lastName: string;
    nationalIdHash: string;
    nationalIdLast4: string;
    phoneNumber: string;
    hireDate: string;
    requestedPositionId: string;
    employmentType: "full_time" | "part_time" | "temporary";
    requestedSellerCode?: string;
    lastReferenceSellerCode: string | null;
    requestReason?: string;
    submittedByUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH inserted AS (
            INSERT INTO ops.seller_code_request (
              company_id,
              region_id,
              store_id,
              store_type,
              request_type,
              first_name,
              last_name,
              national_id_hash,
              national_id_last4,
              phone_number,
              requested_hire_date,
              requested_position_id,
              employment_type,
              requested_seller_code,
              last_reference_seller_code,
              request_reason,
              submitted_by_user_id
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11::date,
              $12::uuid,
              $13,
              $14,
              $15,
              $16,
              $17
            )
            RETURNING *
          )
          SELECT
            inserted.seller_code_request_id,
            inserted.company_id,
            inserted.region_id,
            inserted.store_id,
            s.store_code,
            s.store_name,
            inserted.store_type,
            inserted.request_type,
            inserted.request_status,
            inserted.first_name,
            inserted.last_name,
            inserted.national_id_hash,
            inserted.national_id_last4,
            inserted.phone_number,
            inserted.requested_hire_date,
            inserted.requested_position_id,
            p.position_code,
            p.position_name,
            inserted.employment_type,
            inserted.requested_seller_code,
            inserted.approved_seller_code,
            inserted.last_reference_seller_code,
            inserted.submitted_by_user_id,
            inserted.reviewed_by_user_id,
            inserted.reviewed_at,
            inserted.review_note,
            inserted.employee_id,
            inserted.created_at,
            inserted.updated_at
          FROM inserted
          INNER JOIN ops.store s
            ON s.store_id = inserted.store_id
          INNER JOIN ops.position p
            ON p.position_id = inserted.requested_position_id
        `,
        [
          input.companyId,
          input.regionId,
          input.storeId,
          input.storeType,
          input.requestType,
          input.firstName,
          input.lastName,
          input.nationalIdHash,
          input.nationalIdLast4,
          input.phoneNumber,
          input.hireDate,
          input.requestedPositionId,
          input.employmentType,
          input.requestedSellerCode ?? null,
          input.lastReferenceSellerCode,
          input.requestReason ?? null,
          input.submittedByUserId,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'seller_code_request.created',
            'ops.seller_code_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.seller_code_request_id,
          input.companyId,
          input.regionId,
          input.storeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.submittedByUserId,
            requestType: input.requestType,
            storeType: input.storeType,
            requestedSellerCode: input.requestedSellerCode ?? null,
            lastReferenceSellerCode: input.lastReferenceSellerCode,
          }),
        ],
      );

      return request;
    });
  }

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

  async countSellerCodeDuplicates(sellerCode: string) {
    const result = await this.databaseService.query<{ seller_code_duplicate_count: string }>(
      `
        SELECT (
          SELECT COUNT(*) FROM ops.employee e
          WHERE UPPER(e.external_employee_ref) = UPPER($1)
        ) + (
          SELECT COUNT(*) FROM ops.seller_code_request scr
          WHERE UPPER(scr.approved_seller_code) = UPPER($1)
            AND scr.request_status = 'approved'
        ) AS seller_code_duplicate_count
      `,
      [sellerCode],
    );

    return Number(result.rows[0]?.seller_code_duplicate_count ?? 0);
  }

  async approveSellerCodeRequest(input: {
    request: SellerCodeRequestRow;
    sellerCode: string;
    actorUserId: string;
    reviewNote?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const employeeResult = await client.query<{ employee_id: string }>(
        `
          INSERT INTO ops.employee (
            company_id,
            external_employee_ref,
            first_name,
            last_name,
            national_id_hash,
            hire_date,
            employment_status,
            employment_type
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6::date, 'active', $7)
          RETURNING employee_id
        `,
        [
          input.request.company_id,
          input.sellerCode,
          input.request.first_name,
          input.request.last_name,
          input.request.national_id_hash,
          input.request.requested_hire_date,
          input.request.employment_type,
        ],
      );

      const employeeId = employeeResult.rows[0].employee_id;

      await client.query(
        `
          INSERT INTO ops.employee_assignment_history (
            employee_id,
            store_id,
            region_id,
            position_id,
            start_date,
            assignment_status
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, 'active')
        `,
        [
          employeeId,
          input.request.store_id,
          input.request.region_id,
          input.request.requested_position_id,
          input.request.requested_hire_date,
        ],
      );

      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.seller_code_request
            SET
              request_status = 'approved',
              approved_seller_code = $2,
              employee_id = $3::uuid,
              reviewed_by_user_id = $4,
              reviewed_at = NOW(),
              review_note = $5,
              updated_at = NOW()
            WHERE seller_code_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.seller_code_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.store_type,
            updated.request_type,
            updated.request_status,
            updated.first_name,
            updated.last_name,
            updated.national_id_hash,
            updated.national_id_last4,
            updated.phone_number,
            updated.requested_hire_date,
            updated.requested_position_id,
            p.position_code,
            p.position_name,
            updated.employment_type,
            updated.requested_seller_code,
            updated.approved_seller_code,
            updated.last_reference_seller_code,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.employee_id,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.position p
            ON p.position_id = updated.requested_position_id
        `,
        [
          input.request.seller_code_request_id,
          input.sellerCode,
          employeeId,
          input.actorUserId,
          input.reviewNote ?? null,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'seller_code_request.approved',
            'ops.seller_code_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.seller_code_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            employeeId,
            sellerCode: input.sellerCode,
            reviewNote: input.reviewNote ?? null,
          }),
        ],
      );

      return request;
    });
  }

  async rejectSellerCodeRequest(input: {
    request: SellerCodeRequestRow;
    actorUserId: string;
    reviewNote: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.seller_code_request
            SET
              request_status = 'rejected',
              reviewed_by_user_id = $2,
              reviewed_at = NOW(),
              review_note = $3,
              updated_at = NOW()
            WHERE seller_code_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.seller_code_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.store_type,
            updated.request_type,
            updated.request_status,
            updated.first_name,
            updated.last_name,
            updated.national_id_hash,
            updated.national_id_last4,
            updated.phone_number,
            updated.requested_hire_date,
            updated.requested_position_id,
            p.position_code,
            p.position_name,
            updated.employment_type,
            updated.requested_seller_code,
            updated.approved_seller_code,
            updated.last_reference_seller_code,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.employee_id,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.position p
            ON p.position_id = updated.requested_position_id
        `,
        [
          input.request.seller_code_request_id,
          input.actorUserId,
          input.reviewNote,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'seller_code_request.rejected',
            'ops.seller_code_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.seller_code_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            reviewNote: input.reviewNote,
          }),
        ],
      );

      return request;
    });
  }

  async resubmitSellerCodeRequest(input: {
    request: SellerCodeRequestRow;
    firstName: string;
    lastName: string;
    nationalIdHash: string;
    nationalIdLast4: string;
    phoneNumber: string;
    hireDate: string;
    requestedPositionId: string;
    employmentType: "full_time" | "part_time" | "temporary";
    requestReason?: string;
    lastReferenceSellerCode: string | null;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.seller_code_request
            SET
              request_status = 'pending_hr_approval',
              first_name = $2,
              last_name = $3,
              national_id_hash = $4,
              national_id_last4 = $5,
              phone_number = $6,
              requested_hire_date = $7::date,
              requested_position_id = $8::uuid,
              employment_type = $9,
              request_reason = $10,
              requested_seller_code = NULL,
              approved_seller_code = NULL,
              last_reference_seller_code = $11,
              submitted_by_user_id = $12,
              reviewed_by_user_id = NULL,
              reviewed_at = NULL,
              review_note = NULL,
              employee_id = NULL,
              updated_at = NOW()
            WHERE seller_code_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.seller_code_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.store_type,
            updated.request_type,
            updated.request_status,
            updated.first_name,
            updated.last_name,
            updated.national_id_hash,
            updated.national_id_last4,
            updated.phone_number,
            updated.requested_hire_date,
            updated.requested_position_id,
            p.position_code,
            p.position_name,
            updated.employment_type,
            updated.requested_seller_code,
            updated.approved_seller_code,
            updated.last_reference_seller_code,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.employee_id,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.position p
            ON p.position_id = updated.requested_position_id
        `,
        [
          input.request.seller_code_request_id,
          input.firstName,
          input.lastName,
          input.nationalIdHash,
          input.nationalIdLast4,
          input.phoneNumber,
          input.hireDate,
          input.requestedPositionId,
          input.employmentType,
          input.requestReason ?? null,
          input.lastReferenceSellerCode,
          input.actorUserId,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'seller_code_request.resubmitted',
            'ops.seller_code_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.seller_code_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            previousReviewNote: input.request.review_note,
            lastReferenceSellerCode: input.lastReferenceSellerCode,
          }),
        ],
      );

      return request;
    });
  }

  async createOffboardingRequest(input: {
    companyId: string;
    regionId: string;
    storeId: string;
    employeeId: string;
    terminationDate: string;
    terminationReason: string;
    requestReason: string;
    submittedByUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH inserted AS (
            INSERT INTO ops.employee_offboarding_request (
              company_id,
              region_id,
              store_id,
              employee_id,
              requested_termination_date,
              termination_reason,
              request_reason,
              submitted_by_user_id
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              $3::uuid,
              $4::uuid,
              $5::date,
              $6,
              $7,
              $8
            )
            RETURNING *
          )
          SELECT
            inserted.offboarding_request_id,
            inserted.company_id,
            inserted.region_id,
            inserted.store_id,
            s.store_code,
            s.store_name,
            inserted.employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            p.position_code,
            p.position_name,
            inserted.request_status,
            inserted.requested_termination_date,
            inserted.termination_reason,
            inserted.request_reason,
            inserted.submitted_by_user_id,
            inserted.reviewed_by_user_id,
            inserted.reviewed_at,
            inserted.review_note,
            inserted.created_at,
            inserted.updated_at
          FROM inserted
          INNER JOIN ops.store s
            ON s.store_id = inserted.store_id
          INNER JOIN ops.employee e
            ON e.employee_id = inserted.employee_id
          LEFT JOIN LATERAL (
            SELECT eah.position_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = inserted.employee_id
              AND eah.store_id = inserted.store_id
            ORDER BY
              CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
              eah.start_date DESC
            LIMIT 1
          ) active_assignment ON TRUE
          LEFT JOIN ops.position p
            ON p.position_id = active_assignment.position_id
        `,
        [
          input.companyId,
          input.regionId,
          input.storeId,
          input.employeeId,
          input.terminationDate,
          input.terminationReason,
          input.requestReason,
          input.submittedByUserId,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'employee_offboarding_request.created',
            'ops.employee_offboarding_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.offboarding_request_id,
          input.companyId,
          input.regionId,
          input.storeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.submittedByUserId,
            employeeId: input.employeeId,
            terminationDate: input.terminationDate,
            terminationReason: input.terminationReason,
          }),
        ],
      );

      return request;
    });
  }

  async listOffboardingRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    status?: string;
  }) {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`eor.store_id = ANY($${params.length}::uuid[])`);
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`eor.region_id = ANY($${params.length}::uuid[])`);
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`eor.company_id = ANY($${params.length}::uuid[])`);
    } else {
      clauses.push("FALSE");
    }

    if (input.status) {
      params.push(input.status);
      clauses.push(`eor.request_status = $${params.length}`);
    }

    const result = await this.databaseService.query<EmployeeOffboardingRequestRow>(
      `
        SELECT
          eor.offboarding_request_id,
          eor.company_id,
          eor.region_id,
          eor.store_id,
          s.store_code,
          s.store_name,
          eor.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          p.position_code,
          p.position_name,
          eor.request_status,
          eor.requested_termination_date,
          eor.termination_reason,
          eor.request_reason,
          eor.submitted_by_user_id,
          eor.reviewed_by_user_id,
          eor.reviewed_at,
          eor.review_note,
          eor.created_at,
          eor.updated_at
        FROM ops.employee_offboarding_request eor
        INNER JOIN ops.store s
          ON s.store_id = eor.store_id
        INNER JOIN ops.employee e
          ON e.employee_id = eor.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.position_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = eor.employee_id
            AND eah.store_id = eor.store_id
          ORDER BY
            CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
            eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.position p
          ON p.position_id = assignment.position_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY eor.created_at DESC, eor.offboarding_request_id DESC
        LIMIT 50
      `,
      params,
    );

    return result.rows;
  }

  async getOffboardingRequestById(requestId: string) {
    const result = await this.databaseService.query<EmployeeOffboardingRequestRow>(
      `
        SELECT
          eor.offboarding_request_id,
          eor.company_id,
          eor.region_id,
          eor.store_id,
          s.store_code,
          s.store_name,
          eor.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          p.position_code,
          p.position_name,
          eor.request_status,
          eor.requested_termination_date,
          eor.termination_reason,
          eor.request_reason,
          eor.submitted_by_user_id,
          eor.reviewed_by_user_id,
          eor.reviewed_at,
          eor.review_note,
          eor.created_at,
          eor.updated_at
        FROM ops.employee_offboarding_request eor
        INNER JOIN ops.store s
          ON s.store_id = eor.store_id
        INNER JOIN ops.employee e
          ON e.employee_id = eor.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.position_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = eor.employee_id
            AND eah.store_id = eor.store_id
          ORDER BY
            CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
            eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.position p
          ON p.position_id = assignment.position_id
        WHERE eor.offboarding_request_id = $1::uuid
        LIMIT 1
      `,
      [requestId],
    );

    return result.rows[0] ?? null;
  }

  async approveOffboardingRequest(input: {
    request: EmployeeOffboardingRequestRow;
    actorUserId: string;
    reviewNote?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          UPDATE ops.employee
          SET
            employment_status = 'terminated',
            termination_date = $2::date
          WHERE employee_id = $1::uuid
        `,
        [input.request.employee_id, input.request.requested_termination_date],
      );

      const assignmentResult = await client.query<{ assignment_id: string }>(
        `
          UPDATE ops.employee_assignment_history
          SET
            end_date = $3::date,
            assignment_status = 'inactive'
          WHERE employee_id = $1::uuid
            AND store_id = $2::uuid
            AND assignment_status = 'active'
            AND end_date IS NULL
          RETURNING assignment_id
        `,
        [input.request.employee_id, input.request.store_id, input.request.requested_termination_date],
      );
      const assignmentId = assignmentResult.rows[0]?.assignment_id ?? null;

      await client.query(
        `
          INSERT INTO ops.turnover_event (
            employee_id,
            store_id,
            region_id,
            company_id,
            event_date,
            event_type,
            termination_reason_code,
            source_assignment_id
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, 'termination', $6, $7::uuid)
        `,
        [
          input.request.employee_id,
          input.request.store_id,
          input.request.region_id,
          input.request.company_id,
          input.request.requested_termination_date,
          input.request.termination_reason,
          assignmentId,
        ],
      );

      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = 'approved',
              reviewed_by_user_id = $2,
              reviewed_at = NOW(),
              review_note = $3,
              updated_at = NOW()
            WHERE offboarding_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.offboarding_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            p.position_code,
            p.position_name,
            updated.request_status,
            updated.requested_termination_date,
            updated.termination_reason,
            updated.request_reason,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.employee e
            ON e.employee_id = updated.employee_id
          LEFT JOIN LATERAL (
            SELECT eah.position_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = updated.employee_id
              AND eah.store_id = updated.store_id
            ORDER BY eah.start_date DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
        `,
        [
          input.request.offboarding_request_id,
          input.actorUserId,
          input.reviewNote ?? null,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'employee_offboarding_request.approved',
            'ops.employee_offboarding_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.offboarding_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            employeeId: input.request.employee_id,
            terminationDate: input.request.requested_termination_date,
            terminationReason: input.request.termination_reason,
            assignmentId,
          }),
        ],
      );

      return request;
    });
  }

  async rejectOffboardingRequest(input: {
    request: EmployeeOffboardingRequestRow;
    actorUserId: string;
    reviewNote: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = 'rejected',
              reviewed_by_user_id = $2,
              reviewed_at = NOW(),
              review_note = $3,
              updated_at = NOW()
            WHERE offboarding_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.offboarding_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            p.position_code,
            p.position_name,
            updated.request_status,
            updated.requested_termination_date,
            updated.termination_reason,
            updated.request_reason,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.employee e
            ON e.employee_id = updated.employee_id
          LEFT JOIN LATERAL (
            SELECT eah.position_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = updated.employee_id
              AND eah.store_id = updated.store_id
            ORDER BY
              CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
              eah.start_date DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
        `,
        [
          input.request.offboarding_request_id,
          input.actorUserId,
          input.reviewNote,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'employee_offboarding_request.rejected',
            'ops.employee_offboarding_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.offboarding_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            employeeId: input.request.employee_id,
            reviewNote: input.reviewNote,
          }),
        ],
      );

      return request;
    });
  }

  async resubmitOffboardingRequest(input: {
    request: EmployeeOffboardingRequestRow;
    companyId: string;
    regionId: string;
    storeId: string;
    employeeId: string;
    terminationDate: string;
    terminationReason: string;
    requestReason: string;
    actorUserId: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = 'pending_hr_approval',
              company_id = $2::uuid,
              region_id = $3::uuid,
              store_id = $4::uuid,
              employee_id = $5::uuid,
              requested_termination_date = $6::date,
              termination_reason = $7,
              request_reason = $8,
              submitted_by_user_id = $9,
              reviewed_by_user_id = NULL,
              reviewed_at = NULL,
              review_note = NULL,
              updated_at = NOW()
            WHERE offboarding_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            updated.offboarding_request_id,
            updated.company_id,
            updated.region_id,
            updated.store_id,
            s.store_code,
            s.store_name,
            updated.employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            p.position_code,
            p.position_name,
            updated.request_status,
            updated.requested_termination_date,
            updated.termination_reason,
            updated.request_reason,
            updated.submitted_by_user_id,
            updated.reviewed_by_user_id,
            updated.reviewed_at,
            updated.review_note,
            updated.created_at,
            updated.updated_at
          FROM updated
          INNER JOIN ops.store s
            ON s.store_id = updated.store_id
          INNER JOIN ops.employee e
            ON e.employee_id = updated.employee_id
          LEFT JOIN LATERAL (
            SELECT eah.position_id
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = updated.employee_id
              AND eah.store_id = updated.store_id
            ORDER BY
              CASE WHEN eah.assignment_status = 'active' AND eah.end_date IS NULL THEN 0 ELSE 1 END,
              eah.start_date DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
        `,
        [
          input.request.offboarding_request_id,
          input.companyId,
          input.regionId,
          input.storeId,
          input.employeeId,
          input.terminationDate,
          input.terminationReason,
          input.requestReason,
          input.actorUserId,
        ],
      );

      const request = result.rows[0];

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            NULL,
            'employee_offboarding_request.resubmitted',
            'ops.employee_offboarding_request',
            $1::uuid,
            'store',
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::jsonb
          )
        `,
        [
          request.offboarding_request_id,
          request.company_id,
          request.region_id,
          request.store_id,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            actorUserId: input.actorUserId,
            employeeId: input.employeeId,
            previousReviewNote: input.request.review_note,
            terminationDate: input.terminationDate,
            terminationReason: input.terminationReason,
          }),
        ],
      );

      return request;
    });
  }
}
