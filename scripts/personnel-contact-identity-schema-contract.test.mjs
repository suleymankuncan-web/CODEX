import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const schema = readFileSync('db/schema.sql', 'utf8')
const migration = readFileSync(
  'db/migrations/072_employee_contact_identity_display_v1.sql',
  'utf8',
)

test('employee contact identity keeps raw national identity out of persistence', () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /national_id_last4 TEXT/i)
    assert.match(sql, /phone_number TEXT/i)
    assert.match(sql, /employee_national_id_last4_format_check/i)
    assert.match(sql, /employee_phone_number_format_check/i)
  }

  assert.doesNotMatch(schema, /national_id_raw/i)
  assert.match(migration, /Raw national identity is never stored/i)
})
