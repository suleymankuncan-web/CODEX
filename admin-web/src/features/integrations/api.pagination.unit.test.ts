import { describe, expect, it } from 'vitest'
import { buildListPageQuery, buildNeedsActionQuery, buildNeedsActionQueryKey } from './api'

describe('integration pagination request contract', () => {
  it('keeps queue filters, trimmed search, and page bounds in the server query', () => {
    expect(
      buildNeedsActionQuery({
        entityType: 'store',
        status: 'failed',
        sourceCode: 'POWERBI',
        q: '  Marmara Park  ',
        limit: 12,
        offset: 24,
      }).toString(),
    ).toBe(
      'limit=12&offset=24&entityType=store&status=failed&sourceCode=POWERBI&q=Marmara+Park',
    )
  })

  it('caps queue search at the backend maximum and preserves blank omission', () => {
    const longQuery = 'x'.repeat(200)
    const capped = buildNeedsActionQuery({ q: longQuery, limit: 12, offset: 0 })

    expect(capped.get('q')).toHaveLength(128)
    expect(buildNeedsActionQuery({ q: '  ', limit: 12, offset: 0 }).toString()).toBe(
      'limit=12&offset=0',
    )
  })

  it('serializes detail page limits and offsets for each request', () => {
    expect(buildListPageQuery({ limit: 20, offset: 40 }).toString()).toBe(
      'limit=20&offset=40',
    )
  })

  it('keeps query identity tied to the server search, filters, and page offset', () => {
    const firstPage = buildNeedsActionQueryKey({
      limit: 12,
      offset: 0,
      q: '  Marmara Park  ',
      entityType: 'store',
      status: 'failed',
    })
    const secondPage = buildNeedsActionQueryKey({
      limit: 12,
      offset: 12,
      q: 'Marmara Park',
      entityType: 'store',
      status: 'failed',
    })

    expect(firstPage).toEqual([
      'integration-needs-action',
      0,
      'store',
      'failed',
      'q',
      'Marmara Park',
      'sourceCode',
      '',
    ])
    expect(secondPage).not.toEqual(firstPage)
  })

  it('does not collide when q and sourceCode carry the same value', () => {
    const searchKey = buildNeedsActionQueryKey({ q: 'ERP' })
    const sourceKey = buildNeedsActionQueryKey({ sourceCode: 'ERP' })

    expect(searchKey).not.toEqual(sourceKey)
    expect(searchKey).toEqual([
      'integration-needs-action',
      0,
      '',
      '',
      'q',
      'ERP',
      'sourceCode',
      '',
    ])
    expect(sourceKey).toEqual([
      'integration-needs-action',
      0,
      '',
      '',
      'q',
      '',
      'sourceCode',
      'ERP',
    ])
  })
})
