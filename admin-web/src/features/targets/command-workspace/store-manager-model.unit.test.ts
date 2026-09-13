import { describe, expect, test } from 'vitest'
import {
  createStoreTargetDraft,
  distributeTargetByDays,
  hasCompleteDistributionDays,
  isApprovedTargetMonth,
  isDepartedForTarget,
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
      fixedSales: {},
      total: '100',
      note: '',
      allocations: { e1: '40', e2: '60' },
    })
  })
})

describe('day-weighted target distribution', () => {
  test('matches the spreadsheet and keeps the store total exact', () => {
    const days = [0, 22, 30, 26, 22, 10]
    const people = days.map((_, i) => ({ employeeId: `p${i}` }))
    const draft = distributeTargetByDays({ total: '2500000', note: '', allocations: {}, distributionDays: Object.fromEntries(people.map((person, i) => [person.employeeId, String(days[i])])) }, people)
    expect(draft.allocations.p0).toBe('0.0000')
    expect(draft.allocations.p1).toBe('500000.0000')
    expect(Number(draft.allocations.p2)).toBeCloseTo(681818.1818, 4)
    expect(Object.values(draft.allocations).reduce((sum, value) => sum + targetPrecisionUnits(value), 0)).toBe(25000000000)
    expect(hasCompleteDistributionDays(draft, people)).toBe(true)
  })
  test('accepts an explicit zero share but rejects blank or all-zero days', () => {
    const draft = distributeTargetByDays({ total: '100', note: '', allocations: {}, distributionDays: { e1: '26', e2: '0' } }, store.personnel)
    expect(storeTargetDraftSummary(store, draft).valid).toBe(true)
    expect(hasCompleteDistributionDays({ ...draft, distributionDays: { e1: '0', e2: '0' } }, store.personnel)).toBe(false)
    expect(hasCompleteDistributionDays({ ...draft, distributionDays: { e1: '26', e2: '' } }, store.personnel)).toBe(false)
  })
  test('recalculates when total changes and rounds deterministically', () => {
    const draft = { total: '0.01', note: '', allocations: {}, distributionDays: { e1: '1', e2: '2' } }
    expect(distributeTargetByDays(draft, store.personnel).allocations).toEqual({ e1: '0.0033', e2: '0.0067' })
    expect(distributeTargetByDays({ ...draft, total: '300' }, store.personnel).allocations).toEqual({ e1: '100.0000', e2: '200.0000' })
  })
})

test('approved revision fills zero-target roster members and restores recorded days', () => {
  const approved = { ...store, request: { allocations: [{ employeeId: 'e1', targetValue: '100', distributionDays: 26 }], totalTargetValue: '100' } } as TargetCommandStore
  const draft = createStoreTargetDraft(approved, [{ employeeId: 'e1', targetValue: 100 }])
  expect(draft.allocations).toEqual({ e1: '100', e2: '0' })
  expect(draft.distributionDays).toEqual({ e1: '26', e2: '0' })
  expect(hasCompleteDistributionDays(draft, store.personnel)).toBe(true)
})


test('departure sales are fixed while the remaining target follows active day weights', () => {
  const people = [{ employeeId: 'left' }, { employeeId: 'a' }, { employeeId: 'b' }]
  const draft = { total: '1000', note: '', allocations: {}, fixedSales: { left: '300' }, distributionDays: { left: '26', a: '10', b: '20' } }
  const first = distributeTargetByDays(draft, people)
  expect(first.allocations).toEqual({ left: '300.0000', a: '233.3333', b: '466.6667' })
  const next = distributeTargetByDays({ ...first, distributionDays: { left: '999', a: '20', b: '20' } }, people)
  expect(next.allocations).toEqual({ left: '300.0000', a: '350.0000', b: '350.0000' })
  expect(next.fixedSales).toEqual({ left: '300' })
})

test('missing departure sales and fixed sales over the store total block submission', () => {
  const missing = { total: '100', note: '', allocations: {e1: '100', e2: '0'}, fixedSales: {e1: null}, distributionDays: {e1: '26', e2: '0'} }
  expect(storeTargetDraftSummary(store, missing).valid).toBe(false)
  const excessive = distributeTargetByDays({...missing, fixedSales: {e1: '150'}}, store.personnel)
  expect(storeTargetDraftSummary(store, excessive).valid).toBe(false)
})


test('pending revisions show submitted amounts instead of the previous approved basis', () => {
  const pending = { ...store, request: {status:'pending_region_approval',totalTargetValue:'100',allocations:[{employeeId:'e1',targetValue:'60',distributionDays:30},{employeeId:'e2',targetValue:'40',distributionDays:20}]}} as TargetCommandStore
  expect(createStoreTargetDraft(pending,[{employeeId:'e1',targetValue:50},{employeeId:'e2',targetValue:50}]).allocations).toEqual({e1:'60',e2:'40'})
})

test('adjusted approved amounts survive reopening even when weights differ or legacy days are absent', () => {
  const approved = {...store,personnel:store.personnel.map((p,i)=>({...p,...(i===0?{terminationDate:'2026-09-10',actualSales:'30'}:{})})),request:{status:'approved',totalTargetValue:'100',allocations:[{employeeId:'e1',targetValue:'30',distributionDays:26},{employeeId:'e2',targetValue:'70',distributionDays:26}]}} as TargetCommandStore
  const basis=[{employeeId:'e1',targetValue:30},{employeeId:'e2',targetValue:70}]
  expect(createStoreTargetDraft(approved,basis,{revisionPeriod:'2026-09',today:'2026-09-12'}).allocations).toEqual({e1:'30',e2:'70'})
  const legacy={...approved,request:{...approved.request!,allocations:approved.request!.allocations.map(a=>({...a,distributionDays:undefined}))}} as unknown as TargetCommandStore
  expect(createStoreTargetDraft(legacy,basis,{revisionPeriod:'2026-09',today:'2026-09-12'}).allocations).toEqual({e1:'30',e2:'70'})
})

test('future exits remain active until their Istanbul business date', () => {
  expect(isDepartedForTarget('2026-09-30','2026-09','2026-09-12')).toBe(false)
  expect(isDepartedForTarget('2026-09-12','2026-09','2026-09-12')).toBe(true)
  expect(isDepartedForTarget('2026-09-12','2026-08','2026-09-12')).toBe(false)
})
