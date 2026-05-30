import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { AccessLifecycleRepository } from "../../auth/access-lifecycle.repository";
import { WorkforceLookupReadRepository } from "./workforce-lookup-read.repository";
import {
  WorkforceOffboardingReadRepository,
  type EmployeeOffboardingRequestRow,
} from "./workforce-offboarding-read.repository";
import {
  WorkforceSellerCodeReadRepository,
  type SellerCodeRequestRow,
} from "./workforce-seller-code-read.repository";
import {
  WORKFORCE_OFFBOARDING_TRANSITIONS,
  WORKFORCE_SELLER_CODE_TRANSITIONS,
} from "../application/workforce-request-transition.policy";

type OffboardingAccessClosure = {
  userAccessClosed: boolean;
  closedUserId: string | null;
  closedRoleAssignments: number;
  closedActionStoreAssignments: number;
  revokedMobileSessions: number;
};

type WorkforceAuditClient = Pick<PoolClient, "query">;

type WorkforceAuditEventInput = {
  actorUserId: string;
  eventType: string;
  entityName: string;
  entityId: string;
  companyId: string;
  regionId: string;
  storeId: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class WorkforceRequestRepository {
  private readonly lookupReadRepository: WorkforceLookupReadRepository;
  private readonly offboardingReadRepository: WorkforceOffboardingReadRepository;
  private readonly sellerCodeReadRepository: WorkforceSellerCodeReadRepository;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly accessLifecycleRepository: AccessLifecycleRepository,
  ) {
    this.lookupReadRepository =
      new WorkforceLookupReadRepository(databaseService);
    this.offboardingReadRepository =
      new WorkforceOffboardingReadRepository(databaseService);
    this.sellerCodeReadRepository =
      new WorkforceSellerCodeReadRepository(databaseService);
  }

  async getLatestFranchiseSellerCode() {
    return this.lookupReadRepository.getLatestFranchiseSellerCode();
  }

  async getStoreForSellerCodeRequest(storeId: string) {
    return this.lookupReadRepository.getStoreForSellerCodeRequest(storeId);
  }

  async listPositionOptionsForStore(input: { storeId: string }) {
    return this.lookupReadRepository.listPositionOptionsForStore(input);
  }

  async listActiveStoreEmployees(input: { storeId: string }) {
    return this.lookupReadRepository.listActiveStoreEmployees(input);
  }

  async getActiveStoreEmployeeForOffboarding(input: {
    storeId: string;
    employeeId: string;
  }) {
    return this.lookupReadRepository.getActiveStoreEmployeeForOffboarding(
      input,
    );
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
    const transition = WORKFORCE_SELLER_CODE_TRANSITIONS.create;

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

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.submittedByUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.seller_code_request_id,
        companyId: input.companyId,
        regionId: input.regionId,
        storeId: input.storeId,
        metadata: {
          requestType: input.requestType,
          storeType: input.storeType,
          requestedSellerCode: input.requestedSellerCode ?? null,
          lastReferenceSellerCode: input.lastReferenceSellerCode,
        },
      });

      return request;
    });
  }

  async listSellerCodeRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    status?: string;
  }) {
    return this.sellerCodeReadRepository.listSellerCodeRequests(input);
  }

  async getSellerCodeRequestById(requestId: string) {
    return this.sellerCodeReadRepository.getSellerCodeRequestById(requestId);
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
    const transition = WORKFORCE_SELLER_CODE_TRANSITIONS.approve;

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
              request_status = $2,
              approved_seller_code = $3,
              employee_id = $4::uuid,
              reviewed_by_user_id = $5,
              reviewed_at = NOW(),
              review_note = $6,
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
          transition.targetStatus,
          input.sellerCode,
          employeeId,
          input.actorUserId,
          input.reviewNote ?? null,
        ],
      );

      const request = result.rows[0];

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.seller_code_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          employeeId,
          sellerCode: input.sellerCode,
          reviewNote: input.reviewNote ?? null,
        },
      });

      return request;
    });
  }

  async rejectSellerCodeRequest(input: {
    request: SellerCodeRequestRow;
    actorUserId: string;
    reviewNote: string;
  }) {
    const transition = WORKFORCE_SELLER_CODE_TRANSITIONS.reject;

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.seller_code_request
            SET
              request_status = $2,
              reviewed_by_user_id = $3,
              reviewed_at = NOW(),
              review_note = $4,
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
          transition.targetStatus,
          input.actorUserId,
          input.reviewNote,
        ],
      );

      const request = result.rows[0];

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.seller_code_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          reviewNote: input.reviewNote,
        },
      });

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
    const transition = WORKFORCE_SELLER_CODE_TRANSITIONS.resubmit;

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<SellerCodeRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.seller_code_request
            SET
              request_status = $2,
              first_name = $3,
              last_name = $4,
              national_id_hash = $5,
              national_id_last4 = $6,
              phone_number = $7,
              requested_hire_date = $8::date,
              requested_position_id = $9::uuid,
              employment_type = $10,
              request_reason = $11,
              requested_seller_code = NULL,
              approved_seller_code = NULL,
              last_reference_seller_code = $12,
              submitted_by_user_id = $13,
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
          transition.targetStatus,
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

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.seller_code_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          previousReviewNote: input.request.review_note,
          lastReferenceSellerCode: input.lastReferenceSellerCode,
        },
      });

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
    const transition = WORKFORCE_OFFBOARDING_TRANSITIONS.create;

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

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.submittedByUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.offboarding_request_id,
        companyId: input.companyId,
        regionId: input.regionId,
        storeId: input.storeId,
        metadata: {
          employeeId: input.employeeId,
          terminationDate: input.terminationDate,
          terminationReason: input.terminationReason,
        },
      });

      return request;
    });
  }

  async listOffboardingRequests(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    status?: string;
  }) {
    return this.offboardingReadRepository.listOffboardingRequests(input);
  }

  async getOffboardingRequestById(requestId: string) {
    return this.offboardingReadRepository.getOffboardingRequestById(requestId);
  }

  async approveOffboardingRequest(input: {
    request: EmployeeOffboardingRequestRow;
    actorUserId: string;
    reviewNote?: string;
  }) {
    const transition = WORKFORCE_OFFBOARDING_TRANSITIONS.approve;

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

      const linkedUserResult = await client.query<{ user_id: string }>(
        `
          /* offboarding_linked_user_account */
          SELECT user_id
          FROM ops.user_account
          WHERE employee_id = $1::uuid
            AND is_active = TRUE
          ORDER BY created_at DESC, user_id DESC
          LIMIT 1
        `,
        [input.request.employee_id],
      );

      let accessClosure: OffboardingAccessClosure = {
        userAccessClosed: false,
        closedUserId: null,
        closedRoleAssignments: 0,
        closedActionStoreAssignments: 0,
        revokedMobileSessions: 0,
      };

      const linkedUserId = linkedUserResult.rows[0]?.user_id;
      if (linkedUserId) {
        const accessLifecycleResult =
          await this.accessLifecycleRepository.deactivateUserAccessInTransaction(client, {
            userId: linkedUserId,
            actorUserId: input.actorUserId,
            reason: "employee_offboarding",
            sourceEntity: {
              entityName: "ops.employee_offboarding_request",
              entityId: input.request.offboarding_request_id,
            },
          });

        accessClosure = {
          userAccessClosed: Boolean(accessLifecycleResult.user),
          closedUserId: accessLifecycleResult.user?.user_id ?? null,
          closedRoleAssignments: accessLifecycleResult.closedRoleAssignments,
          closedActionStoreAssignments: accessLifecycleResult.closedActionStoreAssignments,
          revokedMobileSessions: accessLifecycleResult.revokedMobileSessions,
        };
      }

      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = $2,
              reviewed_by_user_id = $3,
              reviewed_at = NOW(),
              review_note = $4,
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
          transition.targetStatus,
          input.actorUserId,
          input.reviewNote ?? null,
        ],
      );

      const request = result.rows[0];

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.offboarding_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          employeeId: input.request.employee_id,
          terminationDate: input.request.requested_termination_date,
          terminationReason: input.request.termination_reason,
          assignmentId,
        },
      });

      return {
        request,
        accessClosure,
      };
    });
  }

  async rejectOffboardingRequest(input: {
    request: EmployeeOffboardingRequestRow;
    actorUserId: string;
    reviewNote: string;
  }) {
    const transition = WORKFORCE_OFFBOARDING_TRANSITIONS.reject;

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = $2,
              reviewed_by_user_id = $3,
              reviewed_at = NOW(),
              review_note = $4,
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
          transition.targetStatus,
          input.actorUserId,
          input.reviewNote,
        ],
      );

      const request = result.rows[0];

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.offboarding_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          employeeId: input.request.employee_id,
          reviewNote: input.reviewNote,
        },
      });

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
    const transition = WORKFORCE_OFFBOARDING_TRANSITIONS.resubmit;

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<EmployeeOffboardingRequestRow>(
        `
          WITH updated AS (
            UPDATE ops.employee_offboarding_request
            SET
              request_status = $2,
              company_id = $3::uuid,
              region_id = $4::uuid,
              store_id = $5::uuid,
              employee_id = $6::uuid,
              requested_termination_date = $7::date,
              termination_reason = $8,
              request_reason = $9,
              submitted_by_user_id = $10,
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
          transition.targetStatus,
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

      await this.insertWorkforceAuditEvent(client, {
        actorUserId: input.actorUserId,
        eventType: transition.auditEventType,
        entityName: transition.entityName,
        entityId: request.offboarding_request_id,
        companyId: request.company_id,
        regionId: request.region_id,
        storeId: request.store_id,
        metadata: {
          employeeId: input.employeeId,
          previousReviewNote: input.request.review_note,
          terminationDate: input.terminationDate,
          terminationReason: input.terminationReason,
        },
      });

      return request;
    });
  }

  private async insertWorkforceAuditEvent(
    client: WorkforceAuditClient,
    input: WorkforceAuditEventInput,
  ) {
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
          $1::uuid,
          $2,
          $3,
          $4::uuid,
          'store',
          $5::uuid,
          $6::uuid,
          $7::uuid,
          $8::jsonb
        )
      `,
      [
        input.actorUserId,
        input.eventType,
        input.entityName,
        input.entityId,
        input.companyId,
        input.regionId,
        input.storeId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          actorUserId: input.actorUserId,
          ...input.metadata,
        }),
      ],
    );
  }
}
