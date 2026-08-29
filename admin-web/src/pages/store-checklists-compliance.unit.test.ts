import { describe, expect, it } from 'vitest'
import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import {
  buildChecklistResponseDrafts,
  calculateChecklistLiveScore,
  getResponseRatio,
  getWeightedResponsePoints,
  groupChecklistResultResponses,
  serializeChecklistResponseDraft,
} from './store-checklists-logic'
import type { ChecklistSession } from './store-checklists-model'

describe('checklist compliance answers', () => {
  it('excludes N/A from result ratios', () => {
    const response = {
      maxScore: 2,
      responseValue: 'not_applicable',
      scoreValue: 0,
    } as ChecklistAcknowledgementItem['responses'][number]

    expect(getResponseRatio(response)).toBeNull()
  })

  it('excludes N/A from the live score denominator', () => {
    const items = [
      { templateItemId: 'item-1', maxScore: 2 },
      { templateItemId: 'item-2', maxScore: 2 },
    ] as MobileChecklistToday['templates'][number]['items']

    expect(calculateChecklistLiveScore({
      items,
      responseValues: { 'item-1': 'compliant', 'item-2': 'not_applicable' },
      scores: { 'item-1': 2, 'item-2': 0 },
    })).toBe(100)

    expect(calculateChecklistLiveScore({
      items: items.slice(0, 1),
      responseValues: { 'item-1': 'not_applicable' },
      scores: { 'item-1': 0 },
    })).toBeNull()
  })

  it('uses item weights for live and completed section scores', () => {
    const templateItems = [
      { templateItemId: 'item-1', maxScore: 2, weight: 1 },
      { templateItemId: 'item-2', maxScore: 2, weight: 3 },
    ] as MobileChecklistToday['templates'][number]['items']

    expect(calculateChecklistLiveScore({
      items: templateItems,
      responseValues: { 'item-1': 'compliant', 'item-2': 'non_compliant' },
      scores: { 'item-1': 2, 'item-2': 0 },
    })).toBe(25)

    const responses = [
      {
        templateItemId: 'item-1',
        sectionName: 'Operasyon',
        itemNo: 1,
        itemText: 'Düşük ağırlıklı madde',
        responseType: 'compliance',
        responseValue: 'compliant',
        scoreValue: 2,
        maxScore: 2,
        weight: 1,
      },
      {
        templateItemId: 'item-2',
        sectionName: 'Operasyon',
        itemNo: 2,
        itemText: 'Yüksek ağırlıklı madde',
        responseType: 'compliance',
        responseValue: 'non_compliant',
        scoreValue: 0,
        maxScore: 2,
        weight: 3,
      },
    ] as ChecklistAcknowledgementItem['responses']

    expect(groupChecklistResultResponses(responses)[0]).toMatchObject({
      averageScore: 25,
      earnedPoints: 1,
      maxPoints: 4,
    })
    expect(getWeightedResponsePoints({ ...responses[1]!, scoreValue: 1 })).toEqual({
      earnedPoints: 1.5,
      maxPoints: 3,
    })
  })

  it('keeps the semantic answer value in autosave and completion drafts', () => {
    const session = {
      template: {
        items: [
          {
            templateItemId: 'item-1',
          },
        ],
      },
    } as ChecklistSession

    const drafts = buildChecklistResponseDrafts({
      checklistInstanceId: 'instance-1',
      comments: {},
      responseValues: { 'item-1': 'partially_compliant' },
      scores: { 'item-1': 1 },
      session,
    })

    expect(drafts).toEqual([
      {
        checklistInstanceId: 'instance-1',
        templateItemId: 'item-1',
        responseValue: 'partially_compliant',
        scoreValue: 1,
      },
    ])
    expect(serializeChecklistResponseDraft(drafts[0]!)).toContain('partially_compliant')
  })
})
