import { describe, expect, it } from 'vitest'
import { mapChecklistTone, summarizeChecklistMetrics } from './reports-checklists-model'
import { mergeCompletedInstanceIntoMobileToday } from './store-checklists-cache-model'
import { isChecklistNotApplicableReasonMissing } from './store-checklists-score-policy'

describe('checklist null-score presentation', () => {
  it('requires a nonblank explanation for N/A without imposing it on other responses', () => {
    expect(isChecklistNotApplicableReasonMissing('not_applicable', undefined)).toBe(true)
    expect(isChecklistNotApplicableReasonMissing('not_applicable', ' \t\n')).toBe(true)
    expect(isChecklistNotApplicableReasonMissing('not_applicable', ' No display in this store ')).toBe(false)
    expect(isChecklistNotApplicableReasonMissing('compliant', undefined)).toBe(false)
  })
  it('keeps an all-N/A completion null in cache and monthly summary', () => {
    const result = mergeCompletedInstanceIntoMobileToday({
      data: { activeInstances: [], completedThisMonth: [], monthlySummaries: [], pendingAcknowledgements: [], stores: [] },
      meta: {},
    } as never, {
      checklistInstanceId: 'instance-1', checklistTemplateId: 'template-1',
      completedAt: '2026-09-29T00:00:00.000Z', storeId: 'store-1', totalScore: null,
    })
    expect(result?.data.completedThisMonth[0]?.totalScore).toBeNull()
    expect(result?.data.pendingAcknowledgements[0]?.totalScore).toBeNull()
    expect(result?.data.monthlySummaries[0]?.averageScore).toBeNull()
  })

  it('keeps snapshot no-score rows neutral and outside aggregate denominators', () => {
    const result = summarizeChecklistMetrics([
      { auditCount: 1, avgScore: null, complianceRate: null, criticalIssueCount: 0 },
      { auditCount: 1, avgScore: '80.00', complianceRate: '0.8000', criticalIssueCount: 0 },
    ])
    expect(result.averageScore).toBe(80)
    expect(result.averageCompliance).toBe(0.8)
    expect(mapChecklistTone(null, 0)).toBe('neutral')
  })

  it('uses only scored completions in optimistic monthly averages', () => {
    const result = mergeCompletedInstanceIntoMobileToday({
      data: {
        activeInstances: [], stores: [], pendingAcknowledgements: [],
        completedThisMonth: [
          { checklistInstanceId: 'scored', checklistTemplateId: 'template-1', completedAt: '2026-09-01T00:00:00.000Z', storeId: 'store-1', totalScore: 80, acknowledgedAt: null },
          { checklistInstanceId: 'na', checklistTemplateId: 'template-1', completedAt: '2026-09-02T00:00:00.000Z', storeId: 'store-1', totalScore: null, acknowledgedAt: null },
        ],
        monthlySummaries: [{ averageScore: 80, checklistTemplateId: 'template-1', completedCount: 2, monthStart: '2026-09-01', storeId: 'store-1' }],
      }, meta: {},
    } as never, {
      checklistInstanceId: 'new-score', checklistTemplateId: 'template-1',
      completedAt: '2026-09-03T00:00:00.000Z', storeId: 'store-1', totalScore: 100,
    })
    expect(result?.data.monthlySummaries[0]).toMatchObject({ averageScore: 90, completedCount: 3 })
  })
})
