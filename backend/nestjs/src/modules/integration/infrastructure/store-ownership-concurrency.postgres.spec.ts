import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.INCENTIVE_OWNERSHIP_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;
const root = join(__dirname, "../../../../../..");
const migrationSql = readFileSync(
  join(root, "db/migrations/089_store_ownership_close_concurrency_v1.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(root, "db/rollback/089_store_ownership_close_concurrency_v1.rollback.sql"),
  "utf8",
);

integration("store ownership and incentive close concurrency (PostgreSQL)", () => {
  jest.setTimeout(30_000);

  const databaseName = `ownership_close_${process.pid}_${randomUUID().slice(0, 8)}`;
  let companyId: string;
  let storeId: string;
  let adminPool: Pool;
  let pool: Pool;

  const databaseUrl = (name: string) => {
    const url = new URL(connectionString!);
    url.pathname = `/${name}`;
    return url.toString();
  };
  const rollback = async (client: PoolClient) => {
    await client.query("ROLLBACK").catch(() => undefined);
  };
  const readRevision = async (client: Pool | PoolClient) => {
    const result = await client.query<{ revision: string }>(
      `SELECT ops.store_ownership_revision_v1($1::uuid) AS revision`,
      [companyId],
    );
    return result.rows[0]?.revision ?? "";
  };
  const insertClose = async (client: PoolClient, ownershipRevision?: string) => client.query(`
    INSERT INTO ops.sales_target_incentive_close_run
      (company_id, period_key, period_end, status, source_evidence)
    VALUES ($1::uuid, '2026-09', '2026-09-30', 'succeeded', $2::jsonb)
  `, [companyId, JSON.stringify(ownershipRevision ? { ownershipRevision } : {})]);
  const insertTransition = async (client: PoolClient, effectiveOn = "2026-09-15") => client.query(`
    INSERT INTO ops.store_ownership_transition
      (store_id, effective_on, previous_type, new_type)
    VALUES ($1::uuid, $2::date, 'company', 'franchise')
  `, [storeId, effectiveOn]);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl("postgres") });
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: databaseUrl(databaseName) });
    await pool.query(`
      CREATE SCHEMA ops;
      CREATE SCHEMA audit;
      CREATE TABLE ops.store (
        store_id uuid PRIMARY KEY,
        company_id uuid NOT NULL,
        store_type text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE TABLE ops.store_ownership_transition (
        store_id uuid NOT NULL,
        effective_on date NOT NULL,
        previous_type text NOT NULL,
        new_type text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE TABLE ops.sales_target_incentive_rule_version (effective_from date NOT NULL);
      CREATE TABLE ops.sales_target_incentive_close_run (
        company_id uuid NOT NULL,
        period_key text NOT NULL,
        period_end date NOT NULL,
        status text NOT NULL,
        source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE audit.schema_migration (migration_name text PRIMARY KEY);
      BEGIN;
      ${migrationSql}
      COMMIT;
      INSERT INTO ops.sales_target_incentive_rule_version (effective_from) VALUES ('2026-01-01');
      INSERT INTO audit.schema_migration (migration_name)
      VALUES ('089_store_ownership_close_concurrency_v1.sql');
    `);
  });

  beforeEach(async () => {
    companyId = randomUUID();
    storeId = randomUUID();
    await pool.query(
      `INSERT INTO ops.store (store_id, company_id, store_type) VALUES ($1::uuid, $2::uuid, 'company')`,
      [storeId, companyId],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [databaseName],
    );
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  it("rejects a close that raced behind a committed ownership transition", async () => {
    const initialRevision = await readRevision(pool);
    const transition = await pool.connect();
    const close = await pool.connect();
    try {
      await transition.query("BEGIN");
      await insertTransition(transition);
      await transition.query(
        `UPDATE ops.store SET store_type = 'franchise', updated_at = clock_timestamp() WHERE store_id = $1::uuid`,
        [storeId],
      );

      await close.query("BEGIN");
      await close.query(`SET LOCAL lock_timeout = '100ms'`);
      await expect(insertClose(close, initialRevision)).rejects.toMatchObject({ code: "55P03" });
      await rollback(close);

      await transition.query("COMMIT");
      await close.query("BEGIN");
      await expect(insertClose(close, initialRevision)).rejects.toMatchObject({ code: "40001" });
    } finally {
      await rollback(transition);
      await rollback(close);
      transition.release();
      close.release();
    }
  });

  it("rejects a snapshotless transition that raced behind a committed company close", async () => {
    const revision = await readRevision(pool);
    const close = await pool.connect();
    const transition = await pool.connect();
    try {
      await close.query("BEGIN");
      await insertClose(close, revision);

      await transition.query("BEGIN");
      await transition.query(`SET LOCAL lock_timeout = '100ms'`);
      await expect(insertTransition(transition)).rejects.toMatchObject({ code: "55P03" });
      await rollback(transition);

      await close.query("COMMIT");
      await transition.query("BEGIN");
      await expect(insertTransition(transition)).rejects.toMatchObject({
        code: "23514",
        constraint: "ck_store_ownership_transition_open_period",
      });
    } finally {
      await rollback(close);
      await rollback(transition);
      close.release();
      transition.release();
    }
  });

  it("rejects legacy closes and direct or invalid ownership mutations", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(insertClose(client)).rejects.toMatchObject({
        constraint: "ck_incentive_close_ownership_revision_required",
      });
      await rollback(client);

      await client.query("BEGIN");
      await expect(client.query(
        `UPDATE ops.store SET store_type = 'franchise' WHERE store_id = $1::uuid`,
        [storeId],
      )).rejects.toMatchObject({ constraint: "ck_store_type_requires_transition" });
      await rollback(client);

      await client.query("BEGIN");
      await expect(insertTransition(client, "2099-01-01")).rejects.toMatchObject({
        constraint: "ck_store_ownership_transition_not_future",
      });
      await rollback(client);

      await client.query("BEGIN");
      await insertTransition(client);
      await expect(client.query("COMMIT")).rejects.toMatchObject({
        constraint: "ck_store_ownership_transition_committed_type",
      });
      await rollback(client);

      await client.query("BEGIN");
      await insertTransition(client);
      await client.query(
        `UPDATE ops.store SET store_type = 'franchise' WHERE store_id = $1::uuid`,
        [storeId],
      );
      await client.query("COMMIT");

      await client.query("BEGIN");
      await expect(client.query(
        `DELETE FROM ops.store_ownership_transition WHERE store_id = $1::uuid`,
        [storeId],
      )).rejects.toMatchObject({ code: "55000" });
      await rollback(client);

      await client.query("BEGIN");
      await expect(client.query("TRUNCATE ops.store_ownership_transition")).rejects.toMatchObject({
        code: "55000",
      });
    } finally {
      await rollback(client);
      client.release();
    }
  });

  it("rolls back and reapplies the exact ownership concurrency migration", async () => {
    await pool.query(rollbackSql);

    const removed = await pool.query<{ trigger_count: number; function_count: number; tracking_count: number }>(`
      SELECT
        (SELECT COUNT(*)::int FROM pg_trigger WHERE tgname IN (
          'trg_store_ownership_transition_close_guard',
          'trg_store_ownership_transition_commit_guard',
          'trg_store_ownership_transition_immutable',
          'trg_store_ownership_transition_truncate_guard',
          'trg_store_type_direct_update_guard',
          'trg_incentive_close_ownership_revision_guard'
        )) AS trigger_count,
        (SELECT COUNT(*)::int FROM pg_proc WHERE proname IN (
          'store_ownership_revision_v1',
          'guard_store_ownership_transition_v1',
          'verify_store_ownership_transition_commit_v1',
          'prevent_store_ownership_transition_mutation_v1',
          'guard_store_type_direct_update_v1',
          'guard_incentive_close_ownership_revision_v1'
        )) AS function_count,
        (SELECT COUNT(*)::int FROM audit.schema_migration
          WHERE migration_name = '089_store_ownership_close_concurrency_v1.sql') AS tracking_count
    `);
    expect(removed.rows[0]).toEqual({ trigger_count: 0, function_count: 0, tracking_count: 0 });

    await pool.query(`BEGIN; ${migrationSql} COMMIT;`);
    const revision = await readRevision(pool);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await expect(insertClose(client)).rejects.toMatchObject({
        constraint: "ck_incentive_close_ownership_revision_required",
      });
      await rollback(client);

      await client.query("BEGIN");
      await expect(insertClose(client, revision)).resolves.toBeDefined();
      await client.query("ROLLBACK");
    } finally {
      await rollback(client);
      client.release();
    }
  });
});
