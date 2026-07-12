import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { buildAuthorityClassifierResult } from "./staging-remediation-row-authority-classifier-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";

const fixtureCompanyIds = Array.from({ length: 11 }, (_, index) =>
  `11${String(index + 1).padStart(6, "0")}-0000-4000-8000-000000000001`);
let fixturePhase = "configuration";

const expectedReasons = [
  "assign01.rotation_authority_source_absent",
  "org02.rotation_authority_source_absent",
  "org04.duplicate_rows_same_manager",
  "org04.mixed_scope_multiple_managers",
  "org04.multiple_distinct_managers",
  "org04.region_portfolio_not_effective",
  "org04.role_assignment_never_configured",
  "org04.role_assignment_not_effective",
  "org04.scope_hierarchy_mismatch",
  "org04.unique_manager_region_mismatch",
].sort();

async function main() {
  const connectionString = readDisposableDatabaseUrl();
  const invariantV2Query = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-invariant-v2.sql"),
    "utf8",
  );
  const classifierQuery = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-row-authority-classifier-v1.sql"),
    "utf8",
  );
  const pool = new Pool({ connectionString, max: 1, ssl: false });
  fixturePhase = "connect";
  const client = await pool.connect();

  try {
    fixturePhase = "fixture_insert";
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    await client.query(fixtureSql);

    fixturePhase = "invariant_v2_query";
    const invariantRows = await client.query<{ invariant: unknown }>(invariantV2Query);
    const invariantV2 = validateInvariantV2QueryResult(invariantRows.rows[0]?.invariant);

    fixturePhase = "authority_classifier_query";
    const classifierRows = await client.query<{ authority_classifier: unknown }>(classifierQuery);
    const result = buildAuthorityClassifierResult(
      classifierRows.rows[0]?.authority_classifier,
      invariantV2,
    );
    const reasons = result.buckets.map((bucket) => bucket.reason).sort();
    if (JSON.stringify(reasons) !== JSON.stringify(expectedReasons)) {
      throw new Error("fixture_authority_reasons_mismatch");
    }
    const v2Totals = Object.fromEntries(result.v2FamilyTotals.map((item) => [item.family, item.hitCount]));
    if (JSON.stringify(v2Totals) !== JSON.stringify({
      "ASSIGN-01": 2,
      "ORG-02": 1,
      "ORG-04": 10,
      "TARGET-02": 0,
    })) {
      throw new Error("fixture_authority_v2_totals_mismatch");
    }
    if (result.overall.checkHitCount !== 13 || result.overall.authorityUnitCount !== 12) {
      throw new Error("fixture_authority_overall_mismatch");
    }

    fixturePhase = "rollback_verification";
    await client.query("ROLLBACK");
    const residue = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM ops.company WHERE company_id = ANY($1::uuid[])",
      [fixtureCompanyIds],
    );
    if (residue.rows[0]?.count !== "0") throw new Error("fixture_rollback_failed");

    process.stdout.write(`${JSON.stringify({
      authorityUnitCount: result.overall.authorityUnitCount,
      checkHitCount: result.overall.checkHitCount,
      event: "staging_remediation_row_authority_classifier.fixture_smoke_completed",
      reasons,
      rolledBack: true,
      targetClass: "disposable",
      v2Totals,
    })}\n`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function readDisposableDatabaseUrl() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("database_url_missing");
  const parsed = new URL(raw);
  if (!(["postgres:", "postgresql:"] as string[]).includes(parsed.protocol)) {
    throw new Error("invalid_database_protocol");
  }
  if (!(["localhost", "127.0.0.1"] as string[]).includes(parsed.hostname)) {
    throw new Error("non_local_fixture_target_refused");
  }
  if (!/^store_ops_fresh_migration_smoke_preflight(?:_[a-z0-9_]+)?$/.test(parsed.pathname.slice(1))) {
    throw new Error("non_disposable_fixture_database_refused");
  }
  return raw;
}

const fixtureSql = `
  INSERT INTO ops.company (company_id, company_code, company_name)
  SELECT
    ('11' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'AUTH_COMPANY_' || index,
    'Authority Company ' || index
  FROM generate_series(1, 11) AS series(index);

  INSERT INTO ops.region (region_id, company_id, region_code, region_name)
  SELECT
    ('21' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    ('11' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'AUTH_REGION_' || index,
    'Authority Region ' || index
  FROM generate_series(1, 11) AS series(index);

  INSERT INTO ops.region (region_id, company_id, region_code, region_name)
  VALUES (
    '21000008-0000-4000-8000-000000000002',
    '11000008-0000-4000-8000-000000000001',
    'AUTH_REGION_8_ALT',
    'Authority Region 8 Alternate'
  ), (
    '21000010-0000-4000-8000-000000000002',
    '11000010-0000-4000-8000-000000000001',
    'AUTH_REGION_10_ALT',
    'Authority Region 10 Alternate'
  );

  INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
  SELECT
    ('31' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    ('11' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    ('21' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'AUTH_STORE_' || index,
    'Authority Store ' || index,
    'company'
  FROM generate_series(1, 11) AS series(index);

  INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
  VALUES (
    '31000011-0000-4000-8000-000000000002',
    '11000011-0000-4000-8000-000000000001',
    '21000011-0000-4000-8000-000000000001',
    'AUTH_STORE_11_SECONDARY',
    'Authority Store 11 Secondary',
    'company'
  );

  INSERT INTO ops.position (position_id, company_id, position_code, position_name)
  SELECT
    ('41' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    ('11' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'AUTH_POSITION_' || index,
    'Authority Position ' || index
  FROM generate_series(1, 11) AS series(index);

  INSERT INTO ops.user_account (user_id, username, email)
  SELECT
    ('71' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'authority_user_' || index,
    'authority_user_' || index
  FROM generate_series(3, 8) AS series(index);

  INSERT INTO ops.user_account (user_id, username, email)
  VALUES
    ('71600000-0000-4000-8000-000000000002', 'authority_user_6_region', 'authority_user_6_region'),
    ('71700000-0000-4000-8000-000000000002', 'authority_user_7_second', 'authority_user_7_second');

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at, end_at)
  SELECT '91300000-0000-4000-8000-000000000001', '71000003-0000-4000-8000-000000000001', role_id,
    'store', '11000003-0000-4000-8000-000000000001', '21000003-0000-4000-8000-000000000001',
    '31000003-0000-4000-8000-000000000001', TIMESTAMPTZ '2027-01-01 00:00:00+00', NULL
  FROM ops.role WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, start_at, end_at)
  SELECT '91400000-0000-4000-8000-000000000001', '71000004-0000-4000-8000-000000000001', role_id,
    'region', '11000004-0000-4000-8000-000000000001', '21000004-0000-4000-8000-000000000001',
    TIMESTAMPTZ '2026-01-01 00:00:00+00', NULL
  FROM ops.role WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at, end_at)
  SELECT id, '71000005-0000-4000-8000-000000000001', role_id, 'store',
    '11000005-0000-4000-8000-000000000001', '21000005-0000-4000-8000-000000000001',
    '31000005-0000-4000-8000-000000000001', TIMESTAMPTZ '2026-01-01 00:00:00+00',
    TIMESTAMPTZ '2026-12-31 23:59:59+00'
  FROM ops.role
  CROSS JOIN (VALUES
    ('91500000-0000-4000-8000-000000000001'::uuid),
    ('91500000-0000-4000-8000-000000000002'::uuid)
  ) ids(id)
  WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at)
  SELECT '91600000-0000-4000-8000-000000000001', '71000006-0000-4000-8000-000000000001', role_id,
    'store', '11000006-0000-4000-8000-000000000001', '21000006-0000-4000-8000-000000000001',
    '31000006-0000-4000-8000-000000000001', TIMESTAMPTZ '2026-01-01 00:00:00+00'
  FROM ops.role WHERE role_code = 'REGION_MANAGER';
  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, start_at)
  SELECT '91600000-0000-4000-8000-000000000002', '71600000-0000-4000-8000-000000000002', role_id,
    'region', '11000006-0000-4000-8000-000000000001', '21000006-0000-4000-8000-000000000001',
    TIMESTAMPTZ '2026-01-01 00:00:00+00'
  FROM ops.role WHERE role_code = 'REGION_MANAGER';
  INSERT INTO ops.user_action_store_assignment
    (user_action_store_assignment_id, user_id, store_id, start_at)
  VALUES ('a1600000-0000-4000-8000-000000000001', '71600000-0000-4000-8000-000000000002',
    '31000006-0000-4000-8000-000000000001', TIMESTAMPTZ '2026-01-01 00:00:00+00');

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at)
  SELECT id, user_id, role_id, 'store', '11000007-0000-4000-8000-000000000001',
    '21000007-0000-4000-8000-000000000001', '31000007-0000-4000-8000-000000000001',
    TIMESTAMPTZ '2026-01-01 00:00:00+00'
  FROM ops.role
  CROSS JOIN (VALUES
    ('91700000-0000-4000-8000-000000000001'::uuid, '71000007-0000-4000-8000-000000000001'::uuid),
    ('91700000-0000-4000-8000-000000000002'::uuid, '71700000-0000-4000-8000-000000000002'::uuid)
  ) rows(id, user_id)
  WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at)
  SELECT '91800000-0000-4000-8000-000000000001', '71000008-0000-4000-8000-000000000001', role_id,
    'store', '11000008-0000-4000-8000-000000000001', '21000008-0000-4000-8000-000000000002',
    '31000008-0000-4000-8000-000000000001', TIMESTAMPTZ '2026-01-01 00:00:00+00'
  FROM ops.role WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.kpi_actual
    (kpi_actual_id, kpi_id, scope_type, company_id, region_id, store_id, period_type,
      period_start, period_end, actual_value, source_type)
  SELECT
    ('c1' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    definition.kpi_id,
    'store',
    CASE WHEN index = 1 THEN '11000002-0000-4000-8000-000000000001'::uuid
      ELSE ('11' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid END,
    ('21' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    ('31' || lpad(index::text, 6, '0') || '-0000-4000-8000-000000000001')::uuid,
    'monthly', DATE '2026-06-01', DATE '2026-06-30', index, 'authority_fixture'
  FROM generate_series(1, 8) AS series(index)
  CROSS JOIN LATERAL (SELECT kpi_id FROM ops.kpi_definition ORDER BY kpi_id LIMIT 1) definition;

  INSERT INTO ops.workforce_norm_plan
    (norm_plan_id, company_id, region_id, store_id, position_id, period_start, period_end,
      planned_headcount, planned_fte)
  VALUES (
    'd1900000-0000-4000-8000-000000000001',
    '11000009-0000-4000-8000-000000000001',
    '21000009-0000-4000-8000-000000000001',
    '31000009-0000-4000-8000-000000000001',
    '41000009-0000-4000-8000-000000000001',
    CURRENT_DATE, CURRENT_DATE + 30, 5, 5
  );

  INSERT INTO audit.event_log
    (event_log_id, event_type, entity_name, scope_type, company_id, region_id, store_id)
  VALUES (
    'e1000000-0000-4000-8000-000000000001',
    'authority.fixture', 'authority.fixture', 'store',
    '11000001-0000-4000-8000-000000000001',
    '21000001-0000-4000-8000-000000000001',
    '31000002-0000-4000-8000-000000000001'
  );

  INSERT INTO ops.employee (employee_id, company_id, first_name, last_name, hire_date, employment_type)
  VALUES
    ('5a000000-0000-4000-8000-000000000010', '11000010-0000-4000-8000-000000000001',
      'Fixture', 'Org02', DATE '2025-01-01', 'full_time'),
    ('5a000000-0000-4000-8000-000000000011', '11000011-0000-4000-8000-000000000001',
      'Fixture', 'Assign', DATE '2025-01-01', 'full_time');

  INSERT INTO ops.employee_assignment_history
    (assignment_id, employee_id, store_id, region_id, position_id, start_date, end_date,
      is_primary_assignment, assignment_status)
  VALUES
    ('6a000000-0000-4000-8000-000000000010', '5a000000-0000-4000-8000-000000000010',
      '31000010-0000-4000-8000-000000000001', '21000010-0000-4000-8000-000000000002',
      '41000010-0000-4000-8000-000000000001', DATE '2026-01-01', NULL, TRUE, 'active'),
    ('6a000000-0000-4000-8000-000000000011', '5a000000-0000-4000-8000-000000000011',
      '31000011-0000-4000-8000-000000000001', '21000011-0000-4000-8000-000000000001',
      '41000011-0000-4000-8000-000000000001', DATE '2026-01-01', NULL, TRUE, 'active'),
    ('6a000000-0000-4000-8000-000000000012', '5a000000-0000-4000-8000-000000000011',
      '31000011-0000-4000-8000-000000000002', '21000011-0000-4000-8000-000000000001',
      '41000011-0000-4000-8000-000000000001', DATE '2026-02-01', NULL, TRUE, 'active');
`;

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    error: classifyFixtureError(error),
    event: "staging_remediation_row_authority_classifier.fixture_smoke_failed",
    phase: fixturePhase,
  })}\n`);
  process.exitCode = 1;
});

function classifyFixtureError(error: unknown) {
  if (error instanceof Error && [
    "database_url_missing",
    "fixture_authority_overall_mismatch",
    "fixture_authority_reasons_mismatch",
    "fixture_authority_v2_totals_mismatch",
    "fixture_rollback_failed",
    "invalid_database_protocol",
    "non_disposable_fixture_database_refused",
    "non_local_fixture_target_refused",
    "production_refused",
  ].includes(error.message)) return error.message;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (/^[0-9A-Z]{5}$/.test(code)) return `postgres_${code}`;
  }
  return "fixture_smoke_failed";
}
