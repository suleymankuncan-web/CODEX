import { describe, expect, it } from 'vitest'
import type { AuthSessionSummary } from '../features/auth/api'
import { adminNavDefinitions, isNavAllowed } from './admin-navigation'
import { resolveLandingPath } from './shell-state'

function session(roleCodes: string[]) {
  return {
    authenticated: true,
    user: {
      roleCodes,
    },
  } as unknown as AuthSessionSummary
}

describe('Report Viewer admin boundary', () => {
  it('lands a Report Viewer-only session in the Store shell', () => {
    expect(resolveLandingPath(session(['REPORT_VIEWER']), true)).toBe('/store/home')
  })

  it('does not expose any Admin navigation item to Report Viewer', () => {
    const visibleItems = adminNavDefinitions.filter((item) =>
      isNavAllowed(item, session(['REPORT_VIEWER'])),
    )

    expect(visibleItems).toEqual([])
    expect(adminNavDefinitions.every((item) => !item.roles?.includes('REPORT_VIEWER'))).toBe(true)
  })

  it('preserves Admin access granted by a separate Admin role', () => {
    const mixedSession = session(['REPORT_VIEWER', 'SUPER_ADMIN'])

    expect(resolveLandingPath(mixedSession, true)).toBe('/admin/integrations')
    expect(adminNavDefinitions.filter((item) => isNavAllowed(item, mixedSession)).length)
      .toBeGreaterThan(0)
  })
})
