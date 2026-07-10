import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildStagePresetDraft } from '../features/competitions/stage-presets'
import {
  createCompetitionDraftDateDefaults,
  createIntegrationPeriodDefaults,
  createStoreApprovalsDateDefaults,
  getChecklistTemplateEffectiveDate,
} from './business-date-defaults'
import {
  createStoreApprovalsPageState,
  storeApprovalsPageReducer,
} from './store-approvals-model'

const istanbulJulyBoundary = new Date('2026-06-30T21:30:00.000Z')

afterEach(() => {
  vi.useRealTimers()
})

describe('business-date defaults by caller', () => {
  it('initializes all integration period fields from one Istanbul business date', () => {
    const state = createIntegrationPeriodDefaults(istanbulJulyBoundary)

    expect(state.month).toBe('2026-07')
    expect(state.start).toBe('2026-07-01')
    expect(state.end).toBe('2026-07-01')
  })

  it('builds competition dates and code at action time across a year boundary', () => {
    const payload = createCompetitionDraftDateDefaults(
      new Date('2026-12-31T21:30:00.000Z'),
    )

    expect(payload).toEqual(expect.objectContaining({
      dateCode: '2027_01_01',
      startsOn: '2027-01-01',
      endsOn: '2027-01-15',
    }))
    expect(buildStagePresetDraft({
      competitionStartsOn: payload.startsOn,
      competitionEndsOn: payload.endsOn,
      presetCode: 'first_half_qualifier',
    })).toEqual(expect.objectContaining({
      startsOn: '2027-01-01',
      endsOn: '2027-01-08',
    }))
  })

  it('initializes both checklist drafts with the current Istanbul business date', () => {
    expect(getChecklistTemplateEffectiveDate(istanbulJulyBoundary)).toBe('2026-07-01')
  })

  it('initializes Store Approvals and refreshes reset dates after Istanbul midnight', () => {
    const state = createStoreApprovalsPageState(
      { defaultTargetLabel: 'Monthly target', initialPanel: 'targetRequest' },
      istanbulJulyBoundary,
    )
    expect(state.requestMonth).toBe('2026-07')
    expect(state.sellerHireDate).toBe('2026-07-01')
    expect(state.offboardingTerminationDate).toBe('2026-07-01')
    expect(createStoreApprovalsDateDefaults(istanbulJulyBoundary)).toEqual({
      month: '2026-07',
      date: '2026-07-01',
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T21:30:00.000Z'))

    expect(storeApprovalsPageReducer(state, {
      type: 'resetSellerRequestSuccess',
      message: 'saved',
    }).sellerHireDate).toBe('2026-07-02')
    expect(storeApprovalsPageReducer(state, {
      type: 'resetOffboardingRequestSuccess',
      message: 'saved',
    }).offboardingTerminationDate).toBe('2026-07-02')
  })
})
