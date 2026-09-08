import { DatabaseService } from "../../../shared/database/database.service";
import {
  WORKFORCE_SELLER_CODE_TRANSITIONS,
} from "../application/workforce-request-transition.policy";
import { type SellerCodeRequestRow } from "./workforce-seller-code-read.repository";
import { WorkforceRequestAuditRepository } from "./workforce-request-audit.repository";
import { sellerCodeRequestReturnProjection } from "./workforce-request-write-sql";
import { IdentityLifecycleRepository } from "../../auth/identity-lifecycle.repository";

export class WorkforceSellerCodeCommandRepository {
  private readonly auditRepository = new WorkforceRequestAuditRepository();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly identityLifecycleRepository?: IdentityLifecycleRepository,
  ) {}

  async countSellerCodeDuplicates(sellerCode: string) {
    const result = await this.databaseService.query<{
      seller_code_duplicate_count: string;
    }>(
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
            national_id_last4,
            phone_number,
            hire_date,
            employment_status,
            employment_type
          )
          VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::date, 'active', $9)
          RETURNING employee_id
        `,
        [
          input.request.company_id,
          input.sellerCode,
          input.request.first_name,
          input.request.last_name,
          input.request.national_id_hash,
          input.request.national_id_last4,
          input.request.phone_number,
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

      await this.identityLifecycleRepository?.createEmployeeUserInTransaction(client, {
        employeeId,
        username: input.request.requested_username!,
        email: input.request.requested_email!,
        companyId: input.request.company_id,
        regionId: input.request.region_id,
        storeId: input.request.store_id,
        actorUserId: input.actorUserId,
      });

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
          input.sellerCode,
          employeeId,
          input.actorUserId,
          input.reviewNote ?? null,
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
          employeeId,
          sellerCode: input.sellerCode,
          reviewNote: input.reviewNote ?? null,
        },
      });

      return request;
    });
  }
}
