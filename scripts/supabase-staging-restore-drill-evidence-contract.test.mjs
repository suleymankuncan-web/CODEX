import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const evidencePath = 'docs/evidence/readiness/2026-05-18-supabase-staging-restore-drill.md'
const runbookPath = 'docs/plans/backup-restore-drill-runbook-v1.md'
const checklistPath = 'docs/plans/production-environment-readiness-checklist.md'
const readinessPlanPath = 'docs/superpowers/plans/2026-05-18-readiness-progress.md'

const evidence = readText(evidencePath)
const runbook = readText(runbookPath)
const checklist = readText(checklistPath)
const readinessPlan = readText(readinessPlanPath)

test('Supabase staging restore evidence records current No-Go without secrets', () => {
  for (const phrase of [
    '# Supabase Staging Restore Drill Evidence - 2026-05-18',
    'No-Go for broad production backup/restore readiness.',
    'Source platform: Supabase Postgres.',
    'Source project label: `hr-axis-staging`.',
    'Production database touched: no.',
    'Restore command executed: no.',
    'Destructive command executed: no.',
    'Raw database URLs, passwords, access tokens, customer data, and personnel samples captured: no.',
  ]) {
    requireText(evidence, phrase)
  }

  assert.doesNotMatch(evidence, /\bpostgres(?:ql)?:\/\/\S+/i)
  assert.doesNotMatch(evidence, /\b(password|pwd)=\S+/i)
  assert.doesNotMatch(evidence, /\b(service_role|SUPABASE_ACCESS_TOKEN|DATABASE_URL)=/i)
})

test('Supabase staging restore evidence captures provider-specific blockers', () => {
  for (const phrase of [
    'Daily managed backups exist',
    'PITR is a separate add-on',
    'physical backups and PITR do not provide a downloadable legacy logical `backup.gz`',
    'Restore to the same Supabase project creates downtime',
    'Restore to a new Supabase project can prove managed restore behavior',
    'Storage objects, Edge Functions, auth settings/API keys, Realtime settings',
  ]) {
    requireText(evidence, phrase)
  }
})

test('Supabase restore runbook keeps current provider caveats and RPO RTO fields', () => {
  for (const phrase of [
    'Supabase Managed Backup Notes',
    'Supabase Staging Drill Modes',
    'Mode A: Logical Dump Into Disposable PostgreSQL Target',
    'Mode B: Supabase Restore To New Project',
    'RPO/RTO Fields',
    'backup_capability=daily|pitr|manual-logical-dump|unknown',
    'latest_backup_or_recovery_point_utc=YYYY-MM-DDTHH:mm:ssZ|unknown',
    'smoke_query_result=success|failed|not-run',
  ]) {
    requireText(runbook, phrase)
  }
})

test('Production checklist and readiness plan expose the Supabase restore blocker', () => {
  for (const phrase of [
    'Supabase plan backup capability, PITR availability, and latest backup/recovery point',
    'Supabase staging restore drill evidence exists before broad production Go',
    'Restore-to-new-project cost and disposable-target owner',
  ]) {
    requireText(checklist, phrase)
  }

  requireText(readinessPlan, 'Backup/Restore Live Drill')
  requireText(readinessPlan, evidencePath)
  requireText(readinessPlan, 'No-Go for broad production')
})
