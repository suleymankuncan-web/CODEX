import { describe, expect, it } from 'vitest'
import { adminNavDefinitions, groupAdminNavigation } from './admin-navigation'

describe('admin navigation grouping', () => {
  it('keeps daily pages ordered before expandable secondary pages', () => {
    const grouped = groupAdminNavigation(adminNavDefinitions)

    expect(grouped.primary.map((item) => item.id)).toEqual([
      'inbox',
      'masterData',
      'auth',
      'kpiConfig',
      'checklists',
      'targets',
      'incentives',
      'reports',
      'feed',
      'competitions',
    ])
    expect(grouped.secondary.map((item) => item.id)).toEqual([
      'operations',
      'dataQuality',
      'integrations',
      'snapshots',
      'pilotFeedback',
      'audit',
    ])
    expect(grouped.utility.map((item) => item.id)).toEqual(['session'])
  })
})
