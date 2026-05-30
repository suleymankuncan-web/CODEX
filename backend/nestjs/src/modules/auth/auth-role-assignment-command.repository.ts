import { Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

type RoleAssignmentCommandRow = {
  user_role_assignment_id: string;
  user_id: string;
  role_code: string;
  scope_type: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

export type CreateRoleAssignmentCommandInput = {
  userId: string;
  roleId: string;
  scopeType: string;
  companyId?: string | null;
  regionId?: string | null;
  storeId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  actorUserId: string;
};

export type DeactivateRoleAssignmentCommandInput = {
  assignmentId: string;
  actorUserId: string;
};

@Injectable()
export class AuthRoleAssignmentCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createRoleAssignment(input: CreateRoleAssignmentCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RoleAssignmentCommandRow>(
        `
          INSERT INTO ops.user_role_assignment (
            user_id,
            role_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at
          )
          SELECT
            $1::uuid,
            $2::uuid,
            $3,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            COALESCE($7::timestamptz, NOW()),
            $8::timestamptz
          RETURNING
            user_role_assignment_id,
            user_id,
            (SELECT role_code FROM ops.role WHERE role_id = $2::uuid) AS role_code,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at,
            created_at
        `,
        [
          input.userId,
          input.roleId,
          input.scopeType,
          input.companyId ?? null,
          input.regionId ?? null,
          input.storeId ?? null,
          input.effectiveFrom ?? null,
          input.effectiveTo ?? null,
        ],
      );

      const assignment = result.rows[0];

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
            'user_role_assignment.created',
            'ops.user_role_assignment',
            $2::uuid,
            $3,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            $7::jsonb
          )
        `,
        [
          input.actorUserId,
          assignment.user_role_assignment_id,
          input.scopeType,
          input.companyId ?? null,
          input.regionId ?? null,
          input.storeId ?? null,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-role-assignment",
              },
              changedFields: [
                "roleId",
                "scopeType",
                "companyId",
                "regionId",
                "storeId",
                "effectiveFrom",
                "effectiveTo",
              ],
              details: {
                userId: input.userId,
                roleId: input.roleId,
                scopeType: input.scopeType,
                companyId: input.companyId ?? null,
                regionId: input.regionId ?? null,
                storeId: input.storeId ?? null,
                effectiveFrom: input.effectiveFrom ?? null,
                effectiveTo: input.effectiveTo ?? null,
              },
            }),
          }),
        ],
      );

      return assignment;
    });
  }

  async deactivateRoleAssignment(input: DeactivateRoleAssignmentCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<RoleAssignmentCommandRow>(
        `
          UPDATE ops.user_role_assignment
          SET end_at = NOW()
          WHERE user_role_assignment_id = $1::uuid
            AND (end_at IS NULL OR end_at > NOW())
          RETURNING
            user_role_assignment_id,
            user_id,
            (SELECT role_code FROM ops.role WHERE role_id = ops.user_role_assignment.role_id) AS role_code,
            scope_type,
            company_id,
            region_id,
            store_id,
            start_at,
            end_at,
            created_at
        `,
        [input.assignmentId],
      );

      const assignment = result.rows[0] ?? null;

      if (assignment) {
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
              'user_role_assignment.deactivated',
              'ops.user_role_assignment',
              $2::uuid,
              $3,
              $4::uuid,
              $5::uuid,
              $6::uuid,
              $7::jsonb
            )
          `,
          [
            input.actorUserId,
            assignment.user_role_assignment_id,
            assignment.scope_type,
            assignment.company_id,
            assignment.region_id,
            assignment.store_id,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-role-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: assignment.user_id,
                  roleCode: assignment.role_code,
                  scopeType: assignment.scope_type,
                  companyId: assignment.company_id,
                  regionId: assignment.region_id,
                  storeId: assignment.store_id,
                  endAt: assignment.end_at,
                },
              }),
            }),
          ],
        );
      }

      return assignment;
    });
  }
}
