import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const { Pool } = pg
const containerName = `hr-axis-tref-proof-${process.pid}`
const password = `tref-${randomUUID()}`

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

async function waitForDatabase(pool) {
  let lastError
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError
}

async function applyRevision(pool, input) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT employee_id FROM ops.employee WHERE employee_id = $1 FOR UPDATE', [input.employeeId])
    const base = await client.query(
      `SELECT personnel_target_reference_id
       FROM ops.personnel_target_reference
       WHERE personnel_target_reference_id = $1 AND status = 'approved'
       FOR UPDATE`,
      [input.baseReferenceId],
    )
    if (base.rowCount !== 1) throw new Error('target_revision_stale_base')
    if (input.delay) await client.query('SELECT pg_sleep(0.25)')
    const updated = await client.query(
      `UPDATE ops.personnel_target_reference
       SET status = 'superseded'
       WHERE personnel_target_reference_id = $1 AND status = 'approved'
       RETURNING personnel_target_reference_id`,
      [input.baseReferenceId],
    )
    if (updated.rowCount !== 1) throw new Error('target_revision_chain_conflict')
    if (input.failAfterSupersede) throw new Error('injected_failure')
    const successor = await client.query(
      `INSERT INTO ops.personnel_target_reference (
         employee_id, period_start, period_end, target_value, target_type, status,
         supersedes_target_reference_id
       ) VALUES ($1, DATE '2026-07-01', DATE '2026-07-31', $2, 'monthly_sales_target', 'approved', $3)
       RETURNING personnel_target_reference_id`,
      [input.employeeId, input.targetValue, input.baseReferenceId],
    )
    await client.query('COMMIT')
    return successor.rows[0].personnel_target_reference_id
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function applyPilotTarget(pool, input) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT employee_id FROM ops.employee WHERE employee_id = $1 FOR UPDATE', [input.employeeId])
    const result = await client.query(
      `WITH active AS (
         SELECT source_request_id, company_id, region_id, store_id, target_value
         FROM ops.personnel_target_reference
         WHERE employee_id = $5 AND period_start = DATE '2026-07-01'
           AND period_end = DATE '2026-07-31' AND target_type = 'monthly_sales_target'
           AND status = 'approved' FOR UPDATE
       ), inserted AS (
         INSERT INTO ops.personnel_target_reference
           (source_request_id, company_id, region_id, store_id, employee_id, period_start,
            period_end, target_value, target_type, status)
         SELECT $1, $2, $3, $4, $5, DATE '2026-07-01', DATE '2026-07-31', $6,
                'monthly_sales_target', 'approved'
         WHERE NOT EXISTS (SELECT 1 FROM active)
         RETURNING 1
       )
       SELECT 'inserted' AS outcome FROM inserted
       UNION ALL
       SELECT CASE WHEN source_request_id = $1 AND company_id = $2 AND region_id = $3
                        AND store_id = $4 AND target_value = $6
                   THEN 'replayed' ELSE 'conflict' END
       FROM active LIMIT 1`,
      [input.sourceRequestId, input.companyId, input.regionId, input.storeId, input.employeeId, input.targetValue],
    )
    await client.query('COMMIT')
    return result.rows[0]?.outcome
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function proveActualRepository(containerPort) {
  const admin = new Pool({ connectionString: `postgres://postgres:${encodeURIComponent(password)}@127.0.0.1:${containerPort}/postgres` })
  await admin.query('CREATE DATABASE actual_repo_proof')
  await admin.end()
  const actualPool = new Pool({ connectionString: `postgres://postgres:${encodeURIComponent(password)}@127.0.0.1:${containerPort}/actual_repo_proof` })
  try {
    await actualPool.query(readFileSync(new URL('../../../db/schema.sql', import.meta.url), 'utf8'))
    const ids = Object.fromEntries(
      ['company', 'region', 'store', 'position', 'employee', 'approver'].map((key) => [key, randomUUID()]),
    )
    await actualPool.query(
      `INSERT INTO ops.company(company_id, company_code, company_name) VALUES ($1, 'TREF', 'TREF Proof')`,
      [ids.company],
    )
    await actualPool.query(
      `INSERT INTO ops.region(region_id, company_id, region_code, region_name) VALUES ($1, $2, 'R1', 'Region')`,
      [ids.region, ids.company],
    )
    await actualPool.query(
      `INSERT INTO ops.store(store_id, company_id, region_id, store_code, store_name, store_type)
       VALUES ($1, $2, $3, 'S1', 'Store', 'company')`,
      [ids.store, ids.company, ids.region],
    )
    await actualPool.query(
      `INSERT INTO ops.position(position_id, company_id, position_code, position_name)
       VALUES ($1, $2, 'SALES', 'Sales')`,
      [ids.position, ids.company],
    )
    await actualPool.query(
      `INSERT INTO ops.employee(employee_id, company_id, first_name, last_name, hire_date, employment_type)
       VALUES ($1, $2, 'Ada', 'Kaya', DATE '2026-01-01', 'full_time')`,
      [ids.employee, ids.company],
    )
    await actualPool.query(
      `INSERT INTO ops.employee_assignment_history
       (employee_id, store_id, region_id, position_id, start_date, is_primary_assignment, assignment_status)
       VALUES ($1, $2, $3, $4, DATE '2026-07-01', TRUE, 'active')`,
      [ids.employee, ids.store, ids.region, ids.position],
    )
    await actualPool.query(
      `INSERT INTO ops.user_account(user_id, username, email) VALUES ($1, 'approver', 'approver@example.test')`,
      [ids.approver],
    )
    await actualPool.query(
      `INSERT INTO ops.user_action_store_assignment(user_id, store_id) VALUES ($1, $2)`,
      [ids.approver, ids.store],
    )

    const databaseService = {
      query: (sql, params = []) => actualPool.query(sql, params),
      withTransaction: async (work) => {
        const client = await actualPool.connect()
        try {
          await client.query('BEGIN')
          const result = await work(client)
          await client.query('COMMIT')
          return result
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      },
    }
    const imported = await import('../dist/src/modules/store-ops/infrastructure/target-distribution.repository.js')
    const TargetDistributionRepository = imported.TargetDistributionRepository ?? imported.default?.TargetDistributionRepository
    const repository = new TargetDistributionRepository(databaseService)
    const insertRequest = async ({ baseReferenceIds = [], mode, targetValue }) => {
      const requestId = randomUUID()
      const allocation = [{ employeeId: ids.employee, assigneeLabel: 'Ada Kaya', targetValue }]
      await actualPool.query(
        `INSERT INTO ops.target_distribution_request (
           target_distribution_request_id, company_id, region_id, store_id, request_month,
           target_label, total_target_value, allocation_count, allocation_json,
           approval_evidence_json, submitted_by_user_id, request_reason
         ) VALUES ($1, $2, $3, $4, DATE '2026-07-01', 'TREF proof', $5, 1, $6, $7, $8, $9)`,
        [requestId, ids.company, ids.region, ids.store, targetValue, JSON.stringify(allocation), JSON.stringify({
          targetRevision: { mode, baseReferenceIds, removedEmployeeIds: [], reasonPresent: mode === 'revision' },
        }), ids.approver, mode === 'revision' ? 'revision proof' : null],
      )
      return requestId
    }
    const initialRequest = await insertRequest({ mode: 'initial', targetValue: 100 })
    await repository.approveRequest({ requestId: initialRequest, approverUserId: ids.approver })
    const base = (await actualPool.query(
      `SELECT personnel_target_reference_id FROM ops.personnel_target_reference
       WHERE employee_id = $1 AND status = 'approved'`, [ids.employee],
    )).rows[0].personnel_target_reference_id
    await actualPool.query(`CREATE TABLE rpt.proof_snapshot (
      snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      personnel_target_reference_id uuid NOT NULL REFERENCES ops.personnel_target_reference(personnel_target_reference_id)
    )`)
    await actualPool.query('INSERT INTO rpt.proof_snapshot(personnel_target_reference_id) VALUES ($1)', [base])
    const requestA = await insertRequest({ mode: 'revision', baseReferenceIds: [base], targetValue: 110 })
    const requestB = await insertRequest({ mode: 'revision', baseReferenceIds: [base], targetValue: 110 })
    const results = await Promise.allSettled([
      repository.approveRequest({ requestId: requestA, approverUserId: ids.approver }),
      repository.approveRequest({ requestId: requestB, approverUserId: ids.approver }),
    ])
    if (results.filter((result) => result.status === 'fulfilled').length !== 1) {
      throw new Error('actual repository concurrency expected one winner')
    }
    const active = await actualPool.query(
      `SELECT supersedes_target_reference_id FROM ops.personnel_target_reference
       WHERE employee_id = $1 AND status = 'approved'`, [ids.employee],
    )
    if (active.rows[0]?.supersedes_target_reference_id !== base) {
      throw new Error('actual repository successor did not link exact predecessor')
    }
    const snapshot = await actualPool.query('SELECT personnel_target_reference_id FROM rpt.proof_snapshot')
    if (snapshot.rows[0]?.personnel_target_reference_id !== base) {
      throw new Error('actual repository changed snapshot identity')
    }
    return 'initial_revision_one_winner'
  } finally {
    await actualPool.end()
  }
}

let pool
try {
  docker('run', '--detach', '--rm', '--name', containerName, '-e', `POSTGRES_PASSWORD=${password}`, '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = docker('port', containerName, '5432/tcp').split(':').at(-1)
  pool = new Pool({ connectionString: `postgres://postgres:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres` })
  await waitForDatabase(pool)
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA ops;
    CREATE SCHEMA rpt;
    CREATE TABLE ops.employee (employee_id uuid PRIMARY KEY);
    CREATE TABLE ops.personnel_target_reference (
      personnel_target_reference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_request_id uuid,
      company_id uuid,
      region_id uuid,
      store_id uuid,
      employee_id uuid NOT NULL REFERENCES ops.employee(employee_id),
      period_start date NOT NULL,
      period_end date NOT NULL,
      target_value numeric NOT NULL,
      target_type text NOT NULL,
      status text NOT NULL,
      supersedes_target_reference_id uuid REFERENCES ops.personnel_target_reference(personnel_target_reference_id)
    );
    CREATE UNIQUE INDEX target_active_unique
      ON ops.personnel_target_reference(employee_id, period_start, period_end, target_type)
      WHERE status = 'approved';
    CREATE TABLE rpt.proof_snapshot (
      snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      personnel_target_reference_id uuid NOT NULL REFERENCES ops.personnel_target_reference(personnel_target_reference_id)
    );
  `)

  const employeeA = randomUUID()
  const employeeB = randomUUID()
  const employeeC = randomUUID()
  const employeeD = randomUUID()
  const employeeE = randomUUID()
  await pool.query('INSERT INTO ops.employee(employee_id) VALUES ($1), ($2), ($3), ($4), ($5)', [
    employeeA, employeeB, employeeC, employeeD, employeeE,
  ])
  const baseA = (await pool.query(
    `INSERT INTO ops.personnel_target_reference
      (employee_id, period_start, period_end, target_value, target_type, status)
     VALUES ($1, DATE '2026-07-01', DATE '2026-07-31', 100, 'monthly_sales_target', 'approved')
     RETURNING personnel_target_reference_id`,
    [employeeA],
  )).rows[0].personnel_target_reference_id
  await pool.query('INSERT INTO rpt.proof_snapshot(personnel_target_reference_id) VALUES ($1)', [baseA])

  const concurrent = await Promise.allSettled([
    applyRevision(pool, { employeeId: employeeA, baseReferenceId: baseA, targetValue: 110, delay: true }),
    applyRevision(pool, { employeeId: employeeA, baseReferenceId: baseA, targetValue: 120 }),
  ])
  if (concurrent.filter((result) => result.status === 'fulfilled').length !== 1) {
    throw new Error('concurrency proof expected exactly one committed successor')
  }
  if (!concurrent.some((result) => result.status === 'rejected' && result.reason?.message === 'target_revision_stale_base')) {
    throw new Error('concurrency proof did not reject the stale base')
  }
  const snapshot = await pool.query('SELECT personnel_target_reference_id FROM rpt.proof_snapshot')
  if (snapshot.rows[0]?.personnel_target_reference_id !== baseA) {
    throw new Error('snapshot reference identity changed')
  }

  const baseB = (await pool.query(
    `INSERT INTO ops.personnel_target_reference
      (employee_id, period_start, period_end, target_value, target_type, status)
     VALUES ($1, DATE '2026-07-01', DATE '2026-07-31', 100, 'monthly_sales_target', 'approved')
     RETURNING personnel_target_reference_id`,
    [employeeB],
  )).rows[0].personnel_target_reference_id
  await applyRevision(pool, {
    employeeId: employeeB,
    baseReferenceId: baseB,
    targetValue: 130,
    failAfterSupersede: true,
  }).then(
    () => { throw new Error('rollback proof unexpectedly committed') },
    (error) => { if (error.message !== 'injected_failure') throw error },
  )
  const rollbackState = await pool.query(
    `SELECT status FROM ops.personnel_target_reference WHERE personnel_target_reference_id = $1`,
    [baseB],
  )
  if (rollbackState.rows[0]?.status !== 'approved') throw new Error('rollback did not restore predecessor')

  const baseC = (await pool.query(
    `INSERT INTO ops.personnel_target_reference
      (employee_id, period_start, period_end, target_value, target_type, status)
     VALUES ($1, DATE '2026-07-01', DATE '2026-07-31', 100, 'monthly_sales_target', 'approved')
     RETURNING personnel_target_reference_id`,
    [employeeC],
  )).rows[0].personnel_target_reference_id
  await pool.query(
    `WITH locked_employee AS (
       SELECT employee_id FROM ops.employee WHERE employee_id = $1 FOR UPDATE
     )
     UPDATE ops.personnel_target_reference reference SET status = 'superseded'
     FROM locked_employee
     WHERE reference.personnel_target_reference_id = $2 AND reference.status = 'approved'`,
    [employeeC, baseC],
  )
  const removed = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ops.personnel_target_reference
     WHERE employee_id = $1 AND status = 'approved'`,
    [employeeC],
  )
  if (removed.rows[0]?.count !== 0) throw new Error('terminal removal left an active successor')

  const newcomer = await pool.query(
    `INSERT INTO ops.personnel_target_reference
      (employee_id, period_start, period_end, target_value, target_type, status, supersedes_target_reference_id)
     VALUES ($1, DATE '2026-07-01', DATE '2026-07-31', 100, 'monthly_sales_target', 'approved', NULL)
     RETURNING supersedes_target_reference_id`,
    [employeeD],
  )
  if (newcomer.rows[0]?.supersedes_target_reference_id !== null) throw new Error('new root has a predecessor')

  const pilotInput = {
    sourceRequestId: randomUUID(), companyId: randomUUID(), regionId: randomUUID(),
    storeId: randomUUID(), employeeId: employeeE, targetValue: 100,
  }
  if (await applyPilotTarget(pool, pilotInput) !== 'inserted') throw new Error('pilot initial insert failed')
  if (await applyPilotTarget(pool, pilotInput) !== 'replayed') throw new Error('pilot exact replay failed')
  if (await applyPilotTarget(pool, { ...pilotInput, targetValue: 101 }) !== 'conflict') {
    throw new Error('pilot replacement did not conflict')
  }

  const actualRepository = await proveActualRepository(port)
  console.log(JSON.stringify({
    actualRepository,
    concurrency: 'one_winner', newcomer: 'root', pilot: 'insert_replay_conflict',
    removal: 'terminal', rollback: 'atomic', snapshot: 'anchored', status: 'ok',
  }))
} finally {
  await pool?.end().catch(() => undefined)
  try { docker('rm', '--force', containerName) } catch {}
}
