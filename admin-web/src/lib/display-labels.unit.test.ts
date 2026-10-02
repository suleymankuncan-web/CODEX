import { describe, expect, it } from 'vitest'
import { resolveUserDisplayLabel } from './display-labels'

describe('person display names', () => {
  it('shows a saved full name without exposing the login identifier', () => {
    expect(resolveUserDisplayLabel({ firstName: ' Onur ', lastName: ' Kaytan ', username: 'onurkaytan' }, 'Kullanıcı')).toBe('Onur Kaytan')
  })
  it('uses the employee/session display name when available', () => {
    expect(resolveUserDisplayLabel({ displayName: 'Onur Kaytan', firstName: 'Old', lastName: 'Name', username: 'onurkaytan' }, 'Kullanıcı')).toBe('Onur Kaytan')
  })
  it.each([undefined, { displayName: '', username: 'onurkaytan' }, { email: 'onur@example.test' }, { userId: 'opaque-id' }])('does not invent a name from an identifier: %j', (user) => {
    expect(resolveUserDisplayLabel(user, 'Kullanıcı')).toBe('Kullanıcı')
  })
  it('does not expose usernames retained in an older browser session', () => {
    expect(resolveUserDisplayLabel({ displayName: 'onurkaytan', username: 'onurkaytan' }, 'Kullanıcı')).toBe('Kullanıcı')
    expect(resolveUserDisplayLabel({ displayName: 'onurkaytan', username: 'onurkaytan', firstName: 'Onur', lastName: 'Kaytan' }, 'Kullanıcı')).toBe('Onur Kaytan')
  })
  it('accepts a partial saved name and skips whitespace-only display names', () => {
    expect(resolveUserDisplayLabel({ displayName: '  ', firstName: 'Onur', lastName: null }, 'Kullanıcı')).toBe('Onur')
  })
})
