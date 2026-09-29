import { describe, expect, it } from 'vitest'
import {
  applyChecklistEvidenceProjection,
  canSelectSyntheticChecklistFixture,
  countMissingRequiredChecklistEvidence,
} from './checklist-item-evidence-model'

describe('checklist item evidence model', () => {
  it('blocks completion only for required items without evidence', () => {
    const items = [
      { templateItemId: 'none', responseType: 'compliance', evidencePolicy: 'none' as const },
      { templateItemId: 'optional', responseType: 'compliance', evidencePolicy: 'optional' as const },
      { templateItemId: 'required', responseType: 'compliance', evidencePolicy: 'required' as const },
    ]
    expect(countMissingRequiredChecklistEvidence(items, {}, {})).toBe(1)
    expect(countMissingRequiredChecklistEvidence(items, { required: 1 }, {})).toBe(0)
    expect(countMissingRequiredChecklistEvidence(items, {}, { required: 'not_applicable' })).toBe(0)
  })

  it('does not exempt historical scored-type N/A values from required evidence', () => {
    const items = ['score', 'boolean'].map((responseType) => ({
      templateItemId: responseType, responseType, evidencePolicy: 'required' as const,
    }))
    const responses = { score: 'not_applicable', boolean: 'not_applicable' }
    expect(countMissingRequiredChecklistEvidence(items, {}, responses)).toBe(2)
    expect(countMissingRequiredChecklistEvidence(items, { score: 1 }, responses)).toBe(1)
  })

  it('keeps selection disabled while busy, disabled, or at the pinned limit', () => {
    expect(canSelectSyntheticChecklistFixture({ disabled: false, busy: false, evidenceCount: 0, maxEvidenceCount: 1 })).toBe(true)
    expect(canSelectSyntheticChecklistFixture({ disabled: false, busy: true, evidenceCount: 0, maxEvidenceCount: 1 })).toBe(false)
    expect(canSelectSyntheticChecklistFixture({ disabled: true, busy: false, evidenceCount: 0, maxEvidenceCount: 1 })).toBe(false)
    expect(canSelectSyntheticChecklistFixture({ disabled: false, busy: false, evidenceCount: 1, maxEvidenceCount: 1 })).toBe(false)
  })

  it('applies item projections while advancing the instance-wide evidence version', () => {
    const first = applyChecklistEvidenceProjection([], {
      templateItemId: 'item-a',
      evidenceVersion: 1,
      evidence: [{ mediaAssetId: 'asset-a' }],
    })
    const second = applyChecklistEvidenceProjection(first.evidence, {
      templateItemId: 'item-b',
      evidenceVersion: 2,
      evidence: [{ mediaAssetId: 'asset-b' }],
    })

    expect(second).toEqual({
      evidenceVersion: 2,
      evidence: [
        { templateItemId: 'item-a', mediaAssetId: 'asset-a' },
        { templateItemId: 'item-b', mediaAssetId: 'asset-b' },
      ],
    })
  })
})
