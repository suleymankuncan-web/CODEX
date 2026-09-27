// Targeted, rollback-only verification. Never accepts the production database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { DatabaseService } = require('../dist/src/shared/database/database.service');
const { ChecklistVisitPlanRepository } = require('../dist/src/modules/store-ops/infrastructure/checklist-visit-plan.repository');
const { ChecklistVisitPlanService } = require('../dist/src/modules/store-ops/application/checklist-visit-plan.service');

async function main() {
  assert.equal(process.env.POSTGRES_DB, 'hr_axis_preview');
  assert.equal(process.env.PREVIEW_ROLLBACK_SMOKE, 'assigned-plan');
  const client = new Client({ host: 'postgres', database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await client.connect();
  const company = randomUUID();
  const actorUserId = randomUUID();
  const regions = [randomUUID(), randomUUID()].sort();
  const stores = [randomUUID(), randomUUID()];
  const outsider = randomUUID();
  try {
    await client.query('BEGIN');
    const database = new DatabaseService({
      query: (sql, params) => client.query(sql, params),
      connect: async () => ({
        query: async (sql, params) => {
          if (sql === 'BEGIN') return client.query('SAVEPOINT smoke_operation');
          if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT smoke_operation');
          if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT smoke_operation');
          return client.query(sql, params);
        },
        release: () => {},
      }),
    });
    const service = new ChecklistVisitPlanService(new ChecklistVisitPlanRepository(database));
    await client.query(`INSERT INTO ops.company (company_id, company_code, company_name) VALUES ($1,$2,'Rollback fixture')`, [company, `ROLLBACK_${company.slice(0, 8)}`]);
    for (const [index, region] of regions.entries()) {
      await client.query(`INSERT INTO ops.region (region_id,company_id,region_code,region_name) VALUES ($1,$2,$3,'Legacy group')`, [region, company, `ROLLBACK_R${index}`]);
      await client.query(`INSERT INTO ops.store (store_id,company_id,region_id,store_code,store_name,store_type) VALUES ($1,$2,$3,$4,'Assigned fixture','company')`, [stores[index], company, region, `ROLLBACK_${stores[index].slice(0, 8)}`]);
    }
    await client.query(`INSERT INTO ops.store (store_id,company_id,region_id,store_code,store_name,store_type) VALUES ($1,$2,$3,$4,'Unassigned fixture','company')`, [outsider, company, regions[1], `ROLLBACK_${outsider.slice(0, 8)}`]);
    await client.query(`INSERT INTO ops.user_account (user_id,username,email) VALUES ($1,$2,$3)`, [actorUserId, `rollback-${actorUserId}`, `rollback-${actorUserId}@example.invalid`]);
    await client.query(`INSERT INTO ops.user_action_store_assignment (user_id,store_id) SELECT $1,value FROM unnest($2::uuid[]) value`, [actorUserId, stores]);
    const actor = { actorUserId, actorRoleCodes: ['REGION_MANAGER'], actorReadScope: { companyIds: [], regionIds: [], storeIds: [] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: stores } } };
    const weekStart = '2026-09-21';
    const empty = await service.getWeeklyPlan({ ...actor, weekStart });
    assert.equal(empty.regionId, null);
    assert.equal(empty.revision, 0);
    const body = { ...actor, weekStart, expectedRevision: 0, expectedScopeRevision: empty.scopeRevision, idempotencyKey: randomUUID(),
      items: stores.map((storeId, displayOrder) => ({ storeId, displayOrder, plannedDate: '2026-09-22' })) };
    const saved = await service.saveWeeklyPlan(body);
    assert.equal(saved.items.length, 2);
    assert.equal(saved.revision, 2);
    assert.equal((await service.saveWeeklyPlan(body)).revision, 2);
    await assert.rejects(service.saveWeeklyPlan({ ...body, idempotencyKey: randomUUID() }), /revision is stale/);
    await assert.rejects(service.saveWeeklyPlan({ ...body, expectedScopeRevision: saved.scopeRevision, idempotencyKey: randomUUID(),
      items: [{ storeId: outsider, displayOrder: 0, plannedDate: '2026-09-22' }] }), /outside the direct active portfolio/);
    const candidates = await service.listCandidates(actor);
    assert.equal(candidates.items.length, 2);
    assert.ok(!candidates.items.some(item => item.storeId === outsider));
    const history = await service.listPeriod({ ...actor, period: '2026-09' });
    assert.equal(history.items.length, 2);
    assert.equal(history.items.reduce((sum, row) => sum + row.planItems.length, 0), 2);
    // Simulate an existing legacy plan that also contains another manager's
    // store. The protective guard must roll back an earlier partition's update.
    await client.query(`INSERT INTO ops.region_weekly_visit_plan_item
      (revision_id,plan_id,region_id,week_start_date,store_id,planned_date,display_order)
      SELECT revision_id,plan_id,region_id,week_start_date,$1,'2026-09-23',9
      FROM ops.region_weekly_visit_plan_revision WHERE region_id=$2 AND is_current`, [outsider, regions[1]]);
    const before = await service.getWeeklyPlan({ ...actor, weekStart });
    await assert.rejects(service.saveWeeklyPlan({ ...body, expectedScopeRevision: before.scopeRevision, idempotencyKey: randomUUID(), items: [] }), /outside the direct active portfolio/);
    const after = await service.getWeeklyPlan({ ...actor, weekStart });
    assert.equal(after.scopeRevision, before.scopeRevision);
    assert.deepEqual(after.items, before.items);
    console.log(JSON.stringify({ multiGroupSave: true, idempotentReplay: true, staleConflict: true, directScope: true,
      periodHistory: true, partialWriteRollback: true, productionTouched: false }));
  } finally {
    await client.query('ROLLBACK');
    const leftover = await client.query('SELECT count(*)::int n FROM ops.company WHERE company_id=$1', [company]);
    assert.equal(leftover.rows[0].n, 0);
    await client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
