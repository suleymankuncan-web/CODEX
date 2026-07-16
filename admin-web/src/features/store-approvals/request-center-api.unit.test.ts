import { describe, expect, it } from 'vitest'
import { buildRequestCenterQuery, getRequestCenterWorkspaceOffsets } from './request-center-api'

describe('request center API query', () => {
  it('serializes one exact bounded server page', () => {
    expect(
      buildRequestCenterQuery({
        bucket: 'done',
        type: 'target',
        status: 'approved',
        period: '2026-07',
        storeId: 'store-1',
        query: ' July target ',
        limit: 15,
        offset: 30,
      }).toString(),
    ).toBe(
      'bucket=done&type=target&status=approved&period=2026-07&storeId=store-1&q=July+target&limit=15&offset=30',
    )
  })

  it('omits blank optional filters while retaining page bounds', () => {
    expect(
      buildRequestCenterQuery({
        bucket: 'open',
        type: 'all',
        status: 'all',
        query: ' ',
        limit: 15,
        offset: 0,
      }).toString(),
    ).toBe('bucket=open&type=all&status=all&limit=15&offset=0')
  })

  it('plans every bounded server page without a silent workspace cap', () => {
    expect(getRequestCenterWorkspaceOffsets(0)).toEqual([])
    expect(getRequestCenterWorkspaceOffsets(201)).toEqual([0, 200])
    expect(getRequestCenterWorkspaceOffsets(10_001).at(-1)).toBe(10_000)
  })
})
