import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.STORE_CONTACT_EMAIL_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;
const root = join(__dirname, "../../../../../..");
const migrationSql = readFileSync(join(root, "db/migrations/093_store_contact_email_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/093_store_contact_email_v1.rollback.sql"), "utf8");
const invariantSql = readFileSync(join(root, "db/preflight/store-contact-email-invariants-v1.sql"), "utf8");

integration("store contact emails (PostgreSQL)", () => {
  jest.setTimeout(30_000);
  const databaseName = `store_contact_${process.pid}_${randomUUID().slice(0, 8)}`;
  const companyId = randomUUID();
  const secondCompanyId = randomUUID();
  const storeId = randomUUID();
  let adminPool: Pool;
  let pool: Pool;
  const databaseUrl = (name: string) => { const url = new URL(connectionString!); url.pathname = `/${name}`; return url.toString(); };
  const rollback = async (client: PoolClient) => client.query("ROLLBACK").catch(() => undefined);

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
      CREATE TABLE ops.store (store_id uuid PRIMARY KEY, company_id uuid NOT NULL);
      CREATE TABLE stg.external_id_map (
        external_id_map_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_source_id uuid NOT NULL,
        entity_type text NOT NULL,
        external_id text NOT NULL,
        internal_id uuid NOT NULL,
        is_active boolean NOT NULL DEFAULT TRUE
      );
      CREATE TABLE audit.schema_migration (migration_name text PRIMARY KEY);
      INSERT INTO ops.company VALUES ('${companyId}'),('${secondCompanyId}');
      INSERT INTO ops.store VALUES ('${storeId}','${companyId}');
      BEGIN; ${migrationSql} COMMIT;
    `);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`, [databaseName]);
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  it("serializes rollback against a concurrent contact insert", async () => {
    const writer = await pool.connect();
    const rollbackClient = await pool.connect();
    try {
      await writer.query("BEGIN");
      await writer.query(`
        INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
        VALUES ($1::uuid,$2::uuid,'pending@example.com',TRUE)
      `, [companyId, storeId]);
      await expect(rollbackClient.query(rollbackSql)).rejects.toMatchObject({ code: "55P03" });
      await rollback(rollbackClient);
      await writer.query("ROLLBACK");
    } finally {
      await rollback(writer);
      await rollback(rollbackClient);
      writer.release();
      rollbackClient.release();
    }
  });

  it("rolls back idempotently before use and reapplies twice", async () => {
    await pool.query(rollbackSql);
    await expect(pool.query(rollbackSql)).resolves.toBeDefined();
    await pool.query(`BEGIN; ${migrationSql} COMMIT;`);
    await expect(pool.query(`BEGIN; ${migrationSql} COMMIT;`)).resolves.toBeDefined();
    const index = await pool.query<{ indexdef: string }>(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname='stg' AND indexname='idx_external_id_map_internal_entity_active'
    `);
    expect(index.rows[0]?.indexdef).toContain("internal_id, entity_type, integration_source_id");
    const planClient = await pool.connect();
    try {
      await planClient.query("BEGIN");
      await planClient.query("SET LOCAL enable_seqscan=off");
      const plan = await planClient.query<{ "QUERY PLAN": string }>(`
        EXPLAIN SELECT integration_source_id FROM stg.external_id_map
        WHERE internal_id=$1::uuid AND entity_type='store' AND is_active=TRUE
      `, [storeId]);
      expect(plan.rows.map((row) => row["QUERY PLAN"]).join("\n")).toContain("idx_external_id_map_internal_entity_active");
      await planClient.query("ROLLBACK");
    } finally { await rollback(planClient); planClient.release(); }
  });

  it("orders store-row locking before the contact advisory lock", async () => {
    const application = await pool.connect();
    const direct = await pool.connect();
    try {
      await application.query("BEGIN");
      await application.query(`SELECT 1 FROM ops.store WHERE store_id=$1::uuid FOR UPDATE`, [storeId]);
      await direct.query("BEGIN");
      await direct.query(`SET LOCAL lock_timeout='100ms'`);
      await expect(direct.query(`
        INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
        VALUES ($1::uuid,$2::uuid,'direct@example.com',TRUE)
      `, [companyId, storeId])).rejects.toMatchObject({ code: "55P03" });
      await rollback(direct);
      await expect(application.query(`
        INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
        VALUES ($1::uuid,$2::uuid,'application@example.com',TRUE)
      `, [companyId, storeId])).resolves.toBeDefined();
      await application.query("ROLLBACK");
    } finally {
      await rollback(application);
      await rollback(direct);
      application.release();
      direct.release();
    }
  });

  it("normalizes addresses and enforces one active primary", async () => {
    const secondaryStoreId = randomUUID();
    await pool.query(`INSERT INTO ops.store VALUES ($1::uuid,$2::uuid)`, [secondaryStoreId, companyId]);
    const zeroPrimaryClient = await pool.connect();
    try {
      await zeroPrimaryClient.query("BEGIN");
      await zeroPrimaryClient.query(`
        INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
        VALUES ($1::uuid,$2::uuid,'no-primary@example.com',FALSE)
      `, [companyId, secondaryStoreId]);
      await expect(zeroPrimaryClient.query("COMMIT")).rejects.toMatchObject({ constraint: "ck_store_contact_email_exact_primary" });
      await rollback(zeroPrimaryClient);
    } finally { zeroPrimaryClient.release(); }
    await pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,label,is_primary)
      VALUES ($1::uuid,$2::uuid,' STORE@Example.COM ',' Main ',TRUE)
    `, [companyId, storeId]);
    const row = await pool.query<{ email_address: string; label: string }>(`
      SELECT email_address,label FROM ops.store_contact_email WHERE store_id=$1::uuid
    `, [storeId]);
    expect(row.rows[0]).toEqual({ email_address: "store@example.com", label: "Main" });
    await expect(pool.query(`
      UPDATE ops.store_contact_email SET store_id=$2::uuid
      WHERE store_id=$1::uuid AND is_primary=TRUE
    `, [storeId, secondaryStoreId])).rejects.toMatchObject({ constraint: "ck_store_contact_email_owner_immutable" });
    await expect(pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
      VALUES ($1::uuid,$2::uuid,'other@example.com',TRUE)
    `, [companyId, storeId])).rejects.toMatchObject({ code: "23505" });
    await expect(pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
      VALUES ($1::uuid,$2::uuid,'foreign@example.com',FALSE)
    `, [secondCompanyId, storeId])).rejects.toMatchObject({ constraint: "ck_store_contact_email_company" });
    await expect(pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
      VALUES ($1::uuid,$2::uuid,$3,FALSE)
    `, [companyId, storeId, `${"x".repeat(250)}@x.com`])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary,is_active,deactivated_at)
      VALUES ($1::uuid,$2::uuid,'stale@example.com',FALSE,TRUE,NOW())
    `, [companyId, storeId])).rejects.toMatchObject({ code: "23514" });
    await pool.query(`
      INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
      VALUES ($1::uuid,$2::uuid,'secondary@example.com',FALSE)
    `, [companyId, storeId]);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ops.store_contact_email WHERE store_id=$1::uuid AND is_primary=TRUE`, [storeId]);
      await expect(client.query("COMMIT")).rejects.toMatchObject({ constraint: "ck_store_contact_email_exact_primary" });
      await rollback(client);
    } finally { client.release(); }
  });

  it("refuses rollback after contact evidence exists", async () => {
    const client = await pool.connect();
    try {
      await expect(client.query(rollbackSql)).rejects.toThrow("cannot be rolled back after store contact emails exist");
      await rollback(client);
    } finally { client.release(); }
  });

  it("executes the additive invariant and detects a rolled-back company mismatch", async () => {
    const clean = await pool.query<{ violation_count: string }>(invariantSql);
    expect(clean.rows[0]?.violation_count).toBe("0");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`ALTER TABLE ops.store_contact_email DISABLE TRIGGER trg_store_contact_email_company_guard`);
      await client.query(`
        INSERT INTO ops.store_contact_email (company_id,store_id,email_address,is_primary)
        VALUES ($1::uuid,$2::uuid,'mismatch@example.com',FALSE)
      `, [secondCompanyId, storeId]);
      const invalid = await client.query<{ violation_count: string }>(invariantSql);
      expect(invalid.rows[0]?.violation_count).toBe("1");
      await client.query("ROLLBACK");
    } finally {
      await rollback(client);
      client.release();
    }
  });
});
