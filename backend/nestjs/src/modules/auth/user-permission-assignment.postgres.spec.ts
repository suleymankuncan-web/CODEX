import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { UserPermissionAssignmentRepository } from "./user-permission-assignment.repository";
import { AuthRoleAssignmentCommandRepository } from "./auth-role-assignment-command.repository";

const connectionString = process.env.USER_PERMISSION_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;
const root = join(__dirname, "../../../../..");
const migrationSql = readFileSync(join(root, "db/migrations/092_user_permission_assignment_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/092_user_permission_assignment_v1.rollback.sql"), "utf8");
const invariantSql = readFileSync(
  join(root, "db/preflight/user-permission-assignment-invariants-v1.sql"), "utf8",
);

integration("user permission assignments (PostgreSQL)", () => {
  jest.setTimeout(30_000);
  const databaseName = `user_permission_${process.pid}_${randomUUID().slice(0, 8)}`;
  const companyId = "10000000-0000-4000-8000-000000000001";
  const regionId = "10000000-0000-4000-8000-000000000002";
  const storeId = "10000000-0000-4000-8000-000000000003";
  const actorId = "10000000-0000-4000-8000-000000000004";
  const viewerId = "10000000-0000-4000-8000-000000000005";
  const hrId = "10000000-0000-4000-8000-000000000006";
  const superId = "10000000-0000-4000-8000-000000000007";
  const viewerAssignmentId = "20000000-0000-4000-8000-000000000001";
  const hrAssignmentId = "20000000-0000-4000-8000-000000000002";
  const superAssignmentId = "20000000-0000-4000-8000-000000000003";
  let adminPool: Pool;
  let pool: Pool;
  const databaseUrl = (name: string) => {
    const url = new URL(connectionString!);
    url.pathname = `/${name}`;
    return url.toString();
  };
  const rollback = async (client: PoolClient) => client.query("ROLLBACK").catch(() => undefined);
  const permissionId = async (code: string) => {
    const result = await pool.query<{ permission_id: string }>(
      `SELECT permission_id::text FROM ops.permission WHERE permission_code = $1`, [code],
    );
    return result.rows[0]!.permission_id;
  };
  const insertGrant = async (client: Pool | PoolClient, input: {
    roleAssignmentId: string; userId: string; permissionCode: string; actorId?: string;
    scopeType?: "company" | "region" | "store"; regionId?: string | null; storeId?: string | null;
    startsAt?: string | null; endsAt?: string | null;
  }) => client.query(`
    INSERT INTO ops.user_permission_assignment (
      user_role_assignment_id, user_id, permission_id, scope_type,
      company_id, region_id, store_id, starts_at, ends_at, granted_by_user_id, grant_reason
    ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::uuid,$7::uuid,
              COALESCE($8::timestamptz,NOW()),$9::timestamptz,$10::uuid,'Business assignment')
    RETURNING user_permission_assignment_id::text
  `, [
    input.roleAssignmentId, input.userId, await permissionId(input.permissionCode),
    input.scopeType ?? "company", companyId, input.regionId ?? null, input.storeId ?? null,
    input.startsAt ?? null, input.endsAt ?? null, input.actorId ?? actorId,
  ]);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl("postgres") });
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: databaseUrl(databaseName) });
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE EXTENSION IF NOT EXISTS btree_gist;
      CREATE SCHEMA ops;
      CREATE SCHEMA audit;
      CREATE TABLE ops.company (company_id uuid PRIMARY KEY, status text NOT NULL);
      CREATE TABLE ops.region (region_id uuid PRIMARY KEY, company_id uuid NOT NULL, status text NOT NULL);
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY, company_id uuid NOT NULL, region_id uuid NOT NULL, status text NOT NULL);
      CREATE TABLE ops.user_account (user_id uuid PRIMARY KEY, is_active boolean NOT NULL);
      CREATE TABLE ops.role (role_id uuid PRIMARY KEY, role_code text UNIQUE NOT NULL, role_scope_type text NOT NULL);
      CREATE TABLE ops.permission (
        permission_id uuid PRIMARY KEY, permission_code text UNIQUE NOT NULL,
        resource_name text NOT NULL, action_name text NOT NULL, description text
      );
      CREATE TABLE ops.role_permission (
        role_id uuid NOT NULL, permission_id uuid NOT NULL, PRIMARY KEY(role_id, permission_id)
      );
      CREATE TABLE ops.user_role_assignment (
        user_role_assignment_id uuid PRIMARY KEY, user_id uuid NOT NULL, role_id uuid NOT NULL,
        scope_type text NOT NULL, company_id uuid, region_id uuid, store_id uuid,
        start_at timestamptz NOT NULL DEFAULT NOW(), end_at timestamptz,
        incentive_approval boolean NOT NULL DEFAULT FALSE,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE TABLE audit.event_log (
        event_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT NOW(),
        actor_user_id uuid, event_type text NOT NULL, entity_name text NOT NULL, entity_id uuid,
        scope_type text NOT NULL, company_id uuid, region_id uuid, store_id uuid,
        request_id text, ip_address inet, metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE audit.schema_migration (migration_name text PRIMARY KEY);
      INSERT INTO ops.company VALUES ('${companyId}','active');
      INSERT INTO ops.region VALUES ('${regionId}','${companyId}','active');
      INSERT INTO ops.store VALUES ('${storeId}','${companyId}','${regionId}','active');
      INSERT INTO ops.user_account VALUES
        ('${actorId}',TRUE),('${viewerId}',TRUE),('${hrId}',TRUE),('${superId}',TRUE);
      INSERT INTO ops.role VALUES
        ('30000000-0000-4000-8000-000000000001','REPORT_VIEWER','company'),
        ('30000000-0000-4000-8000-000000000002','HR_ADMIN','company'),
        ('30000000-0000-4000-8000-000000000003','SUPER_ADMIN','company');
      INSERT INTO ops.permission VALUES
        ('70000000-0000-0000-0000-000000000006','reports.read','reports','read','Reports'),
        ('70000000-0000-0000-0000-000000000030','custom.read','custom','read','Custom capability');
      INSERT INTO ops.role_permission VALUES
        ('30000000-0000-4000-8000-000000000001','70000000-0000-0000-0000-000000000006');
      INSERT INTO ops.user_role_assignment VALUES
        ('${viewerAssignmentId}','${viewerId}','30000000-0000-4000-8000-000000000001','company','${companyId}',NULL,NULL,NOW(),NULL),
        ('${hrAssignmentId}','${hrId}','30000000-0000-4000-8000-000000000002','company','${companyId}',NULL,NULL,NOW(),NULL),
        ('${superAssignmentId}','${superId}','30000000-0000-4000-8000-000000000003','company','${companyId}',NULL,NULL,NOW(),NULL);
      BEGIN; ${migrationSql} COMMIT;
    `);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]);
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  it("rolls back idempotently before use and reapplies twice", async () => {
    await pool.query(rollbackSql);
    await expect(pool.query(rollbackSql)).resolves.toBeDefined();
    await pool.query(`BEGIN; ${migrationSql} COMMIT;`);
    await expect(pool.query(`BEGIN; ${migrationSql} COMMIT;`)).resolves.toBeDefined();
  });

  it("executes the additive scope invariant and detects a rolled-back cross-company row", async () => {
    const clean = await pool.query<{ violation_count: string }>(invariantSql);
    expect(clean.rows[0]?.violation_count).toBe("0");
    const otherCompanyId = randomUUID();
    await pool.query(`INSERT INTO ops.company VALUES ($1::uuid,'active')`, [otherCompanyId]);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`ALTER TABLE ops.user_permission_assignment DISABLE TRIGGER trg_user_permission_assignment_guard`);
      await client.query(`
        INSERT INTO ops.user_permission_assignment (
          user_role_assignment_id,user_id,permission_id,scope_type,company_id,
          granted_by_user_id,grant_reason
        ) SELECT $1::uuid,$2::uuid,permission_id,'company',$3::uuid,$4::uuid,'fixture mismatch'
          FROM ops.permission WHERE permission_code='INCENTIVE_SALES_DIRECTOR_APPROVAL'
      `, [viewerAssignmentId, viewerId, otherCompanyId, actorId]);
      const invalid = await client.query<{ violation_count: string }>(invariantSql);
      expect(invalid.rows[0]?.violation_count).toBe("1");
      await client.query("ROLLBACK");
    } finally {
      await rollback(client);
      client.release();
    }
    const after = await pool.query<{ violation_count: string }>(invariantSql);
    expect(after.rows[0]?.violation_count).toBe("0");
  });

  it("grants bounded capabilities and blocks overlap, self-grant, fixed Super Admin, and redundant defaults", async () => {
    await expect(pool.query(`
      UPDATE ops.user_role_assignment SET incentive_approval=TRUE
      WHERE user_role_assignment_id=$1::uuid
    `, [viewerAssignmentId])).rejects.toMatchObject({ constraint: "ck_legacy_incentive_approval_revoke_only" });
    const salesDirector = await insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
    });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
    })).rejects.toMatchObject({ code: "23P01" });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
    })).rejects.toMatchObject({ constraint: "ck_user_permission_approval_separation" });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_HR_APPROVAL",
    })).rejects.toMatchObject({ constraint: "ck_user_permission_hr_role" });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL", actorId: viewerId,
    })).rejects.toMatchObject({ constraint: "ck_user_permission_no_self_grant" });
    await expect(insertGrant(pool, {
      roleAssignmentId: superAssignmentId, userId: superId,
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
    })).rejects.toMatchObject({ constraint: "ck_user_permission_super_fixed" });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId, permissionCode: "reports.read",
    })).rejects.toMatchObject({ constraint: "ck_user_permission_not_redundant" });
    const boundedUserId = randomUUID();
    const boundedRoleAssignmentId = randomUUID();
    await pool.query(`INSERT INTO ops.user_account VALUES ($1::uuid,TRUE)`, [boundedUserId]);
    await pool.query(`
      INSERT INTO ops.user_role_assignment (
        user_role_assignment_id,user_id,role_id,scope_type,company_id,start_at,end_at
      ) VALUES ($1::uuid,$2::uuid,'30000000-0000-4000-8000-000000000001','company',$3::uuid,NOW(),NOW()+INTERVAL '1 day')
    `, [boundedRoleAssignmentId, boundedUserId, companyId]);
    await expect(insertGrant(pool, {
      roleAssignmentId: boundedRoleAssignmentId, userId: boundedUserId,
      permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
    })).rejects.toMatchObject({ constraint: "ck_user_permission_role_validity" });
    await expect(pool.query(`
      INSERT INTO ops.user_role_assignment (
        user_role_assignment_id, user_id, role_id, scope_type, company_id, start_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, '30000000-0000-4000-8000-000000000003'::uuid,
        'company', $2::uuid, NOW()
      )
    `, [viewerId, companyId])).rejects.toMatchObject({ constraint: "ck_super_role_no_personal_capabilities" });
    await expect(pool.query(`
      INSERT INTO ops.role_permission (role_id, permission_id)
      SELECT '30000000-0000-4000-8000-000000000001'::uuid, permission_id
      FROM ops.permission WHERE permission_code = 'INCENTIVE_GENERAL_MANAGER_APPROVAL'
    `)).rejects.toMatchObject({ constraint: "ck_role_permission_capability_only" });

    await pool.query(`
      UPDATE ops.user_permission_assignment
      SET revoked_at = NOW(), revoked_by_user_id = $2::uuid, revoke_reason = 'Responsibility changed'
      WHERE user_permission_assignment_id = $1::uuid
    `, [salesDirector.rows[0]!.user_permission_assignment_id, actorId]);
    await expect(pool.query(`
      UPDATE ops.user_permission_assignment
      SET revoked_at = NULL, revoked_by_user_id = NULL, revoke_reason = NULL
      WHERE user_permission_assignment_id = $1::uuid
    `, [salesDirector.rows[0]!.user_permission_assignment_id])).rejects.toMatchObject({ code: "55000" });
    await expect(insertGrant(pool, {
      roleAssignmentId: viewerAssignmentId, userId: viewerId,
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
    })).resolves.toBeDefined();
    await expect(insertGrant(pool, {
      roleAssignmentId: hrAssignmentId, userId: hrId, permissionCode: "INCENTIVE_HR_APPROVAL",
    })).resolves.toBeDefined();
  });

  it("refuses rollback after capability history exists", async () => {
    const client = await pool.connect();
    try {
      await expect(client.query(rollbackSql)).rejects.toThrow(
        "Migration 092 cannot be rolled back after user capability grants exist",
      );
      await rollback(client);
    } finally {
      client.release();
    }
  });

  it("serializes grants ahead of account deactivation and leaves no stale active capability", async () => {
    const targetUserId = randomUUID();
    const targetRoleAssignmentId = randomUUID();
    await pool.query(`INSERT INTO ops.user_account VALUES ($1::uuid,TRUE)`, [targetUserId]);
    await pool.query(`
      INSERT INTO ops.user_role_assignment (
        user_role_assignment_id,user_id,role_id,scope_type,company_id,start_at
      ) VALUES ($1::uuid,$2::uuid,'30000000-0000-4000-8000-000000000001','company',$3::uuid,NOW())
    `, [targetRoleAssignmentId, targetUserId, companyId]);
    const grantClient = await pool.connect();
    const deactivateClient = await pool.connect();
    try {
      await grantClient.query("BEGIN");
      await grantClient.query(`SELECT 1 FROM ops.user_account WHERE user_id = $1::uuid FOR UPDATE`, [targetUserId]);
      await grantClient.query(`SELECT 1 FROM ops.user_role_assignment WHERE user_role_assignment_id = $1::uuid FOR UPDATE`, [targetRoleAssignmentId]);
      const grant = await insertGrant(grantClient, {
        roleAssignmentId: targetRoleAssignmentId, userId: targetUserId,
        permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
      });

      await deactivateClient.query("BEGIN");
      await deactivateClient.query(`SET LOCAL lock_timeout = '100ms'`);
      await expect(deactivateClient.query(
        `UPDATE ops.user_account SET is_active = FALSE WHERE user_id = $1::uuid`,
        [targetUserId],
      )).rejects.toMatchObject({ code: "55P03" });
      await rollback(deactivateClient);
      await grantClient.query("COMMIT");

      await deactivateClient.query("BEGIN");
      await deactivateClient.query(`UPDATE ops.user_account SET is_active = FALSE WHERE user_id = $1::uuid`, [targetUserId]);
      await deactivateClient.query(`
        UPDATE ops.user_permission_assignment
        SET revoked_at=NOW(),revoked_by_user_id=$2::uuid,revoke_reason='Account deactivated'
        WHERE user_id=$1::uuid AND revoked_at IS NULL
      `, [targetUserId, actorId]);
      await deactivateClient.query(`UPDATE ops.user_role_assignment SET end_at=NOW() WHERE user_id=$1::uuid`, [targetUserId]);
      await deactivateClient.query("COMMIT");
      const status = await pool.query<{ revoked_at: string | null }>(`
        SELECT revoked_at::text FROM ops.user_permission_assignment
        WHERE user_permission_assignment_id=$1::uuid
      `, [grant.rows[0]!.user_permission_assignment_id]);
      expect(status.rows[0]?.revoked_at).not.toBeNull();
    } finally {
      await rollback(grantClient);
      await rollback(deactivateClient);
      grantClient.release();
      deactivateClient.release();
    }
  });

  it("serializes role deactivation in the same user-before-role lock order", async () => {
    const targetUserId = randomUUID();
    const targetRoleAssignmentId = randomUUID();
    await pool.query(`INSERT INTO ops.user_account VALUES ($1::uuid,TRUE)`, [targetUserId]);
    await pool.query(`
      INSERT INTO ops.user_role_assignment (
        user_role_assignment_id,user_id,role_id,scope_type,company_id,start_at
      ) VALUES ($1::uuid,$2::uuid,'30000000-0000-4000-8000-000000000001','company',$3::uuid,NOW())
    `, [targetRoleAssignmentId, targetUserId, companyId]);
    const grantClient = await pool.connect();
    const roleRepository = (lockTimeout?: string) => new AuthRoleAssignmentCommandRepository({
      withTransaction: async (callback: (client: PoolClient) => Promise<unknown>) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          if (lockTimeout) await client.query(`SELECT set_config('lock_timeout',$1,TRUE)`, [lockTimeout]);
          const result = await callback(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await rollback(client);
          throw error;
        } finally {
          client.release();
        }
      },
    } as never);
    try {
      await grantClient.query("BEGIN");
      await grantClient.query(`SELECT 1 FROM ops.user_account WHERE user_id=$1::uuid FOR UPDATE`, [targetUserId]);
      await grantClient.query(`SELECT 1 FROM ops.user_role_assignment WHERE user_role_assignment_id=$1::uuid FOR UPDATE`, [targetRoleAssignmentId]);
      const grant = await insertGrant(grantClient, {
        roleAssignmentId: targetRoleAssignmentId, userId: targetUserId,
        permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
      });

      await expect(roleRepository("100ms").deactivateRoleAssignment({
        assignmentId: targetRoleAssignmentId,
        actorUserId: actorId,
      })).rejects.toMatchObject({ code: "55P03" });
      await grantClient.query("COMMIT");

      await expect(roleRepository().deactivateRoleAssignment({
        assignmentId: targetRoleAssignmentId,
        actorUserId: actorId,
      })).resolves.toBeDefined();
      const status = await pool.query<{ revoked_at: string | null }>(`
        SELECT revoked_at::text FROM ops.user_permission_assignment
        WHERE user_permission_assignment_id=$1::uuid
      `, [grant.rows[0]!.user_permission_assignment_id]);
      expect(status.rows[0]?.revoked_at).not.toBeNull();
    } finally {
      await rollback(grantClient);
      grantClient.release();
    }
  });

  it("writes grant and revoke evidence through the repository against the production audit shape", async () => {
    const repository = new UserPermissionAssignmentRepository({
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      withTransaction: async (callback: (client: PoolClient) => Promise<unknown>) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await callback(client);
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await rollback(client);
          throw error;
        } finally {
          client.release();
        }
      },
    } as never);
    const granted = await repository.grant({
      roleAssignmentId: hrAssignmentId, userId: hrId,
      permissionId: "70000000-0000-0000-0000-000000000030",
      scopeType: "company", companyId, regionId: null, storeId: null,
      startsAt: null, endsAt: null, reason: "Temporary custom access", actorUserId: actorId,
    });
    await expect(repository.revoke({
      assignmentId: granted.user_permission_assignment_id,
      actorUserId: actorId,
      reason: "Temporary access ended",
    })).resolves.toBeDefined();
    const audit = await pool.query<{ event_type: string; entity_name: string }>(`
      SELECT event_type, entity_name FROM audit.event_log
      WHERE entity_id = $1::uuid ORDER BY occurred_at
    `, [granted.user_permission_assignment_id]);
    expect(audit.rows).toEqual([
      { event_type: "user_permission.granted", entity_name: "ops.user_permission_assignment" },
      { event_type: "user_permission.revoked", entity_name: "ops.user_permission_assignment" },
    ]);
  });
});
