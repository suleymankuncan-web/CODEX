import assert from 'node:assert/strict'
import { test } from 'vitest'
import { inboxTabFromMail, reportPeriodFromMail } from './workflow-mail-link'
test('report mail opens its completed month and rejects malformed, repeated or future periods', () => {
  assert.equal(reportPeriodFromMail('?period=2026-09', '2026-10'), '2026-09')
  for (const search of ['?period=2026-11', '?period=2026-00', '?period=2026-09&period=2026-08', '?period=evil', '']) {
    assert.equal(reportPeriodFromMail(search, '2026-10'), '2026-10')
  }
})
test('HR link opens only an existing workforce tab with current access', () => {
  assert.equal(inboxTabFromMail('?tab=seller-code', true), 'seller-code')
  assert.equal(inboxTabFromMail('?tab=offboarding', true), 'offboarding')
  assert.equal(inboxTabFromMail('?tab=seller-code', false), 'workflow')
  assert.equal(inboxTabFromMail('?tab=seller-code&tab=offboarding', true), 'workflow')
  assert.equal(inboxTabFromMail('?tab=evil', true), 'workflow')
})
