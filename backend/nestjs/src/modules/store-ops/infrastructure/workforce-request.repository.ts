import { lockOffboardingTransition } from "./offboarding-transition-lock";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { AccessLifecycleRepository } from "../../auth/access-lifecycle.repository";
import { IdentityLifecycleRepository } from "../../auth/identity-lifecycle.repository";
import { WorkforceLookupReadRepository } from "./workforce-lookup-read.repository";
import { WorkforceRequestAuditRepository } from "./workforce-request-audit.repository";
import {
  offboardingRequestReturnProjection,
  sellerCodeRequestReturnProjection,
} from "./workforce-request-write-sql";
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
import { WorkforceSellerCodeCommandRepository } from "./workforce-seller-code-command.repository";

type OffboardingAccessClosure = {
  userAccessClosed: boolean;
  closedUserId: string | null;
  closedRoleAssignments: number;
  closedActionStoreAssignments: number;
  revokedMobileSessions: number;
};
@Injectable()
export class WorkforceRequestRepository {
  private readonly auditRepository = new WorkforceRequestAuditRepository();
  private readonly lookupReadRepository: WorkforceLookupReadRepository;
  private readonly offboardingReadRepository: WorkforceOffboardingReadRepository;
  private readonly sellerCodeCommandRepository: WorkforceSellerCodeCommandRepository;
  private readonly sellerCodeReadRepository: WorkforceSellerCodeReadRepository;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly accessLifecycleRepository: AccessLifecycleRepository,
    private readonly identityLifecycleRepository?: IdentityLifecycleRepository,
  ) {
    this.lookupReadRepository =
      new WorkforceLookupReadRepository(databaseService);
    this.offboardingReadRepository =
      new WorkforceOffboardingReadRepository(databaseService);
    this.sellerCodeCommandRepository =
      new WorkforceSellerCodeCommandRepository(databaseService, identityLifecycleRepository);
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
    username: string;
    email: string;
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
              requested_username,
              requested_email,
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
              $11,
              $12,
              $13::date,
              $14::uuid,
              $15,
              $16,
              $17,
              $18,
              $19
            )
            RETURNING *
          )
          SELECT
            ${sellerCodeRequestReturnProjection("inserted")}
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
          input.username,
          input.email,
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
    limit: number;
    offset: number;
  }) {
    return this.sellerCodeReadRepository.listSellerCodeRequests(input);
  }

  async getSellerCodeRequestById(requestId: string) {
    return this.sellerCodeReadRepository.getSellerCodeRequestById(requestId);
  }

  async countSellerCodeDuplicates(sellerCode: string) {
    return this.sellerCodeCommandRepository.countSellerCodeDuplicates(sellerCode);
  }

  async approveSellerCodeRequest(input: {
    request: SellerCodeRequestRow;
    sellerCode: string;
    actorUserId: string;
    reviewNote?: string;
  }) {
    return this.sellerCodeCommandRepository.approveSellerCodeRequest(input);
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
            ${sellerCodeRequestReturnProjection("updated")}
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
    username: string;
    email: string;
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
              requested_username = $8,
              requested_email = $9,
              requested_hire_date = $10::date,
              requested_position_id = $11::uuid,
              employment_type = $12,
              request_reason = $13,
              requested_seller_code = NULL,
              approved_seller_code = NULL,
              last_reference_seller_code = $14,
              submitted_by_user_id = $15,
              reviewed_by_user_id = NULL,
              reviewed_at = NULL,
              review_note = NULL,
              employee_id = NULL,
              updated_at = NOW()
            WHERE seller_code_request_id = $1::uuid
            RETURNING *
          )
          SELECT
            ${sellerCodeRequestReturnProjection("updated")}
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
          input.username,
          input.email,
          input.hireDate,
          input.requestedPositionId,
          input.employmentType,
          input.requestReason ?? null,
          input.lastReferenceSellerCode,
          input.actorUserId,
        ],
      );

      const request = result.rows[0];

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
            ${offboardingRequestReturnProjection("inserted")}
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
    limit: number;
    offset: number;
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
      await lockOffboardingTransition(client, input.request, transition.sourceStatus);
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
            ${offboardingRequestReturnProjection("updated")}
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
      await lockOffboardingTransition(client, input.request, transition.sourceStatus);
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
            ${offboardingRequestReturnProjection("updated")}
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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
      await lockOffboardingTransition(client, input.request, transition.sourceStatus);
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
            ${offboardingRequestReturnProjection("updated")}
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

      await this.auditRepository.insertWorkforceAuditEvent(client, {
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

}
