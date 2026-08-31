import { describe, expect, it } from 'vitest'
import { buildAuditListQuery } from './api'

describe('auth audit pagination request contract', () => {
  it('serializes independent bounded audit pages', () => {
    expect(buildAuditListQuery({ limit: 20, offset: 40 }).toString()).toBe(
      'limit=20&offset=40',
    )
  })

  it('uses the documented default page when no bounds are supplied', () => {
    expect(buildAuditListQuery().toString()).toBe('limit=50&offset=0')
  })
})
