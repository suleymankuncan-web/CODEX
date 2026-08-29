import { ConflictException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { AccessLifecycleRepository } from "../../auth/access-lifecycle.repository";

@Injectable()
export class PersonnelMasterCommandRepository {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly accessLifecycleRepository: AccessLifecycleRepository,
  ) {}

  private async resolveAuditActorUserId(
    actorUserId: string | null | undefined,
    client?: PoolClient,
  ) {
    if (!actorUserId) return null;
    const sql = `
      SELECT user_id
      FROM ops.user_account
      WHERE user_id = $1::uuid
      LIMIT 1
    `;
    const result = client
      ? await client.query<{ user_id: string }>(sql, [actorUserId])
      : await this.databaseService.query<{ user_id: string }>(sql, [actorUserId]);
    return result.rows[0]?.user_id ?? null;
  }
  async updatePersonnelMaster(input: {
    actorCompanyIds: string[];
    employeeId: string;
    firstName: string;
    lastName: string;
    externalEmployeeRef?: string;
    phoneNumber?: string;
    employmentStatus: "active" | "inactive" | "terminated";
    employmentType: "full_time" | "part_time" | "temporary";
    hireDate: string;
    storeId: string;
    positionId: string;
    assignmentStartDate?: string;
    actorUserId: string;
    expectedUpdatedAt?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const employeeResult = await client.query<{
        employee_id: string;
        company_id: string;
        updated_at: string;
      }>(
        `
          SELECT
            employee_id::text AS employee_id,
            company_id::text AS company_id,
            updated_at::text AS updated_at
          FROM ops.employee
          WHERE employee_id = $1::uuid
            AND company_id = ANY($2::uuid[])
          LIMIT 1
          FOR UPDATE
        `,
        [input.employeeId, input.actorCompanyIds],
      );
      const employee = employeeResult.rows[0] ?? null;
      if (!employee) {
        return null;
      }

      const storeResult = await client.query<{
        store_id: string;
        region_id: string;
        company_id: string;
      }>(
        `
          SELECT
            s.store_id::text AS store_id,
            s.region_id::text AS region_id,
            s.company_id::text AS company_id
          FROM ops.store s
          WHERE s.store_id = $1::uuid
            AND s.company_id = $2::uuid
          LIMIT 1
        `,
        [input.storeId, employee.company_id],
      );
      const store = storeResult.rows[0] ?? null;
      if (!store) {
        return null;
      }

      const positionResult = await client.query<{ position_id: string }>(
        `
          SELECT p.position_id::text AS position_id
          FROM ops.position p
          WHERE p.position_id = $1::uuid
            AND p.company_id = $2::uuid
          LIMIT 1
        `,
        [input.positionId, employee.company_id],
      );
      if (!positionResult.rows[0]) {
        return null;
      }

      const assignmentStartDate = input.assignmentStartDate ?? input.hireDate;
      const assignmentResult = await client.query<{ assignment_id: string }>(
        `
          SELECT assignment_id::text AS assignment_id
          FROM ops.employee_assignment_history
          WHERE employee_id = $1::uuid
            AND is_primary_assignment = TRUE
            AND assignment_status = 'active'
            AND end_date IS NULL
          ORDER BY start_date DESC, created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [input.employeeId],
      );
      const assignmentId = assignmentResult.rows[0]?.assignment_id ?? null;

      const freshnessResult = await client.query<{ is_current: boolean }>(
        `
          SELECT ($2::timestamptz IS NULL OR GREATEST(
            e.updated_at,
            COALESCE(assignment.updated_at, e.updated_at)
          ) = $2::timestamptz) AS is_current
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT eah.updated_at
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            ORDER BY eah.start_date DESC, eah.created_at DESC
            LIMIT 1
          ) assignment ON TRUE
          WHERE e.employee_id = $1::uuid
          LIMIT 1
        `,
        [input.employeeId, input.expectedUpdatedAt ?? null],
      );
      if (!freshnessResult.rows[0]?.is_current) {
        throw new ConflictException("Personnel master data changed after it was loaded");
      }

      await client.query(
        `
          UPDATE ops.employee
          SET
            external_employee_ref = NULLIF(BTRIM($2), ''),
            first_name = BTRIM($3),
            last_name = BTRIM($4),
            employment_status = $5,
            employment_type = $6,
            hire_date = $7::date,
            phone_number = COALESCE(NULLIF(BTRIM($8), ''), phone_number)
          WHERE employee_id = $1::uuid
        `,
        [
          input.employeeId,
          input.externalEmployeeRef ?? "",
          input.firstName,
          input.lastName,
          input.employmentStatus,
          input.employmentType,
          input.hireDate,
          input.phoneNumber ?? null,
        ],
      );

      if (assignmentId) {
        await client.query(
          `
            UPDATE ops.employee_assignment_history
            SET
              store_id = $2::uuid,
              region_id = $3::uuid,
              position_id = $4::uuid,
              start_date = $5::date
            WHERE assignment_id = $1::uuid
          `,
          [
            assignmentId,
            store.store_id,
            store.region_id,
            input.positionId,
            assignmentStartDate,
          ],
        );
      } else {
        await client.query(
          `
            INSERT INTO ops.employee_assignment_history (
              employee_id,
              store_id,
              region_id,
              position_id,
              start_date,
              is_primary_assignment,
              assignment_status
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, TRUE, 'active')
          `,
          [
            input.employeeId,
            store.store_id,
            store.region_id,
            input.positionId,
            assignmentStartDate,
          ],
        );
      }

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'personnel_master_data.updated', 'ops.employee', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          input.employeeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            storeId: store.store_id,
            regionId: store.region_id,
            positionId: input.positionId,
            employmentStatus: input.employmentStatus,
            employmentType: input.employmentType,
          }),
        ],
      );

      const updated = await client.query<{
        employee_id: string;
        external_employee_ref: string | null;
        first_name: string;
        last_name: string;
        national_id_last4: string | null;
        phone_number: string | null;
        hire_date: string;
        termination_date: string | null;
        employment_status: string;
        employment_type: string;
        assignment_id: string | null;
        assignment_start_date: string | null;
        store_id: string | null;
        store_code: string | null;
        store_name: string | null;
        region_id: string | null;
        region_name: string | null;
        position_id: string | null;
        position_code: string | null;
        position_name: string | null;
        updated_at: string;
      }>(
        `
          SELECT
            e.employee_id::text AS employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            e.national_id_last4,
            e.phone_number,
            e.hire_date::text AS hire_date,
            e.termination_date::text AS termination_date,
            e.employment_status,
            e.employment_type,
            assignment.assignment_id::text AS assignment_id,
            assignment.start_date::text AS assignment_start_date,
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name,
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name,
            GREATEST(
              e.updated_at,
              COALESCE(assignment.updated_at, e.updated_at)
            )::text AS updated_at
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT
              eah.assignment_id,
              eah.store_id,
              eah.region_id,
              eah.position_id,
              eah.start_date,
              eah.updated_at
            FROM ops.employee_assignment_history eah
            WHERE eah.employee_id = e.employee_id
              AND eah.is_primary_assignment = TRUE
              AND eah.assignment_status = 'active'
              AND eah.end_date IS NULL
            ORDER BY eah.start_date DESC, eah.created_at DESC
            LIMIT 1
          ) assignment ON TRUE
          LEFT JOIN ops.store s
            ON s.store_id = assignment.store_id
          LEFT JOIN ops.region r
            ON r.region_id = assignment.region_id
          LEFT JOIN ops.position p
            ON p.position_id = assignment.position_id
          WHERE e.employee_id = $1::uuid
        `,
        [input.employeeId],
      );

      return updated.rows[0] ?? null;
    });
  }

  async createPersonnelMaster(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    firstName: string;
    lastName: string;
    externalEmployeeRef?: string;
    nationalIdHash: string;
    nationalIdAlternateHash: string;
    nationalIdLast4: string;
    phoneNumber: string;
    employmentType: "full_time" | "part_time" | "temporary";
    hireDate: string;
    storeId: string;
    positionId: string;
  }) {
    try {
      return await this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const storeResult = await client.query<{ store_id: string; region_id: string; company_id: string }>(
        `
          SELECT store_id::text, region_id::text, company_id::text
          FROM ops.store
          WHERE store_id = $1::uuid
            AND company_id = ANY($2::uuid[])
            AND status = 'active'
          LIMIT 1
        `,
        [input.storeId, input.actorCompanyIds],
      );
      const store = storeResult.rows[0];
      if (!store) return null;

      const positionResult = await client.query<{ position_id: string }>(
        `SELECT position_id::text FROM ops.position WHERE position_id = $1::uuid AND company_id = $2::uuid LIMIT 1`,
        [input.positionId, store.company_id],
      );
      if (!positionResult.rows[0]) return null;

      if (input.externalEmployeeRef) {
        const duplicateResult = await client.query<{ employee_id: string }>(
          `
            SELECT employee_id::text
            FROM ops.employee
            WHERE company_id = $1::uuid
              AND UPPER(external_employee_ref) = UPPER($2)
            LIMIT 1
          `,
          [store.company_id, input.externalEmployeeRef],
        );
        if (duplicateResult.rows[0]) {
          throw new ConflictException("Personnel reference is already in use");
        }
      }

      const duplicateNationalIdResult = await client.query<{ employee_id: string }>(
        `
          SELECT employee_id::text
          FROM ops.employee
          WHERE company_id = $1::uuid
            AND national_id_hash = ANY($2::text[])
          LIMIT 1
        `,
        [store.company_id, [input.nationalIdHash, input.nationalIdAlternateHash]],
      );
      if (duplicateNationalIdResult.rows[0]) {
        throw new ConflictException("Personnel national identity is already in use");
      }

      const employeeResult = await client.query<{ employee_id: string }>(
        `
          INSERT INTO ops.employee (
            company_id, external_employee_ref, first_name, last_name,
            national_id_hash, national_id_last4, phone_number,
            hire_date, employment_status, employment_type
          )
          VALUES (
            $1::uuid, NULLIF(BTRIM($2), ''), BTRIM($3), BTRIM($4),
            $5, $6, BTRIM($7), $8::date, 'active', $9
          )
          RETURNING employee_id::text
        `,
        [
          store.company_id,
          input.externalEmployeeRef ?? "",
          input.firstName,
          input.lastName,
          input.nationalIdHash,
          input.nationalIdLast4,
          input.phoneNumber,
          input.hireDate,
          input.employmentType,
        ],
      );
      const employeeId = employeeResult.rows[0]?.employee_id;
      if (!employeeId) return null;

      await client.query(
        `
          INSERT INTO ops.employee_assignment_history (
            employee_id, store_id, region_id, position_id, start_date,
            is_primary_assignment, assignment_status
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, TRUE, 'active')
        `,
        [employeeId, store.store_id, store.region_id, input.positionId, input.hireDate],
      );

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id, event_type, entity_name, entity_id, scope_type, metadata_json
          )
          VALUES ($1::uuid, 'personnel_master_data.created', 'ops.employee', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          employeeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            storeId: store.store_id,
            regionId: store.region_id,
            positionId: input.positionId,
          }),
        ],
      );

      const created = await client.query(
        `
          SELECT
            e.employee_id::text AS employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            e.national_id_last4,
            e.phone_number,
            e.hire_date::text AS hire_date,
            e.termination_date::text AS termination_date,
            e.employment_status,
            e.employment_type,
            a.assignment_id::text AS assignment_id,
            a.start_date::text AS assignment_start_date,
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name,
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name,
            GREATEST(e.updated_at, a.updated_at)::text AS updated_at
          FROM ops.employee e
          INNER JOIN ops.employee_assignment_history a
            ON a.employee_id = e.employee_id AND a.assignment_status = 'active' AND a.end_date IS NULL
          INNER JOIN ops.store s ON s.store_id = a.store_id
          INNER JOIN ops.region r ON r.region_id = a.region_id
          INNER JOIN ops.position p ON p.position_id = a.position_id
          WHERE e.employee_id = $1::uuid
          ORDER BY a.created_at DESC
          LIMIT 1
        `,
        [employeeId],
      );
        return created.rows[0] ?? null;
      });
    } catch (error) {
      const constraint = (error as { constraint?: string }).constraint;
      if (constraint === "uq_employee_company_external_ref") {
        throw new ConflictException("Personnel reference is already in use");
      }
      if (constraint === "uq_employee_company_national_id_hash") {
        throw new ConflictException("Personnel national identity is already in use");
      }
      throw error;
    }
  }

  async terminatePersonnelMaster(input: {
    actorCompanyIds: string[];
    actorUserId: string;
    employeeId: string;
    terminationDate: string;
    reason: string;
    expectedUpdatedAt?: string;
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const auditActorUserId = await this.resolveAuditActorUserId(input.actorUserId, client);
      const employeeResult = await client.query<{
        employee_id: string;
        company_id: string;
        hire_date: string;
        employment_status: string;
        is_current: boolean;
      }>(
        `
          SELECT
            e.employee_id::text AS employee_id,
            e.company_id::text AS company_id,
            e.hire_date::text AS hire_date,
            e.employment_status,
            ($3::timestamptz IS NULL OR GREATEST(
              e.updated_at,
              COALESCE(assignment.updated_at, e.updated_at)
            ) = $3::timestamptz) AS is_current
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT updated_at
            FROM ops.employee_assignment_history
            WHERE employee_id = e.employee_id
              AND assignment_status = 'active'
              AND end_date IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
          ) assignment ON TRUE
          WHERE e.employee_id = $1::uuid
            AND e.company_id = ANY($2::uuid[])
          LIMIT 1
          FOR UPDATE OF e
        `,
        [input.employeeId, input.actorCompanyIds, input.expectedUpdatedAt ?? null],
      );
      const employee = employeeResult.rows[0];
      if (!employee) return null;
      if (!employee.is_current) {
        throw new ConflictException("Personnel master data changed after it was loaded");
      }
      if (employee.employment_status === "terminated") {
        throw new ConflictException("Personnel is already terminated");
      }
      if (input.terminationDate < employee.hire_date) {
        throw new ConflictException("Termination date cannot be before hire date");
      }

      const assignmentResult = await client.query<{
        assignment_id: string;
        store_id: string;
        region_id: string;
        start_date: string;
      }>(
        `
          SELECT assignment_id::text, store_id::text, region_id::text, start_date::text
          FROM ops.employee_assignment_history
          WHERE employee_id = $1::uuid
            AND assignment_status = 'active'
            AND end_date IS NULL
          ORDER BY is_primary_assignment DESC, start_date DESC, created_at DESC
          FOR UPDATE
        `,
        [input.employeeId],
      );
      const assignment = assignmentResult.rows[0] ?? null;
      if (assignmentResult.rows.some((item) => input.terminationDate < item.start_date)) {
        throw new ConflictException("Termination date cannot be before an active assignment");
      }

      await client.query(
        `
          UPDATE ops.employee
          SET employment_status = 'terminated', termination_date = $2::date, updated_at = NOW()
          WHERE employee_id = $1::uuid
        `,
        [input.employeeId, input.terminationDate],
      );
      await client.query(
        `
          UPDATE ops.employee_assignment_history
          SET end_date = $2::date, assignment_status = 'inactive', updated_at = NOW()
          WHERE employee_id = $1::uuid
            AND assignment_status = 'active'
            AND end_date IS NULL
        `,
        [input.employeeId, input.terminationDate],
      );

      if (assignment) {
        await client.query(
          `
            INSERT INTO ops.turnover_event (
              employee_id, store_id, region_id, company_id, event_date,
              event_type, termination_reason_code, source_assignment_id
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, 'termination', $6, $7::uuid)
          `,
          [
            input.employeeId,
            assignment.store_id,
            assignment.region_id,
            employee.company_id,
            input.terminationDate,
            input.reason,
            assignment.assignment_id,
          ],
        );
      }

      const linkedUserResult = await client.query<{ user_id: string }>(
        `
          SELECT user_id::text
          FROM ops.user_account
          WHERE employee_id = $1::uuid AND is_active = TRUE
          ORDER BY created_at DESC, user_id DESC
          LIMIT 1
        `,
        [input.employeeId],
      );
      const linkedUserId = linkedUserResult.rows[0]?.user_id ?? null;
      const accessClosure = linkedUserId
        ? await this.accessLifecycleRepository.deactivateUserAccessInTransaction(client, {
            userId: linkedUserId,
            actorUserId: input.actorUserId,
            reason: "employee_offboarding",
            operatorReason: input.reason,
            sourceEntity: { entityName: "ops.employee", entityId: input.employeeId },
          })
        : null;

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id, event_type, entity_name, entity_id, scope_type, metadata_json
          )
          VALUES ($1::uuid, 'personnel_master_data.terminated', 'ops.employee', $2::uuid, 'company', $3::jsonb)
        `,
        [
          auditActorUserId,
          input.employeeId,
          JSON.stringify({
            correlationId: RequestContextStore.getCorrelationId(),
            requestedActorUserId: input.actorUserId,
            terminationDate: input.terminationDate,
            reason: input.reason,
            linkedUserId,
            closedRoleAssignments: accessClosure?.closedRoleAssignments ?? 0,
            closedActionStoreAssignments: accessClosure?.closedActionStoreAssignments ?? 0,
            revokedMobileSessions: accessClosure?.revokedMobileSessions ?? 0,
          }),
        ],
      );

      const terminatedResult = await client.query(
        `
          SELECT
            e.employee_id::text AS employee_id,
            e.external_employee_ref,
            e.first_name,
            e.last_name,
            e.national_id_last4,
            e.phone_number,
            e.hire_date::text AS hire_date,
            e.termination_date::text AS termination_date,
            e.employment_status,
            e.employment_type,
            a.assignment_id::text AS assignment_id,
            a.start_date::text AS assignment_start_date,
            s.store_id::text AS store_id,
            s.store_code,
            s.store_name,
            r.region_id::text AS region_id,
            r.region_name,
            p.position_id::text AS position_id,
            p.position_code,
            p.position_name,
            GREATEST(e.updated_at, COALESCE(a.updated_at, e.updated_at))::text AS updated_at
          FROM ops.employee e
          LEFT JOIN LATERAL (
            SELECT *
            FROM ops.employee_assignment_history
            WHERE employee_id = e.employee_id
            ORDER BY is_primary_assignment DESC, start_date DESC, created_at DESC
            LIMIT 1
          ) a ON TRUE
          LEFT JOIN ops.store s ON s.store_id = a.store_id
          LEFT JOIN ops.region r ON r.region_id = a.region_id
          LEFT JOIN ops.position p ON p.position_id = a.position_id
          WHERE e.employee_id = $1::uuid
        `,
        [input.employeeId],
      );

      return {
        ...(terminatedResult.rows[0] ?? {}),
        accessClosure: {
          userAccessClosed: Boolean(accessClosure?.user),
          closedUserId: accessClosure?.user?.user_id ?? null,
          closedRoleAssignments: accessClosure?.closedRoleAssignments ?? 0,
          closedActionStoreAssignments: accessClosure?.closedActionStoreAssignments ?? 0,
          revokedMobileSessions: accessClosure?.revokedMobileSessions ?? 0,
        },
      };
    });
  }
}
