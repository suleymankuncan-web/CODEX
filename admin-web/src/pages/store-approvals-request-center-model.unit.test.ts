import { describe, expect, it, vi } from 'vitest'
import type { RequestCenterItem } from '../features/store-approvals/request-center-api'
import { buildRequestCenterRows, createPeriodOptions, filterAndSortRequestCenterRows, requestCenterCopy } from './store-approvals-request-center-model'

const baseItem = {
  requestId: 'request-1', storeId: 'store-1', storeName: 'Store A', status: 'pending_region_approval',
  regionId: '33333333-3333-4333-8333-333333333333', regionName: 'Marmara', regionManagerNames: ['Region Manager', 'Second Manager'],
  createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
  waitingSince: '2026-07-10T09:00:00.000Z', nextOwner: 'region', dueAt: '2026-07-12T09:00:00.000Z', isOverdue: true,
  events: [
    { eventId: 'event-2', type: 'returned', occurredAt: '2026-07-12T09:00:00.000Z', actorDisplayName: 'Region User' },
    { eventId: 'event-1', type: 'created', occurredAt: '2026-07-10T09:00:00.000Z', actorDisplayName: null },
  ],
  eventTotal: 21,
  targetLabel: null, requestMonth: null, allocationCount: null, approvalMode: null,
  personDisplayName: null, nationalIdLast4: null, externalEmployeeRef: null,
} satisfies Omit<RequestCenterItem, 'requestType'>

describe('request center command canvas model', () => {
  it('uses authoritative waiting and next-owner truth and sorts sanitized events chronologically', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
    const row = buildRequestCenterRows({ copy: requestCenterCopy.en, locale: 'en', persona: 'reportViewer', items: [{ ...baseItem, requestType: 'target', targetLabel: 'July target', requestMonth: '2026-07-01', allocationCount: 4 }] })[0]!
    expect(row).toEqual(expect.objectContaining({ waitingSince: baseItem.waitingSince, waitingLabel: '5 days · overdue', nextOwnerLabel: 'Region manager', isOverdue: true }))
    expect(row.scopeSubtitle).toBe('Region Manager, Second Manager · Marmara')
    expect(row.eventTotal).toBe(21)
    expect(row.events.map((event) => event.id)).toEqual(['event-1', 'event-2'])
    expect(row.waitingLabel).not.toContain('0 days')
    vi.useRealTimers()
  })

  it('filters metrics and controls locally from one scoped dataset', () => {
    const rows = buildRequestCenterRows({ copy: requestCenterCopy.en, locale: 'en', persona: 'regionManager', items: [
      { ...baseItem, requestType: 'target', targetLabel: 'July target' },
      { ...baseItem, requestId: 'request-2', requestType: 'sellerCode', status: 'rejected', isOverdue: false, nextOwner: 'store', personDisplayName: 'Sanitized Person', nationalIdLast4: '1234' },
      { ...baseItem, requestId: 'request-3', requestType: 'offboarding', status: 'approved', isOverdue: false, waitingSince: null, dueAt: null, nextOwner: null, personDisplayName: 'Another Person', externalEmployeeRef: 'EMP-3' },
    ] })
    expect(filterAndSortRequestCenterRows({ rows, tab: 'open', query: '', type: 'all', status: 'overdue', period: 'all', sort: 'updatedDesc' }).map((row) => row.id)).toEqual(['target:request-1'])
    expect(filterAndSortRequestCenterRows({ rows, tab: 'open', query: 'sanitized', type: 'all', status: 'all', period: 'all', sort: 'updatedDesc' }).map((row) => row.id)).toEqual(['sellerCode:request-2'])
  })

  it('builds period filters from the complete workspace dataset', () => {
    expect(createPeriodOptions(['2026-06', '2026-07', '2026-06'], 'en')).toEqual([{ value: '2026-07', label: 'July 2026' }, { value: '2026-06', label: 'June 2026' }])
  })
})
