import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { checklistCompletionSql } from "./checklist-completion.sql";

const connectionString = process.env.CHECKLIST_SCORING_POSTGRES_URL;
const integration = connectionString ? describe : describe.skip;

integration("checklist completion scoring (PostgreSQL)", () => {
  jest.setTimeout(30_000);
  const databaseName = `checklist_score_${process.pid}_${randomUUID().slice(0, 8)}`;
  const templateId = randomUUID();
  const instanceId = randomUUID();
  const itemIds = [randomUUID(), randomUUID(), randomUUID()];
  let adminPool: Pool;
  let pool: Pool;
  const databaseUrl = (name: string) => { const url = new URL(connectionString!); url.pathname = `/${name}`; return url.toString(); };
  const calculate = () => pool.query<{
    total_score: string | null; compliance_rate: string | null;
    missing_mandatory_count: string; missing_required_evidence_count: string;
  }>(checklistCompletionSql, [instanceId]);

  beforeAll(async () => {
    adminPool = new Pool({ connectionString: databaseUrl("postgres") });
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    pool = new Pool({ connectionString: databaseUrl(databaseName) });
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA ops;
      CREATE TABLE ops.checklist_template (checklist_template_id uuid PRIMARY KEY);
      CREATE TABLE ops.checklist_template_item (
        template_item_id uuid PRIMARY KEY, checklist_template_id uuid NOT NULL,
        response_type text NOT NULL, max_score numeric(10,2) NOT NULL, weight numeric(10,2) NOT NULL,
        is_mandatory boolean NOT NULL
      );
      CREATE TABLE ops.checklist_instance (
        checklist_instance_id uuid PRIMARY KEY, checklist_template_id uuid NOT NULL
      );
      CREATE TABLE ops.checklist_response (
        response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checklist_instance_id uuid NOT NULL,
        template_item_id uuid NOT NULL, response_value text, score_value numeric(10,2), comment_text text
      );
      CREATE TABLE ops.checklist_instance_item_policy (
        checklist_instance_id uuid NOT NULL, template_item_id uuid NOT NULL, evidence_policy text NOT NULL
      );
      CREATE TABLE ops.media_asset (media_asset_id uuid PRIMARY KEY, state text NOT NULL);
      CREATE TABLE ops.checklist_response_media (
        checklist_instance_id uuid NOT NULL, template_item_id uuid NOT NULL,
        media_asset_id uuid NOT NULL, unlinked_at timestamptz
      );
      INSERT INTO ops.checklist_template VALUES ('${templateId}');
      INSERT INTO ops.checklist_instance VALUES ('${instanceId}','${templateId}');
      INSERT INTO ops.checklist_template_item VALUES
        ('${itemIds[0]}','${templateId}','compliance',2,20,TRUE),
        ('${itemIds[1]}','${templateId}','compliance',2,30,TRUE),
        ('${itemIds[2]}','${templateId}','compliance',2,50,TRUE);
    `);
  });

  afterAll(async () => {
    await pool?.end();
    await adminPool?.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1`, [databaseName]);
    await adminPool?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await adminPool?.end();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE ops.checklist_response, ops.checklist_instance_item_policy, ops.checklist_response_media`);
    await pool.query(`UPDATE ops.checklist_template_item SET response_type='compliance', max_score=2,
      weight=CASE template_item_id WHEN $1::uuid THEN 20 WHEN $2::uuid THEN 30 ELSE 50 END`, itemIds.slice(0, 2));
  });

  it("renormalizes N/A weight and gives partial compliance half credit", async () => {
    await pool.query(`
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value) VALUES
        ('${instanceId}','${itemIds[0]}','compliant',2),
        ('${instanceId}','${itemIds[1]}','partially_compliant',1),
        ('${instanceId}','${itemIds[2]}','not_applicable',0);
      INSERT INTO ops.checklist_instance_item_policy VALUES
        ('${instanceId}','${itemIds[2]}','required');
      UPDATE ops.checklist_response SET comment_text='Not present at this store' WHERE response_value='not_applicable';
    `);
    const result = await calculate();
    expect(result.rows[0]).toEqual({
      total_score: "70.00", compliance_rate: "0.7500",
      missing_mandatory_count: "0", missing_required_evidence_count: "0",
    });
  });

  it("returns null scores and no evidence debt when every item is N/A", async () => {
    await pool.query(`
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value,comment_text)
      SELECT '${instanceId}', template_item_id, 'not_applicable', 0, 'Not present at this store'
      FROM ops.checklist_template_item;
      INSERT INTO ops.checklist_instance_item_policy
      SELECT '${instanceId}', template_item_id, 'required' FROM ops.checklist_template_item;
    `);
    const result = await calculate();
    expect(result.rows[0]).toEqual({
      total_score: null, compliance_rate: null,
      missing_mandatory_count: "0", missing_required_evidence_count: "0",
    });
  });

  it.each(["1.01", "0.01"])("keeps partial compliance exactly half after numeric(10,2) rounding at max %s", async (maxScore) => {
    await pool.query(`UPDATE ops.checklist_template_item SET max_score=$1::numeric`, [maxScore]);
    await pool.query(`
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value,comment_text)
      SELECT $1::uuid, template_item_id,
        CASE WHEN template_item_id=$2::uuid THEN 'partially_compliant' ELSE 'not_applicable' END,
        CASE WHEN template_item_id=$2::uuid THEN max_score / 2 ELSE 0 END,
        'Not present at this store'
      FROM ops.checklist_template_item;
    `, [instanceId, itemIds[0]]);
    const persisted = await pool.query(`SELECT score_value::text FROM ops.checklist_response WHERE template_item_id=$1::uuid`, [itemIds[0]]);
    expect(persisted.rows[0]?.score_value).toBe(maxScore === "1.01" ? "0.51" : "0.01");
    const result = await calculate();
    expect(result.rows[0]).toEqual({
      total_score: "50.00", compliance_rate: "0.5000",
      missing_mandatory_count: "0", missing_required_evidence_count: "0",
    });
  });

  it("still requires evidence for an applicable required item", async () => {
    await pool.query(`
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value)
      VALUES ('${instanceId}','${itemIds[0]}','compliant',2);
      INSERT INTO ops.checklist_instance_item_policy VALUES
        ('${instanceId}','${itemIds[0]}','required');
    `);
    const result = await calculate();
    expect(result.rows[0]?.missing_required_evidence_count).toBe("1");
  });

  it.each([null, "", " \t\n"])("rejects pre-existing N/A drafts with missing reason %p", async (reason) => {
    await pool.query(`
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value,comment_text)
      SELECT $1::uuid, template_item_id, 'not_applicable', 0, $2::text FROM ops.checklist_template_item;
    `, [instanceId, reason]);
    const result = await calculate();
    expect(result.rows[0]?.missing_mandatory_count).toBe("3");
  });

  it("keeps proportional score-template metrics even for a forged N/A response value", async () => {
    await pool.query(`
      UPDATE ops.checklist_template_item SET response_type='score';
      INSERT INTO ops.checklist_response (checklist_instance_id,template_item_id,response_value,score_value) VALUES
        ('${instanceId}','${itemIds[0]}','not_applicable',2),
        ('${instanceId}','${itemIds[1]}',NULL,1),
        ('${instanceId}','${itemIds[2]}',NULL,2);
    `);
    const result = await calculate();
    expect(result.rows[0]?.total_score).toBe("85.00");
    expect(result.rows[0]?.compliance_rate).toBe("0.8500");
  });
});
