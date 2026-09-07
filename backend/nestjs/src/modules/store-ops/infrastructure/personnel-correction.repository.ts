import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { assertCorrectionStore, correctionReviewCompanies, correctionStoreScope } from "../application/personnel-correction-scope";
import type { CreatePersonnelCorrectionInput, PersonnelCorrectionValues, ReviewPersonnelCorrectionInput } from "../application/personnel-correction.types";
import { WorkforceRequestAuditRepository } from "./workforce-request-audit.repository";

type PersonnelState = {
  company_id: string; region_id: string; store_id: string; employee_id: string;
  assignment_id: string; employee_revision: string; assignment_revision: string;
  revision: string; values: PersonnelCorrectionValues;
};
type CorrectionRow = {
  request_id: string; company_id: string; region_id: string; store_id: string;
  employee_id: string; assignment_id: string; employee_revision: string;
  assignment_revision: string; previous_values: PersonnelCorrectionValues;
  proposed_values: PersonnelCorrectionValues; request_reason: string;
  request_status: string; review_note: string | null; created_at: string;
};

@Injectable()
export class PersonnelCorrectionRepository {
  private readonly audit = new WorkforceRequestAuditRepository();
  constructor(private readonly database: DatabaseService) {}

  private async state(client: PoolClient, employeeId: string, storeId: string) {
    // Lock the employee first, consistently with master-data editing and offboarding.
    const employee = await client.query(`SELECT employee_id FROM ops.employee
      WHERE employee_id=$1::uuid AND employment_status='active'
      AND EXISTS (SELECT 1 FROM ops.employee_assignment_history a JOIN ops.store s
        ON s.store_id=a.store_id AND s.company_id=ops.employee.company_id
        WHERE a.employee_id=ops.employee.employee_id AND a.store_id=$2::uuid
          AND s.status='active' AND a.assignment_status='active'
          AND a.is_primary_assignment AND a.end_date IS NULL) FOR UPDATE`, [employeeId, storeId]);
    if (!employee.rows.length) throw new NotFoundException("Active personnel not found");
    const result = await client.query<PersonnelState>(`SELECT e.company_id::text, s.region_id::text,
      s.store_id::text, e.employee_id::text, a.assignment_id::text,
      e.updated_at::text employee_revision, a.updated_at::text assignment_revision,
      concat(e.updated_at::text, '|', a.assignment_id::text, '|', a.updated_at::text) revision,
      jsonb_build_object('firstName', e.first_name, 'lastName', e.last_name,
        'phoneNumber', COALESCE(e.phone_number,''), 'hireDate', e.hire_date::text,
        'employmentType', e.employment_type, 'positionId', a.position_id::text) AS "values"
      FROM ops.employee e JOIN ops.employee_assignment_history a ON a.employee_id=e.employee_id
      JOIN ops.store s ON s.store_id=a.store_id AND s.company_id=e.company_id
      WHERE e.employee_id=$1::uuid AND s.store_id=$2::uuid AND s.status='active'
        AND a.assignment_status='active' AND a.is_primary_assignment AND a.end_date IS NULL
      FOR UPDATE OF a FOR SHARE OF s`, [employeeId, storeId]);
    if (result.rows.length !== 1) throw new NotFoundException("Active store assignment not found");
    return result.rows[0];
  }

  private async validatePosition(client: PoolClient, companyId: string, positionId: string) {
    const result = await client.query(`SELECT position_id FROM ops.position
      WHERE company_id=$1::uuid AND position_id=$2::uuid FOR SHARE`, [companyId, positionId]);
    if (!result.rows.length) throw new BadRequestException("Position must belong to the personnel company");
  }

  async getPersonnel(actor: AuthenticatedUser, employeeId: string, storeId: string) {
    assertCorrectionStore(actor, storeId);
    return this.database.withTransaction(async (client) => {
      const state = await this.state(client, employeeId, storeId);
      const positions = await client.query<{ positionId: string; positionName: string }>(
        `SELECT position_id::text AS "positionId", position_name AS "positionName"
         FROM ops.position WHERE company_id=$1::uuid ORDER BY position_name`, [state.company_id]);
      return { employeeId, storeId, revision: state.revision, values: state.values, positions: positions.rows };
    });
  }

  async list(actor: AuthenticatedUser, input: { status?: string; storeId?: string; limit?: number; offset?: number }) {
    const result = await this.database.query<CorrectionRow & { store_name: string }>(
      `SELECT r.*, s.store_name, old_position.position_name previous_position_name,
         new_position.position_name proposed_position_name FROM ops.personnel_correction_request r
       JOIN ops.store s ON s.store_id=r.store_id AND s.company_id=r.company_id
       LEFT JOIN ops.position old_position ON old_position.position_id=(r.previous_values->>'positionId')::uuid AND old_position.company_id=r.company_id
       LEFT JOIN ops.position new_position ON new_position.position_id=(r.proposed_values->>'positionId')::uuid AND new_position.company_id=r.company_id
       WHERE (r.company_id=ANY($1::uuid[]) OR r.store_id=ANY($2::uuid[]))
         AND ($3::text IS NULL OR r.request_status=$3)
         AND ($4::uuid IS NULL OR r.store_id=$4::uuid)
       ORDER BY r.created_at DESC, r.request_id DESC LIMIT $5 OFFSET $6`,
      [correctionReviewCompanies(actor), correctionStoreScope(actor), input.status ?? null,
        input.storeId ?? null, input.limit ?? 50, input.offset ?? 0]);
    return { items: result.rows };
  }

  async submit(actor: AuthenticatedUser, input: CreatePersonnelCorrectionInput) {
    assertCorrectionStore(actor, input.storeId);
    return this.database.withTransaction(async (client) => {
      const state = await this.state(client, input.employeeId, input.storeId);
      if (state.revision !== input.expectedRevision) throw new ConflictException("Personnel changed; reload before submitting");
      await this.validatePosition(client, state.company_id, input.proposed.positionId);
      const pending = await client.query(`SELECT request_id FROM ops.personnel_correction_request
        WHERE employee_id=$1::uuid AND request_status='pending_hr_approval'`, [input.employeeId]);
      if (pending.rows.length) throw new ConflictException("Personnel already has a pending correction");
      const result = await client.query<CorrectionRow>(`INSERT INTO ops.personnel_correction_request
        (company_id, region_id, store_id, employee_id, assignment_id, employee_revision,
         assignment_revision, previous_values, proposed_values, request_reason, submitted_by_user_id)
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::timestamptz,$7::timestamptz,
          $8::jsonb,$9::jsonb,$10,$11::uuid) RETURNING *`,
      [state.company_id, state.region_id, input.storeId, input.employeeId, state.assignment_id,
        state.employee_revision, state.assignment_revision, JSON.stringify(state.values),
        JSON.stringify(input.proposed), input.reason, actor.userId]);
      const row = result.rows[0];
      await this.writeAudit(client, actor, row, "submitted");
      return row;
    });
  }

  async review(actor: AuthenticatedUser, requestId: string, input: ReviewPersonnelCorrectionInput) {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<CorrectionRow>(`SELECT * FROM ops.personnel_correction_request
        WHERE request_id=$1::uuid AND company_id=ANY($2::uuid[]) FOR UPDATE`,
      [requestId, correctionReviewCompanies(actor)]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException("Correction request not found");
      if (row.request_status !== "pending_hr_approval") throw new ConflictException("Correction already reviewed");
      if (input.decision === "approve") {
        const state = await this.state(client, row.employee_id, row.store_id);
        const current = await client.query<{ matches: boolean }>(`SELECT
          employee_revision=$2::timestamptz AND assignment_revision=$3::timestamptz
          AND assignment_id=$4::uuid AS matches FROM ops.personnel_correction_request WHERE request_id=$1::uuid`,
        [requestId, state.employee_revision, state.assignment_revision, state.assignment_id]);
        if (!current.rows[0]?.matches || state.company_id !== row.company_id) {
          throw new ConflictException("Personnel changed; reject this request and ask for a new correction");
        }
        const values = row.proposed_values;
        await this.validatePosition(client, state.company_id, values.positionId);
        await client.query(`UPDATE ops.employee SET first_name=$2, last_name=$3,
          phone_number=NULLIF($4,''), hire_date=$5::date, employment_type=$6, updated_at=NOW()
          WHERE employee_id=$1::uuid`, [row.employee_id, values.firstName, values.lastName,
          values.phoneNumber, values.hireDate, values.employmentType]);
        // A profile correction does not transfer, terminate or rewrite assignment history.
        await client.query(`UPDATE ops.employee_assignment_history SET position_id=$2::uuid,
          updated_at=NOW() WHERE assignment_id=$1::uuid`, [state.assignment_id, values.positionId]);
      }
      const updated = await client.query<CorrectionRow>(`UPDATE ops.personnel_correction_request
        SET request_status=$2, reviewed_by_user_id=$3::uuid, review_note=$4,
          reviewed_at=NOW(), updated_at=NOW() WHERE request_id=$1::uuid RETURNING *`,
      [requestId, input.decision === "approve" ? "approved" : "rejected", actor.userId, input.note]);
      await this.writeAudit(client, actor, row, input.decision === "approve" ? "approved" : "rejected");
      return updated.rows[0];
    });
  }

  private writeAudit(client: PoolClient, actor: AuthenticatedUser, row: CorrectionRow, status: string) {
    return this.audit.insertWorkforceAuditEvent(client, {
      actorUserId: actor.userId, eventType: `personnel_correction.${status}`,
      entityName: "personnel_correction_request", entityId: row.request_id,
      companyId: row.company_id, regionId: row.region_id, storeId: row.store_id,
      metadata: { employeeId: row.employee_id, requestId: row.request_id, status },
    });
  }
}
