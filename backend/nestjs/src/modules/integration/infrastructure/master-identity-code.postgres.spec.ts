import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.MASTER_IDENTITY_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;
const root = join(__dirname, "../../../../../..");
const migrationSql = readFileSync(join(root, "db/migrations/090_master_identity_code_reservation_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/090_master_identity_code_reservation_v1.rollback.sql"), "utf8");

integration("master identity code reservation (PostgreSQL)", () => {
  jest.setTimeout(30_000);
  const databaseName = `master_identity_${process.pid}_${randomUUID().slice(0, 8)}`;
  const companyId = "00000000-0000-4000-8000-000000000001";
  const storeId = "00000000-0000-4000-8000-000000000002";
  const employeeId = "00000000-0000-4000-8000-000000000003";
  const kpiSourceId = "00000000-0000-4000-8000-000000000004";
  const employeeSourceId = "00000000-0000-4000-8000-000000000005";
  const assignmentSourceId = "00000000-0000-4000-8000-000000000006";
  let adminPool: Pool;
  let pool: Pool;

  const databaseUrl = (name: string) => {
    const url = new URL(connectionString!);
    url.pathname = `/${name}`;
    return url.toString();
  };
  const rollback = async (client: PoolClient) => client.query("ROLLBACK").catch(() => undefined);
  const applyMigration = async () => pool.query(`BEGIN; ${migrationSql} COMMIT;`);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl("postgres") });
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: databaseUrl(databaseName) });
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA ops;
      CREATE SCHEMA stg;
      CREATE SCHEMA audit;
      CREATE TABLE ops.company (company_id uuid PRIMARY KEY);
      CREATE TABLE ops.store (
        store_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES ops.company(company_id),
        store_code text NOT NULL
      );
      CREATE TABLE ops.employee (
        employee_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES ops.company(company_id),
        external_employee_ref text
      );
      CREATE TABLE stg.integration_source (
        integration_source_id uuid PRIMARY KEY,
        entity_type text NOT NULL,
        is_active boolean NOT NULL
      );
      CREATE TABLE stg.external_id_map (
        external_id_map_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_source_id uuid NOT NULL REFERENCES stg.integration_source(integration_source_id),
        entity_type text NOT NULL,
        external_id text NOT NULL,
        internal_id uuid NOT NULL,
        internal_table_name text NOT NULL,
        is_active boolean NOT NULL DEFAULT TRUE,
        UNIQUE (integration_source_id, entity_type, external_id)
      );
      CREATE TABLE audit.schema_migration (migration_name text PRIMARY KEY);
      INSERT INTO ops.company VALUES ('${companyId}');
      INSERT INTO ops.store VALUES ('${storeId}', '${companyId}', 'SM150');
      INSERT INTO ops.employee VALUES ('${employeeId}', '${companyId}', 'P100');
      INSERT INTO stg.integration_source VALUES
        ('${kpiSourceId}', 'kpi', TRUE),
        ('${employeeSourceId}', 'employee', TRUE),
        ('${assignmentSourceId}', 'assignment', TRUE);
    `);
    await applyMigration();
    await pool.query(`INSERT INTO audit.schema_migration VALUES ('090_master_identity_code_reservation_v1.sql')`);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]);
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  it("rolls back safely before use and reapplies the exact migration", async () => {
    await expect(applyMigration()).resolves.toBeDefined();
    await pool.query(rollbackSql);
    const removed = await pool.query<{ reservation: string | null }>(
      `SELECT to_regclass('ops.master_identity_code_reservation')::text AS reservation`,
    );
    expect(removed.rows[0]?.reservation).toBeNull();
    await applyMigration();
    await pool.query(`INSERT INTO audit.schema_migration VALUES ('090_master_identity_code_reservation_v1.sql')`);
  });

  it("rejects codes that normalize to an empty identity", async () => {
    await expect(pool.query(
      `INSERT INTO ops.store (company_id, store_code) VALUES ($1::uuid, '--')`,
      [companyId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_store_code_nonempty" });
    await expect(pool.query(
      `INSERT INTO ops.employee (company_id, external_employee_ref) VALUES ($1::uuid, ' - ')`,
      [companyId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_employee_code_nonempty" });
  });

  it("marks a normalized-equivalent edit as runtime history", async () => {
    await pool.query(`UPDATE ops.store SET store_code = 'SM-150' WHERE store_id = $1::uuid`, [storeId]);
    const reservation = await pool.query<{ external_code: string; origin: string }>(
      `SELECT external_code, origin FROM ops.master_identity_code_reservation
       WHERE entity_type = 'store' AND internal_id = $1::uuid AND is_current = TRUE`,
      [storeId],
    );
    expect(reservation.rows[0]).toEqual({ external_code: "SM-150", origin: "runtime" });
    const exactAliases = await pool.query<{ external_id: string }>(
      `SELECT external_id FROM stg.external_id_map WHERE internal_id = $1::uuid`,
      [storeId],
    );
    expect(new Set(exactAliases.rows.map((row) => row.external_id))).toEqual(new Set(["SM150", "SM-150"]));
    const client = await pool.connect();
    try {
      await expect(client.query(rollbackSql)).rejects.toThrow(
        "Migration 090 cannot be rolled back after master identity code history is in use",
      );
      await rollback(client);
    } finally {
      client.release();
    }
  });

  it("preserves old and new store codes and rejects reuse", async () => {
    await pool.query(`UPDATE ops.store SET store_code = 'FM702' WHERE store_id = $1::uuid`, [storeId]);
    const aliases = await pool.query<{ normalized_code: string; is_current: boolean }>(
      `SELECT normalized_code, is_current FROM ops.master_identity_code_reservation
       WHERE internal_id = $1::uuid ORDER BY normalized_code`,
      [storeId],
    );
    expect(aliases.rows).toEqual([
      { normalized_code: "FM702", is_current: true },
      { normalized_code: "SM150", is_current: false },
    ]);
    const mappings = await pool.query<{ external_id: string }>(
      `SELECT external_id FROM stg.external_id_map WHERE internal_id = $1::uuid ORDER BY external_id`,
      [storeId],
    );
    expect(mappings.rows).toHaveLength(6);
    expect(new Set(mappings.rows.map((row) => row.external_id))).toEqual(new Set(["FM702", "SM150", "SM-150"]));
    await pool.query(`UPDATE ops.store SET store_code = 'FM-702' WHERE store_id = $1::uuid`, [storeId]);
    const exactAliases = await pool.query<{ external_id: string }>(
      `SELECT external_id FROM stg.external_id_map WHERE internal_id = $1::uuid`,
      [storeId],
    );
    expect(new Set(exactAliases.rows.map((row) => row.external_id))).toEqual(
      new Set(["FM702", "FM-702", "SM150", "SM-150"]),
    );
    await expect(pool.query(
      `INSERT INTO ops.store (company_id, store_code) VALUES ($1::uuid, 'SM-150')`,
      [companyId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_code_owner" });
  });

  it("maps personnel code changes into employee and KPI sources", async () => {
    await pool.query(`UPDATE ops.employee SET external_employee_ref = 'P200' WHERE employee_id = $1::uuid`, [employeeId]);
    const mappings = await pool.query<{ source_id: string; external_id: string }>(
      `SELECT integration_source_id::text AS source_id, external_id
       FROM stg.external_id_map WHERE internal_id = $1::uuid
       ORDER BY source_id, external_id`,
      [employeeId],
    );
    expect(mappings.rows).toHaveLength(6);
    expect(new Set(mappings.rows.map((row) => row.external_id))).toEqual(new Set(["P100", "P200"]));
    const secondCompanyId = randomUUID();
    await pool.query(`INSERT INTO ops.company VALUES ($1::uuid)`, [secondCompanyId]);
    await expect(pool.query(
      `INSERT INTO ops.employee (company_id, external_employee_ref) VALUES ($1::uuid, 'P-200')`,
      [secondCompanyId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_code_owner" });
  });

  it("rejects company transfers and inactive mapping ownership conflicts", async () => {
    const secondCompanyId = randomUUID();
    const otherStoreId = randomUUID();
    await pool.query(`INSERT INTO ops.company VALUES ($1::uuid)`, [secondCompanyId]);
    await expect(pool.query(
      `UPDATE ops.store SET company_id = $1::uuid WHERE store_id = $2::uuid`,
      [secondCompanyId, storeId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_company_immutable" });
    await pool.query(`INSERT INTO ops.store (store_id, company_id, store_code) VALUES ($1::uuid, $2::uuid, 'SM300')`, [
      otherStoreId,
      companyId,
    ]);
    await pool.query(
      `INSERT INTO stg.external_id_map
        (integration_source_id, entity_type, external_id, internal_id, internal_table_name, is_active)
       VALUES ($1::uuid, 'store', 'QQ1', $2::uuid, 'ops.store', FALSE)`,
      [kpiSourceId, otherStoreId],
    );
    await expect(pool.query(
      `UPDATE ops.store SET store_code = 'QQ1' WHERE store_id = $1::uuid`,
      [storeId],
    )).rejects.toMatchObject({ constraint: "ck_master_identity_mapping_owner" });
  });

  it("serializes mapping-first races and rejects the conflicting master code", async () => {
    const otherStoreId = randomUUID();
    await pool.query(`INSERT INTO ops.store (store_id, company_id, store_code) VALUES ($1::uuid, $2::uuid, 'SM200')`, [
      otherStoreId,
      companyId,
    ]);
    await pool.query(
      `INSERT INTO stg.external_id_map
        (integration_source_id, entity_type, external_id, internal_id, internal_table_name, is_active)
       VALUES ($1::uuid, 'store', 'UPD1', $2::uuid, 'ops.store', FALSE)`,
      [kpiSourceId, otherStoreId],
    );
    const mapping = await pool.connect();
    const master = await pool.connect();
    try {
      await mapping.query("BEGIN");
      await mapping.query(
        `UPDATE stg.external_id_map SET external_id = 'ZX999', is_active = TRUE
         WHERE integration_source_id = $1::uuid AND entity_type = 'store' AND external_id = 'UPD1'`,
        [kpiSourceId],
      );

      await master.query("BEGIN");
      await master.query(`SET LOCAL lock_timeout = '100ms'`);
      await expect(master.query(
        `UPDATE ops.store SET store_code = 'ZX999' WHERE store_id = $1::uuid`,
        [storeId],
      )).rejects.toMatchObject({ code: "55P03" });
      await rollback(master);
      await mapping.query("COMMIT");

      await master.query("BEGIN");
      await expect(master.query(
        `UPDATE ops.store SET store_code = 'ZX999' WHERE store_id = $1::uuid`,
        [storeId],
      )).rejects.toMatchObject({ constraint: "ck_master_identity_mapping_owner" });
    } finally {
      await rollback(mapping);
      await rollback(master);
      mapping.release();
      master.release();
    }
  });

  it("fails mapping updates retryably when the master transaction owns the code lock", async () => {
    const otherStoreId = randomUUID();
    await pool.query(`INSERT INTO ops.store (store_id, company_id, store_code) VALUES ($1::uuid, $2::uuid, 'SM400')`, [
      otherStoreId,
      companyId,
    ]);
    const master = await pool.connect();
    const mapping = await pool.connect();
    try {
      await master.query("BEGIN");
      await master.query(`UPDATE ops.store SET store_code = 'LOCK1' WHERE store_id = $1::uuid`, [storeId]);

      await mapping.query("BEGIN");
      await expect(mapping.query(
        `UPDATE stg.external_id_map SET external_id = 'LOCK1'
         WHERE integration_source_id = $1::uuid AND entity_type = 'store'
           AND external_id = 'SM400'`,
        [kpiSourceId],
      )).rejects.toMatchObject({ code: "40001" });
    } finally {
      await rollback(master);
      await rollback(mapping);
      master.release();
      mapping.release();
    }
  });

  it("refuses rollback after historical code aliases exist", async () => {
    const client = await pool.connect();
    try {
      await expect(client.query(rollbackSql)).rejects.toThrow(
        "Migration 090 cannot be rolled back after master identity code history is in use",
      );
      await rollback(client);
    } finally {
      client.release();
    }
  });
});
