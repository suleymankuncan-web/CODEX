import { describe, expect, it } from 'vitest'
import {
  initialSnapshotsDashboardPageState,
  snapshotsDashboardPageReducer,
} from './snapshots-dashboard-page-model'

describe('Snapshots Dashboard page state', () => {
  it('starts a new server page at offset zero when search changes', () => {
    const state = { ...initialSnapshotsDashboardPageState, offset: 24 }

    expect(
      snapshotsDashboardPageReducer(state, { type: 'setSearch', value: 'stuck' }),
    ).toMatchObject({ search: 'stuck', offset: 0 })
  })
})
