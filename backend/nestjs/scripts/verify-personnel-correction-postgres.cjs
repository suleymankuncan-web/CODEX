// Disposable database only. Run against an empty database named correction_test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('reflect-metadata');
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { DatabaseService } = require('../src/shared/database/database.service');
const { PersonnelCorrectionRepository } = require('../src/modules/store-ops/infrastructure/personnel-correction.repository');

async function main() {
  const url = new URL(process.env.CORRECTION_TEST_DATABASE_URL);
  assert.equal(url.pathname, '/correction_test', 'Only the disposable correction_test database is allowed');
  const pool = new Pool({ connectionString: url.toString() });
  try {
    assert.equal((await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='ops'")).rows[0].n, 0);
    const root = path.resolve(__dirname, '../../..');
    await pool.query(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
    // Migration must also be safe after the canonical schema has created the table.
    await pool.query(fs.readFileSync(path.join(root, 'db/migrations/077_personnel_correction_requests_v1.sql'), 'utf8'));
    const company = (await pool.query("INSERT INTO ops.company(company_code,company_name) VALUES ('TEST','Test') RETURNING company_id")).rows[0].company_id;
    const otherCompany = (await pool.query("INSERT INTO ops.company(company_code,company_name) VALUES ('OTHER','Other') RETURNING company_id")).rows[0].company_id;
    const region = (await pool.query("INSERT INTO ops.region(company_id,region_code,region_name) VALUES ($1,'R','Test') RETURNING region_id", [company])).rows[0].region_id;
    const store = (await pool.query("INSERT INTO ops.store(company_id,region_id,store_code,store_name,store_type) VALUES ($1,$2,'S','Test','company') RETURNING store_id", [company, region])).rows[0].store_id;
    const position = (await pool.query("INSERT INTO ops.position(company_id,position_code,position_name) VALUES ($1,'SALES','Sales') RETURNING position_id", [company])).rows[0].position_id;
    const otherPosition = (await pool.query("INSERT INTO ops.position(company_id,position_code,position_name) VALUES ($1,'SALES','Other') RETURNING position_id", [otherCompany])).rows[0].position_id;
    const employee = (await pool.query("INSERT INTO ops.employee(company_id,external_employee_ref,first_name,last_name,hire_date,employment_type) VALUES ($1,'SALE-1','Original','Person','2026-09-07','full_time') RETURNING employee_id", [company])).rows[0].employee_id;
    await pool.query("INSERT INTO ops.employee_assignment_history(employee_id,store_id,region_id,position_id,start_date) VALUES ($1,$2,$3,$4,'2026-09-07')", [employee, store, region, position]);
    const user = (await pool.query("INSERT INTO ops.user_account(username,email) VALUES ('test','test@example.invalid') RETURNING user_id")).rows[0].user_id;
    const scope = { companyIds: [company], regionIds: [region], storeIds: [store] };
    const manager = { userId: user, roleCodes: ['STORE_MANAGER'], scope, actionScope: { assignedStoreIds: [store] } };
    const hr = { ...manager, roleCodes: ['HR_ADMIN'] };
    const repository = new PersonnelCorrectionRepository(new DatabaseService(pool));
    const input = async (name) => {
      const current = await repository.getPersonnel(manager, employee, store);
      return { employeeId: employee, storeId: store, expectedRevision: current.revision, proposed: { ...current.values, firstName: name }, reason: 'Verified correction' };
    };
    const request = await input('Corrected');
    const submissions = await Promise.allSettled([repository.submit(manager, request), repository.submit(manager, request)]);
    assert.equal(submissions.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(submissions.find((r) => r.status === 'rejected').reason.getStatus(), 409);
    const requestId = submissions.find((r) => r.status === 'fulfilled').value.request_id;
    assert.equal((await pool.query('SELECT first_name FROM ops.employee WHERE employee_id=$1', [employee])).rows[0].first_name, 'Original');
    await assert.rejects(repository.review({ ...hr, scope: { ...scope, companyIds: [otherCompany] } }, requestId, { decision: 'approve', note: 'Test' }), (e) => e.getStatus() === 404);
    const approvals = await Promise.allSettled([1, 2].map(() => repository.review(hr, requestId, { decision: 'approve', note: 'Checked' })));
    assert.equal(approvals.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(approvals.find((r) => r.status === 'rejected').reason.getStatus(), 409);
    assert.equal((await pool.query('SELECT first_name, external_employee_ref FROM ops.employee WHERE employee_id=$1', [employee])).rows[0].first_name, 'Corrected');
    assert.equal((await pool.query('SELECT count(*)::int n FROM audit.event_log')).rows[0].n, 2);
    const stale = await repository.submit(manager, await input('Stale'));
    await pool.query('UPDATE ops.employee_assignment_history SET updated_at=clock_timestamp() WHERE employee_id=$1', [employee]);
    await assert.rejects(repository.review(hr, stale.request_id, { decision: 'approve', note: 'Test' }), (e) => e.getStatus() === 409);
    await repository.review(hr, stale.request_id, { decision: 'reject', note: 'Changed assignment' });
    const invalid = await input('Invalid'); invalid.proposed.positionId = otherPosition;
    await assert.rejects(repository.submit(manager, invalid), (e) => e.getStatus() === 400);
    const rollback = await repository.submit(manager, await input('Must rollback'));
    await pool.query("CREATE FUNCTION audit.reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$; CREATE TRIGGER reject_test_event BEFORE INSERT ON audit.event_log FOR EACH ROW EXECUTE FUNCTION audit.reject_test_event()");
    await assert.rejects(repository.review(hr, rollback.request_id, { decision: 'approve', note: 'Test' }), /test audit failure/);
    assert.equal((await pool.query('SELECT first_name FROM ops.employee WHERE employee_id=$1', [employee])).rows[0].first_name, 'Corrected');
    assert.equal((await pool.query('SELECT request_status FROM ops.personnel_correction_request WHERE request_id=$1', [rollback.request_id])).rows[0].request_status, 'pending_hr_approval');
    assert.equal((await pool.query('SELECT external_employee_ref FROM ops.employee WHERE employee_id=$1', [employee])).rows[0].external_employee_ref, 'SALE-1');
    console.log(JSON.stringify({ passed: true, concurrentSubmit: true, concurrentReview: true, staleAssignment: true, companyPositionIsolation: true, auditFailureRollback: true, stableSalesCode: true }));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
