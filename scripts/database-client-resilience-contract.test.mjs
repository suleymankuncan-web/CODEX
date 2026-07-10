import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

const spec = readText('docs/plans/database-client-resilience-spec-v1.md')

test('database client resilience spec keeps the bounded implementation contract', () => {
  for (const expected of [
    'DB_POOL_MAX',
    'DB_CONNECTION_TIMEOUT_MS',
    'DB_IDLE_TIMEOUT_MS',
    'DB_QUERY_TIMEOUT_MS',
    'DB_STATEMENT_TIMEOUT_MS',
    'DAILY_CLOSURE_POLL_MINUTES',
    'DB_SSL_MODE',
    'DB_SSL_CA',
    'connectionTimeoutMillis',
    'idleTimeoutMillis',
    'query_timeout',
    'statement_timeout',
  ]) {
    assert.match(spec, new RegExp(expected))
  }
})

test('database client resilience spec preserves honest provider and TLS gates', () => {
  for (const expected of [
    'DG-3 is unavailable',
    'encrypted-unverified',
    'encrypted-verified',
    'rejectUnauthorized: true',
    'broad-production',
    'Provider staging smoke is skipped',
  ]) {
    assert.match(spec, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(spec, /must not activate or claim provider-\s*verified TLS/)
})

test('database client resilience spec forbids secrets and unrelated runtime changes', () => {
  for (const expected of [
    'invent, download, commit, log, or echo CA material',
    'modify `DATABASE_URL`, database schema, migrations, queries, API commands, or',
    'connection string, host, username, password, CA content',
    'Do not disable production TLS',
  ]) {
    assert.match(spec, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
