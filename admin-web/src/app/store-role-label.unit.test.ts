import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from '../features/auth/api'
import { translate } from '../features/localization/dictionary'
import { getStoreRoleLabel, getStoreRoleLabels } from './store-role-label'

const t = (key: Parameters<typeof translate>[1]) => translate('tr', key)
function session(roleCodes: string[]): AuthSessionSummary {
  return { user: { roleCodes } } as AuthSessionSummary
}

describe('Store account role labels', () => {
  it.each([
    ['SUPER_ADMIN', 'Admin'],
    ['HR_ADMIN', 'İK Admin'],
    ['REPORT_VIEWER', 'Rapor Görüntüleyici'],
    ['REGION_MANAGER', 'Bölge Müdürü'],
    ['STORE_MANAGER', 'Mağaza Müdürü'],
    ['STORE_PERSONNEL', 'Mağaza Personeli'],
    ['VISUAL_MERCHANDISER', 'Görsel Mağazacılık'],
  ])('labels the actual %s role without a presentation persona', (role, expected) => {
    expect(getStoreRoleLabel(session([role]), t)).toBe(expected)
  })

  it('uses stable presentation precedence while retaining all app roles for settings', () => {
    const auth = session(['STORE_PERSONNEL', 'REGION_MANAGER', 'SUPER_ADMIN', 'REGION_MANAGER', 'offline_access'])
    expect(getStoreRoleLabel(auth, t)).toBe('Admin')
    expect(getStoreRoleLabels(auth, t)).toEqual(['Admin', 'Bölge Müdürü', 'Mağaza Personeli'])
    expect(getStoreRoleLabel(session(['STORE_MANAGER', 'REPORT_VIEWER']), t)).toBe('Rapor Görüntüleyici')
    expect(getStoreRoleLabel(session(['HR_ADMIN', 'REGION_MANAGER']), t)).toBe('Bölge Müdürü')
    expect(getStoreRoleLabel(session(['STORE_PERSONNEL', 'STORE_MANAGER']), t)).toBe('Mağaza Müdürü')
  })

  it('keeps missing and provider-only roles neutral and localizes known roles', () => {
    expect(getStoreRoleLabel(null, t)).toBe('Kullanıcı')
    expect(getStoreRoleLabel(session(['offline_access', 'uma_authorization', 'default-roles-store-ops']), t)).toBe('Kullanıcı')
    expect(getStoreRoleLabel(session(['REPORT_VIEWER']), key => translate('en', key))).toBe('Report viewer')
  })
})
