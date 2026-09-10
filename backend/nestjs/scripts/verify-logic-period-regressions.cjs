// Run against a disposable/local PostgreSQL via DATABASE_URL after npm run build.
// All checks execute in a read-only transaction; no fixtures are persisted.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { readEmployeeTurkeyBenchmarks } = require('../dist/src/modules/store-ops/infrastructure/personnel-benchmark-read');
const { personnelPeriodTargetSql } = require('../dist/src/modules/store-ops/infrastructure/personnel-period-sql');
const { RankingReportingReadRepository } = require('../dist/src/modules/store-ops/infrastructure/ranking-reporting-read.repository');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const company = '00000000-0000-4000-8000-000000000001';
    const fixture = [];
    const add = (employee, day, code, value) => fixture.push({
      employee_id: employee, store_id: 'store', company_id: company,
      kpi_id: code, scope_type: 'employee', period_type: 'daily',
      period_start: day, period_end: day, actual_value: value, source_type: 'fixture',
    });
    add('incomplete', '2026-09-01', 'NET_SALES', 100);
    add('incomplete', '2026-09-02', 'NET_SALES', 100);
    add('incomplete', '2026-09-01', 'TICKET_COUNT', 10);
    const database = { query: (sql, params) => client.query(sql.replace('WITH components AS', `WITH fixture_ka AS (
      SELECT * FROM jsonb_to_recordset($5::jsonb) AS x(employee_id text, store_id text, company_id uuid,
        kpi_id text, scope_type text, period_type text, period_start date, period_end date, actual_value numeric, source_type text)
    ), fixture_kd AS (SELECT code AS kpi_id, code AS kpi_code FROM unnest(ARRAY['NET_SALES','ITEM_COUNT','TICKET_COUNT']) code), components AS`)
      .replaceAll('ops.kpi_actual', 'fixture_ka').replaceAll('ops.kpi_definition', 'fixture_kd'), [...params, JSON.stringify(fixture)]) };
    const input = { companyId: company, periodType: 'daily', periodStart: '2026-09-01', periodEnd: '2026-09-02' };
    let result = await readEmployeeTurkeyBenchmarks(database, input);
    assert.equal(result.find(r => r.kpi_code === 'ATV').benchmark_value, null);
    for (const day of ['2026-09-01', '2026-09-02']) {
      add('complete', day, 'NET_SALES', 200);
      add('complete', day, 'TICKET_COUNT', 10);
      add('complete', day, 'ITEM_COUNT', 30);
    }
    result = await readEmployeeTurkeyBenchmarks(database, input);
    assert.equal(Number(result.find(r => r.kpi_code === 'ATV').benchmark_value), 20);
    assert.equal(Number(result.find(r => r.kpi_code === 'UPT').benchmark_value), 3);
    result = await readEmployeeTurkeyBenchmarks(database, { ...input, companyId: '00000000-0000-4000-8000-000000000002' });
    assert.ok(result.every(r => r.benchmark_value === null));

    for (const [start, end, expected] of [['2026-09-05','2026-09-05',40000], ['2026-09-05','2026-09-10',240000], ['2026-09-01','2026-09-30',1200000]]) {
      const target = await client.query(`SELECT ${personnelPeriodTargetSql}::text AS value FROM
        (SELECT $1::date period_start, $2::date period_end) ka CROSS JOIN
        (SELECT '2026-09-01'::date period_start, '2026-09-30'::date period_end, 1200000::numeric target_value) ptr`, [start,end]);
      assert.equal(Number(target.rows[0].value), expected);
    }
    let checklistSql;
    await new RankingReportingReadRepository({ query: async sql => { checklistSql = sql; return { rows: [] }; } })
      .listRankingStoreChecklistRows({ companyIds: [], periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    const predicate = checklistSql.match(/ci\.completed_at >= .*Europe\/Istanbul'\)/)[0];
    for (const [time, expected] of [['2026-09-01T00:30:00+03:00',true], ['2026-08-31T23:59:59+03:00',false], ['2026-09-30T23:59:59+03:00',true], ['2026-10-01T00:00:00+03:00',false]]) {
      const date = await client.query(`SELECT (${predicate}) AS included FROM (SELECT $3::timestamptz completed_at) ci`, ['2026-09-01','2026-09-30',time]);
      assert.equal(date.rows[0].included, expected);
    }
    console.log('PASS: complete reference coverage, company isolation, 3 target periods, 4 Istanbul boundary cases');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
