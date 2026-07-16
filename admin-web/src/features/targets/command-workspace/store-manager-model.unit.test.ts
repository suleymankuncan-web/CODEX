import { describe, expect, test } from 'vitest'
import {
  createStoreTargetDraft,
  isApprovedTargetMonth,
  sanitizeTargetMoneyInput,
  storeTargetDraftSummary,
  targetPrecisionUnits,
} from './store-manager-model'
import type { TargetCommandStore } from './types'

const store = {
  storeId: 'store-1',
  storeCode: 'MOI',
  storeName: 'Mall',
  city: null,
  storeStatus: 'active',
  status: 'missing',
  capabilities: { canCreateRequest: true, canApproveRequest: false },
  request: null,
  personnel: [
    {
      employeeId: 'e1',
      displayName: 'Ada',
      positionCode: null,
      positionLabel: null,
      targetValue: null,
      eligibilityStatus: 'targetable',
    },
    {
      employeeId: 'e2',
      displayName: 'Ece',
      positionCode: null,
      positionLabel: null,
      targetValue: null,
      eligibilityStatus: 'targetable',
    },
  ],
  monthStatuses: [
    {
      period: '2026-06',
      status: 'approved',
      approvalStatus: 'approved',
      isApproved: true,
    },
  ],
} satisfies TargetCommandStore

describe('Store Manager target draft', () => {
  test('TGT-FR-006/AC-TGT-007: validates money at minor-unit precision', () => {
    const draft = {
      ...createStoreTargetDraft(store),
      total: '100.1001',
      allocations: { e1: '50.0500', e2: '50.0501' },
    }
    expect(storeTargetDraftSummary(store, draft)).toEqual({
      totalUnits: 1001001,
      allocationUnits: 1001001,
      balanceUnits: 0,
      valid: true,
    })
  })

  test('AC-TGT-007: rejects missing or unbalanced allocations', () => {
    const draft = {
      ...createStoreTargetDraft(store),
      total: '100',
      allocations: { e1: '100', e2: '' },
    }
    expect(storeTargetDraftSummary(store, draft).valid).toBe(false)
  })

  test('TGT-FR-007: approved marker comes only from persisted month status', () => {
    expect(isApprovedTargetMonth(store, '2026-06')).toBe(true)
    expect(isApprovedTargetMonth(store, '2026-05')).toBe(false)
  })

  test('TGT-FR-010/AC-TGT-008: permits zero only for a removed historical allocation', () => {
    const revisionStore = {
      ...store,
      personnel: [
        ...store.personnel,
        {
          employeeId: 'former',
          displayName: 'Former employee',
          positionCode: null,
          positionLabel: null,
          targetValue: '20',
          eligibilityStatus: 'historical_allocation' as const,
        },
      ],
    }
    const draft = {
      total: '100',
      note: 'Kadro değişikliği',
      allocations: { e1: '50', e2: '50', former: '0' },
    }

    expect(storeTargetDraftSummary(revisionStore, draft)).toMatchObject({
      balanceUnits: 0,
      valid: true,
    })
  })

  test('AC-TGT-007: visible money precision and submitted minor units cannot diverge', () => {
    expect(sanitizeTargetMoneyInput('100.00509')).toBe('100.0050')
    expect(sanitizeTargetMoneyInput('1,23999')).toBe('1.2399')
    expect(targetPrecisionUnits('1.00005')).toBe(10001)
  })

  test('TGT-FR-010: an approved request note never becomes the new revision reason', () => {
    const approvedStore = {
      ...store,
      request: {
        requestId: 'request-approved',
        status: 'approved' as const,
        targetLabel: 'Aylık hedef',
        totalTargetValue: '100',
        allocationCount: 2,
        requestReason: 'Eski talep bağlamı',
        approvalMode: 'direct' as const,
        approvedAt: '2026-06-10T09:00:00Z',
        approvalNote: null,
        createdAt: '2026-06-01T09:00:00Z',
        updatedAt: '2026-06-10T09:00:00Z',
        allocations: [
          { employeeId: 'e1', displayName: 'Ada', targetValue: '50', note: null },
          { employeeId: 'e2', displayName: 'Ece', targetValue: '50', note: null },
        ],
      },
    }

    expect(createStoreTargetDraft(approvedStore, [], { clearRequestNote: true }).note).toBe('')
    expect(
      createStoreTargetDraft(
        approvedStore,
        [
          { employeeId: 'e1', targetValue: '40' },
          { employeeId: 'e2', targetValue: '60' },
        ],
        { clearRequestNote: true },
      ),
    ).toEqual({
      total: '100',
      note: '',
      allocations: { e1: '40', e2: '60' },
    })
  })
})
