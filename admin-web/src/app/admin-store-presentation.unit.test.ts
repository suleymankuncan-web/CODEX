import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from '../features/auth/api'
import { usesStoreReportViewerView } from '../features/auth/authorization'
import { getRoleAwareStoreNavigation, getStoreRouteDefinitions, isStoreRouteAllowed, resolveStorePersona } from './store-route-registry'
import { resolveStoreApprovalsPersona } from '../pages/store-approvals-model'

function session(roleCodes: string[]): AuthSessionSummary {
  return { authenticated: true, user: {
    roleCodes, scope: { companyIds: ['company-1'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['company-1'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [], assignedStoreTypes: [] },
  } } as unknown as AuthSessionSummary
}

const parkedRouteIds = new Set(['competitions', 'incentives'])

describe('Admin uses the read-only company Store portfolio', () => {
  it('matches Report Viewer navigation and route access outside parked surfaces', () => {
    const admin = session(['SUPER_ADMIN'])
    const viewer = session(['REPORT_VIEWER'])
    const activeNav = (auth: AuthSessionSummary) => getRoleAwareStoreNavigation(auth)
      .filter((item) => !parkedRouteIds.has(item.id))
    expect(activeNav(admin)).toEqual(activeNav(viewer))
    for (const route of getStoreRouteDefinitions().filter((item) => !parkedRouteIds.has(item.id))) {
      expect(isStoreRouteAllowed(route, admin), route.path).toBe(isStoreRouteAllowed(route, viewer))
    }
    expect(admin.user.roleCodes).toEqual(['SUPER_ADMIN'])
  })

  it.each([['SUPER_ADMIN'], ['REPORT_VIEWER'], ['SUPER_ADMIN', 'REGION_MANAGER'], ['SUPER_ADMIN', 'STORE_MANAGER']])(
    'resolves %j to the common Store and approvals presentation', (...roles) => {
      const auth = session(roles)
      expect(resolveStorePersona(auth)).toBe('admin')
      expect(usesStoreReportViewerView(auth)).toBe(true)
      expect(resolveStoreApprovalsPersona(auth)).toBe('reportViewer')
    },
  )

  it('preserves operational personas and denies unrelated admin roles', () => {
    expect(resolveStorePersona(session(['STORE_MANAGER']))).toBe('storeManager')
    expect(resolveStorePersona(session(['REGION_MANAGER']))).toBe('regionManager')
    expect(usesStoreReportViewerView(session(['HR_ADMIN']))).toBe(false)
    expect(usesStoreReportViewerView(null)).toBe(false)
  })
})
