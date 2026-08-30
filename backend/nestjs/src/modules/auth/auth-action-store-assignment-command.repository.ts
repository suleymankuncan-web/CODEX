import { ConflictException, Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";

type ActionStoreAssignmentCommandRow = {
  user_action_store_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

const ACTION_STORE_ASSIGNMENT_CONFLICT_MESSAGE = "Active action store assignment already exists";
const ACTION_STORE_ASSIGNMENT_OVERLAP_CONSTRAINT =
  "ex_user_action_store_assignment_no_overlap_v1";
const ACTION_STORE_ASSIGNMENT_LEGACY_UNIQUE_INDEX = "uq_user_action_store_assignment_active";

function isActionStoreAssignmentConflict(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; constraint?: unknown };

  return (
    (candidate.code === "23P01" &&
      candidate.constraint === ACTION_STORE_ASSIGNMENT_OVERLAP_CONSTRAINT) ||
    (candidate.code === "23505" &&
      candidate.constraint === ACTION_STORE_ASSIGNMENT_LEGACY_UNIQUE_INDEX)
  );
}

export type CreateActionStoreAssignmentCommandInput = {
  userId: string;
  storeId: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  actorUserId: string;
};

export type DeactivateActionStoreAssignmentCommandInput = {
  assignmentId: string;
  actorUserId: string;
};

export type CreateActionStoreAssignmentsBatchCommandInput = {
  userId: string;
  storeIds: string[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  actorUserId: string;
};

@Injectable()
export class AuthActionStoreAssignmentCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async countActiveActionStoreAssignments(input: {
    userId: string;
    storeId: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }) {
    const result = await this.databaseService.query<{
      active_action_store_assignment_count: string;
    }>(
      `
        SELECT COUNT(*)::text AS active_action_store_assignment_count
        FROM ops.user_action_store_assignment uasa
        WHERE uasa.user_id = $1::uuid
          AND uasa.store_id = $2::uuid
          AND tstzrange(uasa.start_at, uasa.end_at, '[)') && tstzrange(
            COALESCE($3::timestamptz, NOW()),
            $4::timestamptz,
            '[)'
          )
      `,
      [input.userId, input.storeId, input.effectiveFrom ?? null, input.effectiveTo ?? null],
    );

    return Number(result.rows[0]?.active_action_store_assignment_count ?? "0");
  }

  async createActionStoreAssignment(input: CreateActionStoreAssignmentCommandInput) {
    try {
      return await this.databaseService.withTransaction(async (client) => {
      const result = await client.query<ActionStoreAssignmentCommandRow>(
        `
          WITH inserted AS (
            INSERT INTO ops.user_action_store_assignment (
              user_id,
              store_id,
              start_at,
              end_at
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              COALESCE($3::timestamptz, NOW()),
              $4::timestamptz
            )
            RETURNING
              user_action_store_assignment_id,
              user_id,
              store_id,
              start_at,
              end_at,
              created_at
          )
          SELECT
            inserted.user_action_store_assignment_id,
            inserted.user_id,
            ua.username,
            ua.email,
            inserted.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name,
            inserted.start_at,
            inserted.end_at,
            inserted.created_at
          FROM inserted
          INNER JOIN ops.user_account ua ON ua.user_id = inserted.user_id
          INNER JOIN ops.store s ON s.store_id = inserted.store_id
          INNER JOIN ops.region r ON r.region_id = s.region_id
        `,
        [
          input.userId,
          input.storeId,
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
            'user_action_store_assignment.created',
            'ops.user_action_store_assignment',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.actorUserId,
          assignment.user_action_store_assignment_id,
          assignment.company_id,
          assignment.region_id,
          assignment.store_id,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-action-store-assignment",
              },
              changedFields: ["userId", "storeId", "effectiveFrom", "effectiveTo"],
              details: {
                userId: input.userId,
                storeId: input.storeId,
                effectiveFrom: input.effectiveFrom ?? null,
                effectiveTo: input.effectiveTo ?? null,
              },
            }),
          }),
        ],
      );

      return assignment;
      });
    } catch (error) {
      if (isActionStoreAssignmentConflict(error)) {
        throw new ConflictException(ACTION_STORE_ASSIGNMENT_CONFLICT_MESSAGE);
      }

      throw error;
    }
  }

  async createActionStoreAssignmentsBatch(input: CreateActionStoreAssignmentsBatchCommandInput) {
    try {
      return await this.databaseService.withTransaction(async (client) => {
      const duplicateResult = await client.query<{ store_id: string }>(
        `
          SELECT store_id::text
          FROM ops.user_action_store_assignment
          WHERE user_id = $1::uuid
            AND store_id = ANY($2::uuid[])
            AND tstzrange(start_at, end_at, '[)') && tstzrange(
              COALESCE($3::timestamptz, NOW()),
              $4::timestamptz,
              '[)'
            )
          FOR UPDATE
        `,
        [input.userId, input.storeIds, input.effectiveFrom ?? null, input.effectiveTo ?? null],
      );
      if (duplicateResult.rows.length > 0) {
        throw new ConflictException("One or more active action store assignments already exist");
      }

      const result = await client.query<ActionStoreAssignmentCommandRow>(
        `
          WITH inserted AS (
            INSERT INTO ops.user_action_store_assignment (user_id, store_id, start_at, end_at)
            SELECT $1::uuid, requested.store_id, COALESCE($3::timestamptz, NOW()), $4::timestamptz
            FROM UNNEST($2::uuid[]) AS requested(store_id)
            RETURNING user_action_store_assignment_id, user_id, store_id, start_at, end_at, created_at
          )
          SELECT
            inserted.user_action_store_assignment_id,
            inserted.user_id,
            ua.username,
            ua.email,
            inserted.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name,
            inserted.start_at,
            inserted.end_at,
            inserted.created_at
          FROM inserted
          INNER JOIN ops.user_account ua ON ua.user_id = inserted.user_id
          INNER JOIN ops.store s ON s.store_id = inserted.store_id
          INNER JOIN ops.region r ON r.region_id = s.region_id
          ORDER BY s.store_code, inserted.store_id
        `,
        [input.userId, input.storeIds, input.effectiveFrom ?? null, input.effectiveTo ?? null],
      );

      for (const assignment of result.rows) {
        await client.query(
          `
            INSERT INTO audit.event_log (
              actor_user_id, event_type, entity_name, entity_id, scope_type,
              company_id, region_id, store_id, metadata_json
            ) VALUES (
              $1::uuid, 'user_action_store_assignment.created', 'ops.user_action_store_assignment',
              $2::uuid, 'store', $3::uuid, $4::uuid, $5::uuid, $6::jsonb
            )
          `,
          [
            input.actorUserId,
            assignment.user_action_store_assignment_id,
            assignment.company_id,
            assignment.region_id,
            assignment.store_id,
            JSON.stringify(buildRequestAuditMetadata({
              sourceContext: { module: "auth-admin", operation: "create-action-store-assignments-batch" },
              changedFields: ["userId", "storeId", "effectiveFrom", "effectiveTo"],
              details: {
                userId: input.userId,
                storeId: assignment.store_id,
                effectiveFrom: input.effectiveFrom ?? null,
                effectiveTo: input.effectiveTo ?? null,
              },
            })),
          ],
        );
      }

      return result.rows;
      });
    } catch (error) {
      if (isActionStoreAssignmentConflict(error)) {
        throw new ConflictException("One or more active action store assignments already exist");
      }

      throw error;
    }
  }

  async deactivateActionStoreAssignment(input: DeactivateActionStoreAssignmentCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<ActionStoreAssignmentCommandRow>(
        `
          WITH updated AS (
            UPDATE ops.user_action_store_assignment
            SET end_at = NOW()
            WHERE user_action_store_assignment_id = $1::uuid
              AND (end_at IS NULL OR end_at > NOW())
            RETURNING
              user_action_store_assignment_id,
              user_id,
              store_id,
              start_at,
              end_at,
              created_at
          )
          SELECT
            updated.user_action_store_assignment_id,
            updated.user_id,
            ua.username,
            ua.email,
            updated.store_id,
            s.store_code,
            s.store_name,
            s.company_id,
            s.region_id,
            r.region_name,
            updated.start_at,
            updated.end_at,
            updated.created_at
          FROM updated
          INNER JOIN ops.user_account ua ON ua.user_id = updated.user_id
          INNER JOIN ops.store s ON s.store_id = updated.store_id
          INNER JOIN ops.region r ON r.region_id = s.region_id
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
              'user_action_store_assignment.deactivated',
              'ops.user_action_store_assignment',
              $2::uuid,
              'store',
              $3::uuid,
              $4::uuid,
              $5::uuid,
              $6::jsonb
            )
          `,
          [
            input.actorUserId,
            assignment.user_action_store_assignment_id,
            assignment.company_id,
            assignment.region_id,
            assignment.store_id,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "deactivate-action-store-assignment",
                },
                changedFields: ["endAt"],
                details: {
                  userId: assignment.user_id,
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
