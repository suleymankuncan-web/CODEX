import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.ROLE_CATALOG_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;
const root = join(__dirname, "../../../../..");
const migrationSql = readFileSync(join(root, "db/migrations/091_role_catalog_simplification_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/091_role_catalog_simplification_v1.rollback.sql"), "utf8");

integration("role catalog simplification (PostgreSQL)", () => {
  jest.setTimeout(30_000);
  const databaseName = `role_catalog_${process.pid}_${randomUUID().slice(0, 8)}`;
  let adminPool: Pool;
  let pool: Pool;
  const databaseUrl = (name: string) => {
    const url = new URL(connectionString!);
    url.pathname = `/${name}`;
    return url.toString();
  };
  const rollback = async (client: PoolClient) => client.query("ROLLBACK").catch(() => undefined);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl("postgres") });
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: databaseUrl(databaseName) });
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA ops;
      CREATE SCHEMA audit;
      CREATE TABLE ops.role (
        role_id uuid PRIMARY KEY, role_code text UNIQUE NOT NULL, role_name text NOT NULL,
        role_scope_type text NOT NULL, description text, is_system_role boolean NOT NULL
      );
      CREATE TABLE ops.permission (
        permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), permission_code text UNIQUE NOT NULL
      );
      CREATE TABLE ops.role_permission (
        role_id uuid NOT NULL REFERENCES ops.role(role_id),
        permission_id uuid NOT NULL REFERENCES ops.permission(permission_id),
        PRIMARY KEY (role_id, permission_id)
      );
      CREATE TABLE ops.user_role_assignment (
        user_role_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id uuid NOT NULL REFERENCES ops.role(role_id)
      );
      CREATE TABLE audit.schema_migration (migration_name text PRIMARY KEY);
      INSERT INTO ops.role VALUES
        ('60000000-0000-0000-0000-000000000001','SUPER_ADMIN','Super Admin','company','',TRUE),
        ('60000000-0000-0000-0000-000000000002','REGION_MANAGER','Region Manager','region','',TRUE),
        ('60000000-0000-0000-0000-000000000003','STORE_MANAGER','Store Manager','store','',TRUE),
        ('60000000-0000-0000-0000-000000000004','AUDITOR','Auditor','region','',TRUE),
        ('60000000-0000-0000-0000-000000000005','REPORT_VIEWER','Report Viewer','company','',TRUE),
        ('60000000-0000-0000-0000-000000000006','INTEGRATION_ADMIN','Integration Admin','company','',TRUE),
        ('60000000-0000-0000-0000-000000000007','SNAPSHOT_OPERATOR','Snapshot Operator','company','',TRUE),
        ('60000000-0000-0000-0000-000000000008','STORE_PERSONNEL','Store Personnel','store','',TRUE),
        ('60000000-0000-0000-0000-000000000009','HR_ADMIN','HR Admin','company','',TRUE),
        ('60000000-0000-0000-0000-000000000010','VISUAL_MERCHANDISER','Visual Merchandiser','store','',TRUE),
        ('60000000-0000-0000-0000-000000000011','VM_REFERENCE_PUBLISHER','VM Reference Publisher','company','',TRUE),
        ('60000000-0000-0000-0000-000000000012','VM_VISUAL_REVIEWER','VM Visual Reviewer','company','',TRUE),
        ('60000000-0000-0000-0000-000000000013','VM_CAMPAIGN_WINDOW_AUTHORITY','VM Window','company','',TRUE),
        ('60000000-0000-0000-0000-000000000014','VM_CAMPAIGN_SCOPE_AUTHORITY','VM Scope','company','',TRUE),
        ('60000000-0000-0000-0000-000000000015','VM_CAMPAIGN_EMERGENCY_AUTHORITY','VM Emergency','company','',TRUE);
      INSERT INTO ops.permission (permission_code) VALUES
        ('store.read'),('checklist.manage'),('reports.read'),('integration.manage'),
        ('snapshot.read'),('snapshot.manage'),('VM_REFERENCE_PUBLISHER'),
        ('VM_VISUAL_REVIEWER'),('VM_CAMPAIGN_WINDOW_AUTHORITY'),
        ('VM_CAMPAIGN_SCOPE_AUTHORITY'),('VM_CAMPAIGN_EMERGENCY_AUTHORITY');
      INSERT INTO ops.role_permission (role_id, permission_id)
      SELECT role.role_id, permission.permission_id
      FROM ops.role role
      JOIN (VALUES
        ('AUDITOR','store.read'),('AUDITOR','checklist.manage'),('AUDITOR','reports.read'),
        ('INTEGRATION_ADMIN','integration.manage'),
        ('SNAPSHOT_OPERATOR','snapshot.read'),('SNAPSHOT_OPERATOR','snapshot.manage'),
        ('VM_REFERENCE_PUBLISHER','VM_REFERENCE_PUBLISHER'),
        ('VM_VISUAL_REVIEWER','VM_VISUAL_REVIEWER'),
        ('VM_CAMPAIGN_WINDOW_AUTHORITY','VM_CAMPAIGN_WINDOW_AUTHORITY'),
        ('VM_CAMPAIGN_SCOPE_AUTHORITY','VM_CAMPAIGN_SCOPE_AUTHORITY'),
        ('VM_CAMPAIGN_EMERGENCY_AUTHORITY','VM_CAMPAIGN_EMERGENCY_AUTHORITY')
      ) mapping(role_code, permission_code) ON mapping.role_code = role.role_code
      JOIN ops.permission permission ON permission.permission_code = mapping.permission_code;
    `);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]);
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  it("reduces the catalog to seven roles and moves VM capabilities to super admin", async () => {
    await pool.query(`BEGIN; ${migrationSql} COMMIT;`);
    await pool.query(`INSERT INTO audit.schema_migration VALUES ('091_role_catalog_simplification_v1.sql')`);
    await expect(pool.query(`BEGIN; ${migrationSql} COMMIT;`)).resolves.toBeDefined();
    const roles = await pool.query<{ role_code: string; role_scope_type: string }>(
      `SELECT role_code, role_scope_type FROM ops.role ORDER BY role_code`,
    );
    expect(roles.rows).toEqual([
      { role_code: "HR_ADMIN", role_scope_type: "company" },
      { role_code: "REGION_MANAGER", role_scope_type: "region" },
      { role_code: "REPORT_VIEWER", role_scope_type: "company" },
      { role_code: "STORE_MANAGER", role_scope_type: "store" },
      { role_code: "STORE_PERSONNEL", role_scope_type: "store" },
      { role_code: "SUPER_ADMIN", role_scope_type: "company" },
      { role_code: "VISUAL_MERCHANDISER", role_scope_type: "store" },
    ]);
    const permissions = await pool.query<{ permission_code: string }>(`
      SELECT permission.permission_code
      FROM ops.role role
      JOIN ops.role_permission role_permission ON role_permission.role_id = role.role_id
      JOIN ops.permission permission ON permission.permission_id = role_permission.permission_id
      WHERE role.role_code = 'SUPER_ADMIN' AND permission.permission_code LIKE 'VM_%'
      ORDER BY permission.permission_code
    `);
    expect(permissions.rows).toHaveLength(5);
  });

  it("restores the old catalog and refuses removal while assignments remain", async () => {
    await pool.query(rollbackSql);
    await pool.query(rollbackSql);
    const restored = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ops.role`);
    expect(restored.rows[0]?.count).toBe("15");
    const exactRestoredRoles = await pool.query<{
      role_id: string; role_code: string; role_name: string; role_scope_type: string;
      description: string; is_system_role: boolean;
    }>(`
      SELECT role_id::text, role_code, role_name, role_scope_type, description, is_system_role
      FROM ops.role WHERE role_code IN (
        'AUDITOR','INTEGRATION_ADMIN','SNAPSHOT_OPERATOR','VM_REFERENCE_PUBLISHER',
        'VM_VISUAL_REVIEWER','VM_CAMPAIGN_WINDOW_AUTHORITY','VM_CAMPAIGN_SCOPE_AUTHORITY',
        'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
      ) ORDER BY role_code
    `);
    expect(exactRestoredRoles.rows).toEqual([
      { role_id: "60000000-0000-0000-0000-000000000004", role_code: "AUDITOR", role_name: "Auditor", role_scope_type: "region", description: "Executes checklist audits", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000006", role_code: "INTEGRATION_ADMIN", role_name: "Integration Admin", role_scope_type: "company", description: "Manages integration sources and import batches", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000007", role_code: "SNAPSHOT_OPERATOR", role_name: "Snapshot Operator", role_scope_type: "company", description: "Runs and reruns reporting snapshots", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000015", role_code: "VM_CAMPAIGN_EMERGENCY_AUTHORITY", role_name: "VM Campaign Emergency Authority", role_scope_type: "company", description: "Explicit company-scoped VM campaign emergency authority", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000014", role_code: "VM_CAMPAIGN_SCOPE_AUTHORITY", role_name: "VM Campaign Scope Authority", role_scope_type: "company", description: "Explicit company-scoped VM campaign scope authority", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000013", role_code: "VM_CAMPAIGN_WINDOW_AUTHORITY", role_name: "VM Campaign Window Authority", role_scope_type: "company", description: "Explicit company-scoped VM campaign window authority", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000011", role_code: "VM_REFERENCE_PUBLISHER", role_name: "VM Reference Publisher", role_scope_type: "company", description: "Explicit company-scoped VM reference publishing capability", is_system_role: true },
      { role_id: "60000000-0000-0000-0000-000000000012", role_code: "VM_VISUAL_REVIEWER", role_name: "VM Visual Reviewer", role_scope_type: "company", description: "Explicit company-scoped VM visual coverage read capability", is_system_role: true },
    ]);
    const restoredFunctional = await pool.query<{
      role_code: string; role_name: string; role_scope_type: string; description: string;
    }>(`
      SELECT role_code, role_name, role_scope_type, description
      FROM ops.role WHERE role_code IN ('AUDITOR','INTEGRATION_ADMIN','SNAPSHOT_OPERATOR')
      ORDER BY role_code
    `);
    expect(restoredFunctional.rows).toEqual([
      { role_code: "AUDITOR", role_name: "Auditor", role_scope_type: "region", description: "Executes checklist audits" },
      { role_code: "INTEGRATION_ADMIN", role_name: "Integration Admin", role_scope_type: "company", description: "Manages integration sources and import batches" },
      { role_code: "SNAPSHOT_OPERATOR", role_name: "Snapshot Operator", role_scope_type: "company", description: "Runs and reruns reporting snapshots" },
    ]);
    const restoredVm = await pool.query<{ role_code: string; description: string }>(`
      SELECT role_code, description FROM ops.role WHERE role_code LIKE 'VM_%' ORDER BY role_code
    `);
    expect(restoredVm.rows).toEqual([
      { role_code: "VM_CAMPAIGN_EMERGENCY_AUTHORITY", description: "Explicit company-scoped VM campaign emergency authority" },
      { role_code: "VM_CAMPAIGN_SCOPE_AUTHORITY", description: "Explicit company-scoped VM campaign scope authority" },
      { role_code: "VM_CAMPAIGN_WINDOW_AUTHORITY", description: "Explicit company-scoped VM campaign window authority" },
      { role_code: "VM_REFERENCE_PUBLISHER", description: "Explicit company-scoped VM reference publishing capability" },
      { role_code: "VM_VISUAL_REVIEWER", description: "Explicit company-scoped VM visual coverage read capability" },
    ]);
    const restoredGrants = await pool.query<{ role_code: string; permission_code: string }>(`
      SELECT role.role_code, permission.permission_code
      FROM ops.role role
      JOIN ops.role_permission role_permission ON role_permission.role_id = role.role_id
      JOIN ops.permission permission ON permission.permission_id = role_permission.permission_id
      WHERE role.role_code IN (
        'AUDITOR','INTEGRATION_ADMIN','SNAPSHOT_OPERATOR','VM_REFERENCE_PUBLISHER',
        'VM_VISUAL_REVIEWER','VM_CAMPAIGN_WINDOW_AUTHORITY','VM_CAMPAIGN_SCOPE_AUTHORITY',
        'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
      )
      ORDER BY role.role_code, permission.permission_code
    `);
    expect(restoredGrants.rows).toEqual([
      { role_code: "AUDITOR", permission_code: "checklist.manage" },
      { role_code: "AUDITOR", permission_code: "reports.read" },
      { role_code: "AUDITOR", permission_code: "store.read" },
      { role_code: "INTEGRATION_ADMIN", permission_code: "integration.manage" },
      { role_code: "SNAPSHOT_OPERATOR", permission_code: "snapshot.manage" },
      { role_code: "SNAPSHOT_OPERATOR", permission_code: "snapshot.read" },
      { role_code: "VM_CAMPAIGN_EMERGENCY_AUTHORITY", permission_code: "VM_CAMPAIGN_EMERGENCY_AUTHORITY" },
      { role_code: "VM_CAMPAIGN_SCOPE_AUTHORITY", permission_code: "VM_CAMPAIGN_SCOPE_AUTHORITY" },
      { role_code: "VM_CAMPAIGN_WINDOW_AUTHORITY", permission_code: "VM_CAMPAIGN_WINDOW_AUTHORITY" },
      { role_code: "VM_REFERENCE_PUBLISHER", permission_code: "VM_REFERENCE_PUBLISHER" },
      { role_code: "VM_VISUAL_REVIEWER", permission_code: "VM_VISUAL_REVIEWER" },
    ]);
    const superVm = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM ops.role_permission role_permission
      JOIN ops.role role ON role.role_id = role_permission.role_id
      JOIN ops.permission permission ON permission.permission_id = role_permission.permission_id
      WHERE role.role_code = 'SUPER_ADMIN' AND permission.permission_code LIKE 'VM_%'
    `);
    expect(superVm.rows[0]?.count).toBe("0");
    const tracking = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM audit.schema_migration
      WHERE migration_name = '091_role_catalog_simplification_v1.sql'
    `);
    expect(tracking.rows[0]?.count).toBe("0");
    await pool.query(`
      INSERT INTO ops.user_role_assignment (role_id)
      SELECT role_id FROM ops.role WHERE role_code = 'AUDITOR'
    `);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(client.query(migrationSql)).rejects.toThrow("Removed roles still have user assignments");
      await rollback(client);
    } finally {
      client.release();
    }
    await pool.query(`DELETE FROM ops.user_role_assignment`);
    await expect(pool.query(`BEGIN; ${migrationSql} COMMIT;`)).resolves.toBeDefined();
    const finalCount = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ops.role`);
    expect(finalCount.rows[0]?.count).toBe("7");
  });
});
