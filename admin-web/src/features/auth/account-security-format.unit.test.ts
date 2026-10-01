import { describe, expect, it } from 'vitest'
import { accountTimestamp, linkState } from './account-security-format'
import { buildAuthAccessWorkbenchModel } from './auth-access-workbench-model'

describe('honest account security presentation', () => {
  it('formats observed dates in Istanbul and never substitutes a missing date', () => {
    expect(accountTimestamp('2026-09-30T19:30:00Z', false)).toContain('22:30')
    expect(accountTimestamp(null, false)).toBe('Henüz kayıt yok')
    expect(accountTimestamp('invalid', true)).toBe('No record yet')
  })
  it('keeps email acceptance, uncertainty, expiry and password change separate in both languages', () => {
    expect(linkState('sent', false)).toBe('Bağlantı gönderildi')
    expect(linkState('unconfirmed', false)).toBe('Gönderim doğrulanamadı')
    expect(linkState('completed', true)).toBe('Password change verified')
    expect(linkState('expired', true)).toBe('Tracking expired')
  })
  it('does not use creation or login dates as foreground activity', () => {
    const user = { userId: 'synthetic', employeeId: null, username: 'synthetic', firstName: null, lastName: null,
      email: 'synthetic@example.invalid', authProvider: 'oidc', providerSubject: 'subject', isActive: true,
      lastLoginAt: '2026-10-01T08:00:00Z', createdAt: '2026-09-01T08:00:00Z' }
    const model = buildAuthAccessWorkbenchModel({ users: [user], roleAssignments: [], actionStoreAssignments: [] })
    expect(model.users[0]?.lastActivityLabel).toBe('')
    const verified = buildAuthAccessWorkbenchModel({ users: [{ ...user, lastActiveAt: '2026-10-01T08:05:00Z' }], roleAssignments: [], actionStoreAssignments: [] })
    expect(verified.users[0]?.lastActivityLabel).toBe('2026-10-01T08:05:00Z')
  })
})
