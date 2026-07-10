import { describe, expect, it } from 'vitest'
import type { RequestCenterItem } from '../features/store-approvals/request-center-api'
import {
  buildRequestCenterRows,
  createPeriodOptions,
  requestCenterCopy,
} from './store-approvals-request-center-model'

const baseItem = {
  requestId: 'request-1',
  storeId: 'store-1',
  storeName: 'Store A',
  status: 'pending_region_approval',
  updatedAt: '2026-07-10T09:00:00.000Z',
  targetLabel: null,
  requestMonth: null,
  allocationCount: null,
  approvalMode: null,
  personDisplayName: null,
  nationalIdLast4: null,
  externalEmployeeRef: null,
} satisfies Omit<RequestCenterItem, 'requestType'>

describe('bounded request center rows', () => {
  it('maps server-ordered source rows without client scope or history sorting', () => {
    const rows = buildRequestCenterRows({
      copy: requestCenterCopy.en,
      locale: 'en',
      persona: 'regionManager',
      items: [
        {
          ...baseItem,
          requestType: 'target',
          targetLabel: 'July target',
          requestMonth: '2026-07-01',
          allocationCount: 4,
        },
        {
          ...baseItem,
          requestId: 'request-2',
          requestType: 'sellerCode',
          status: 'rejected',
          personDisplayName: 'Sanitized Person',
          nationalIdLast4: '1234',
        },
        {
          ...baseItem,
          requestId: 'request-3',
          requestType: 'offboarding',
          status: 'approved',
          personDisplayName: 'Another Person',
          externalEmployeeRef: 'EMP-3',
        },
      ],
    })

    expect(rows.map((row) => row.id)).toEqual([
      'target:request-1',
      'sellerCode:request-2',
      'offboarding:request-3',
    ])
    expect(rows[0]).toEqual(expect.objectContaining({ bucket: 'open', actionPrimary: true }))
    expect(rows[1]).toEqual(expect.objectContaining({ rowTone: 'returned' }))
    expect(rows[2]).toEqual(expect.objectContaining({ bucket: 'done' }))
  })

  it('builds period filters from the exact server summary instead of the current page', () => {
    expect(createPeriodOptions(['2026-06', '2026-07', '2026-06'], 'en')).toEqual([
      { value: '2026-07', label: 'July 2026' },
      { value: '2026-06', label: 'June 2026' },
    ])
  })
})
