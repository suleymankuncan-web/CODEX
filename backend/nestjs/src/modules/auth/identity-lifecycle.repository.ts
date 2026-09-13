import { ConflictException, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../shared/database/database.service";

export type IdentityOperation = "provision" | "enable" | "disable" | "update_profile";

type IdentityJobRow = {
  identity_lifecycle_job_id: string;
  user_id: string;
  operation: IdentityOperation;
  attempts: number;
};

export type IdentityUserSnapshot = {
  user_id: string;
  employee_id: string | null;
  username: string;
  email: string;
  provider_subject: string | null;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  role_codes: string[];
  company_ids: string[];
  region_ids: string[];
  store_ids: string[];
  assigned_store_ids: string[];
};

@Injectable()
export class IdentityLifecycleRepository {
  constructor(private readonly database: DatabaseService) {}

  async createEmployeeUserInTransaction(client: PoolClient, input: {
    employeeId: string;
    username: string;
    email: string;
    companyId: string;
    regionId: string;
    storeId: string;
    actorUserId: string;
  }) {
    let userResult: { rows: Array<{ user_id: string }> };
    try {
      userResult = await client.query<{ user_id: string }>(
        `
          INSERT INTO ops.user_account (
            employee_id, username, email, auth_provider, provider_subject, is_active
          )
          VALUES ($1::uuid, LOWER(BTRIM($2)), LOWER(BTRIM($3)), 'oidc', NULL, FALSE)
          RETURNING user_id::text
        `,
        [input.employeeId, input.username, input.email],
      );
    } catch (error) {
      const constraint = (error as { code?: string; constraint?: string }).constraint;
      if (constraint === "user_account_username_key") {
        throw new ConflictException("Username is already in use");
      }
      if (constraint === "user_account_email_key") {
        throw new ConflictException("Email is already in use");
      }
      throw error;
    }
    const userId = userResult.rows[0].user_id;
    const roleResult = await client.query(
      `
        INSERT INTO ops.user_role_assignment (
          user_id, role_id, scope_type, company_id, region_id, store_id
        )
        SELECT $1::uuid, role_id, 'store', $2::uuid, $3::uuid, $4::uuid
        FROM ops.role
        WHERE role_code = 'STORE_PERSONNEL'
      `,
      [userId, input.companyId, input.regionId, input.storeId],
    );
    if (roleResult.rowCount !== 1) throw new Error("store_personnel_role_missing");
    await client.query(
      `INSERT INTO ops.user_action_store_assignment (user_id, store_id) VALUES ($1::uuid, $2::uuid)`,
      [userId, input.storeId],
    );
    await this.enqueueInTransaction(client, {
      userId,
      operation: "provision",
      actorUserId: input.actorUserId,
      idempotencyKey: `provision:${userId}`,
    });
    return userId;
  }

  async enqueueInTransaction(client: PoolClient, input: {
    userId: string;
    operation: IdentityOperation;
    actorUserId?: string | null;
    idempotencyKey?: string;
  }) {
    await client.query(
      `
        INSERT INTO ops.identity_lifecycle_job (
          user_id, operation, idempotency_key, requested_by_user_id
        )
        VALUES ($1::uuid, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `,
      [
        input.userId,
        input.operation,
        input.idempotencyKey ?? `${input.operation}:${input.userId}:${Date.now()}`,
        input.actorUserId ?? null,
      ],
    );
  }

  async claimNext(): Promise<IdentityJobRow | null> {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<IdentityJobRow>(
        `
          WITH candidate AS (
            SELECT identity_lifecycle_job_id
            FROM ops.identity_lifecycle_job
            WHERE (
              status = 'pending'
              OR (status = 'processing' AND claimed_at < NOW() - INTERVAL '5 minutes')
            )
              AND available_at <= NOW()
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE ops.identity_lifecycle_job job
          SET status = 'processing', claimed_at = NOW(), attempts = attempts + 1, updated_at = NOW()
          FROM candidate
          WHERE job.identity_lifecycle_job_id = candidate.identity_lifecycle_job_id
          RETURNING job.identity_lifecycle_job_id::text, job.user_id::text, job.operation, job.attempts
        `,
      );
      return result.rows[0] ?? null;
    });
  }

  async getUserSnapshot(userId: string): Promise<IdentityUserSnapshot | null> {
    const result = await this.database.query<IdentityUserSnapshot>(
      `
        SELECT
          ua.user_id::text, ua.employee_id::text, ua.username, ua.email,
          ua.provider_subject, ua.is_active, e.first_name, e.last_name,
          COALESCE(array_agg(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL), ARRAY[]::text[]) AS role_codes,
          COALESCE(array_agg(DISTINCT ura.company_id::text) FILTER (WHERE ura.company_id IS NOT NULL), ARRAY[]::text[]) AS company_ids,
          COALESCE(array_agg(DISTINCT ura.region_id::text) FILTER (WHERE ura.region_id IS NOT NULL), ARRAY[]::text[]) AS region_ids,
          COALESCE(array_agg(DISTINCT ura.store_id::text) FILTER (WHERE ura.store_id IS NOT NULL), ARRAY[]::text[]) AS store_ids,
          COALESCE(array_agg(DISTINCT uas.store_id::text) FILTER (WHERE uas.store_id IS NOT NULL), ARRAY[]::text[]) AS assigned_store_ids
        FROM ops.user_account ua
        LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
        LEFT JOIN ops.user_role_assignment ura ON ura.user_id = ua.user_id AND ura.start_at <= NOW() AND (ura.end_at IS NULL OR ura.end_at > NOW())
        LEFT JOIN ops.role r ON r.role_id = ura.role_id
        LEFT JOIN ops.user_action_store_assignment uas ON uas.user_id = ua.user_id AND uas.start_at <= NOW() AND (uas.end_at IS NULL OR uas.end_at > NOW())
        WHERE ua.user_id = $1::uuid
        GROUP BY ua.user_id, e.first_name, e.last_name
      `,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async completeProvision(jobId: string, userId: string, subject: string) {
    return this.database.withTransaction(async (client) => {
      const jobResult = await client.query(
        `UPDATE ops.identity_lifecycle_job SET status = 'completed', completed_at = NOW(), last_error_code = NULL, updated_at = NOW() WHERE identity_lifecycle_job_id = $1::uuid AND status = 'processing' RETURNING identity_lifecycle_job_id`,
        [jobId],
      );
      if (jobResult.rowCount !== 1) return false;
      await client.query(
        `UPDATE ops.user_account SET provider_subject = $2, is_active = TRUE, deactivation_reason = NULL, deactivated_at = NULL, deactivated_by_user_id = NULL, updated_at = NOW() WHERE user_id = $1::uuid`,
        [userId, subject],
      );
      return true;
    });
  }

  async complete(jobId: string) {
    const result = await this.database.query(
      `UPDATE ops.identity_lifecycle_job SET status = 'completed', completed_at = NOW(), last_error_code = NULL, updated_at = NOW() WHERE identity_lifecycle_job_id = $1::uuid AND status = 'processing' RETURNING identity_lifecycle_job_id`,
      [jobId],
    );
    return result.rowCount === 1;
  }

  async completeEnable(jobId: string, userId: string) {
    return this.database.withTransaction(async (client) => {
      const jobResult = await client.query(
        `UPDATE ops.identity_lifecycle_job SET status = 'completed', completed_at = NOW(), last_error_code = NULL, updated_at = NOW() WHERE identity_lifecycle_job_id = $1::uuid AND status = 'processing' RETURNING identity_lifecycle_job_id`,
        [jobId],
      );
      if (jobResult.rowCount !== 1) return false;
      await client.query(
        `UPDATE ops.user_account SET is_active = TRUE, deactivation_reason = NULL, deactivated_at = NULL, deactivated_by_user_id = NULL, updated_at = NOW() WHERE user_id = $1::uuid`,
        [userId],
      );
      return true;
    });
  }

  async retry(jobId: string, attempts: number, errorCode: string) {
    const terminal = attempts >= 12 || errorCode.endsWith("_conflict");
    await this.database.query(
      `UPDATE ops.identity_lifecycle_job SET status = $2, available_at = NOW() + (LEAST($3, 10) * INTERVAL '1 minute'), last_error_code = $4, updated_at = NOW() WHERE identity_lifecycle_job_id = $1::uuid`,
      [jobId, terminal ? "failed" : "pending", attempts, errorCode],
    );
    return terminal;
  }
}
