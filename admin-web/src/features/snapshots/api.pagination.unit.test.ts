import { describe, expect, it } from 'vitest'
import { buildSnapshotAuditQuery } from './api'

describe('snapshot audit pagination request contract', () => {
  it('serializes the requested page offset and limit', () => {
    expect(buildSnapshotAuditQuery({ limit: 20, offset: 60 }).toString()).toBe(
      'limit=20&offset=60',
    )
  })
})
