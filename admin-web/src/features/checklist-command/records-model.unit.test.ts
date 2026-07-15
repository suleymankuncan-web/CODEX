import { describe, expect, it } from 'vitest'
import {
  buildChecklistCommandRegionsQuery,
  buildChecklistOperationalHistoryQuery,
} from './model'

describe('checklist records query contracts', () => {
  it('serializes one bounded company region page without the all-signal default', () => {
    expect(buildChecklistCommandRegionsQuery({
      period: '2026-07',
      signal: 'all',
      sort: 'manager_asc',
      limit: 20,
      offset: 40,
    }).toString()).toBe('period=2026-07&sort=manager_asc&limit=20&offset=40')
  })

  it('serializes an allowlisted history range, stable unique kinds and opaque cursor', () => {
    expect(buildChecklistOperationalHistoryQuery({
      range: '6m',
      kinds: ['task_resolved', 'checklist_completed', 'task_resolved'],
      cursor: 'opaque_cursor-1',
    }).toString()).toBe(
      'range=6m&kinds=checklist_completed%2Ctask_resolved&cursor=opaque_cursor-1',
    )
  })

  it('omits empty history filters while retaining the explicit range', () => {
    expect(buildChecklistOperationalHistoryQuery({
      range: 'all',
      kinds: [],
      cursor: '',
    }).toString()).toBe('range=all')
  })
})
