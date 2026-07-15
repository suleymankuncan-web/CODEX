import { describe, expect, it } from 'vitest'
import {
  buildChecklistWorkflowOverlaySearch,
  resolveChecklistWorkflowRouteState,
} from './checklist-workflow-route-state'
import { buildChecklistSearch } from '../../pages/store-checklists-model'

describe('checklist workflow command-overlay route state', () => {
  it('builds one canonical workflow overlay link without legacy routing keys', () => {
    expect(buildChecklistWorkflowOverlaySearch('?period=2026-07&status=completed', {
      kind: 'workflow',
      storeId: '11111111-1111-4111-8111-111111111111',
      tab: 'visits',
    })).toBe('?period=2026-07&overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=visits')
  })

  it('normalizes a persisted legacy workflow link while preserving unrelated command state', () => {
    expect(resolveChecklistWorkflowRouteState(
      '?period=2026-07&view=workflow&storeId=11111111-1111-4111-8111-111111111111&tab=plan&status=missing',
    )).toEqual({
      state: {
        kind: 'workflow',
        storeId: '11111111-1111-4111-8111-111111111111',
        tab: 'plan',
        status: 'missing',
      },
      normalizedSearch: '?period=2026-07&overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=plan&workflowStatus=missing',
      shouldReplace: true,
    })
  })

  it('normalizes a result deep link into a result overlay without legacy result/tab keys', () => {
    expect(resolveChecklistWorkflowRouteState(
      '?view=workflow&tab=history&result=22222222-2222-4222-8222-222222222222',
    )).toEqual({
      state: {
        checklistInstanceId: '22222222-2222-4222-8222-222222222222',
        kind: 'result',
      },
      normalizedSearch: '?overlay=result&checklistInstanceId=22222222-2222-4222-8222-222222222222',
      shouldReplace: true,
    })
  })

  it('rejects malformed canonical identifiers instead of opening an unscoped overlay', () => {
    expect(resolveChecklistWorkflowRouteState('?overlay=workflow&storeId=not-an-id')).toEqual({
      state: null,
      normalizedSearch: '',
      shouldReplace: true,
    })
  })

  it('leaves an ordinary Command Canvas search untouched', () => {
    expect(resolveChecklistWorkflowRouteState('?period=2026-07')).toEqual({
      state: null,
      normalizedSearch: '?period=2026-07',
      shouldReplace: false,
    })
  })

  it('does not reinterpret canonical Command Canvas tab and status filters as a legacy overlay', () => {
    expect(resolveChecklistWorkflowRouteState(
      '?tab=plan&period=2026-07&status=needs_visit',
    )).toEqual({
      state: null,
      normalizedSearch: '?tab=plan&period=2026-07&status=needs_visit',
      shouldReplace: false,
    })
  })

  it('keeps workflow tab/status updates canonical after the overlay cutover', () => {
    expect(buildChecklistSearch(
      '?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=visits',
      { tab: 'history', status: 'pending' },
    )).toBe('?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=history&workflowStatus=pending')
  })

  it('opens and closes a result without restoring legacy query keys', () => {
    const opened = buildChecklistSearch(
      '?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=history',
      { result: '22222222-2222-4222-8222-222222222222', tab: 'history' },
    )
    expect(opened).toBe('?overlay=result&checklistInstanceId=22222222-2222-4222-8222-222222222222&storeId=11111111-1111-4111-8111-111111111111&workflowTab=history')
    expect(resolveChecklistWorkflowRouteState(opened)).toEqual({
      state: {
        kind: 'result',
        checklistInstanceId: '22222222-2222-4222-8222-222222222222',
        returnStoreId: '11111111-1111-4111-8111-111111111111',
        returnTab: 'history',
      },
      normalizedSearch: opened,
      shouldReplace: false,
    })
    expect(buildChecklistSearch(opened, { result: null })).toBe(
      '?overlay=workflow&storeId=11111111-1111-4111-8111-111111111111&workflowTab=history',
    )
  })

  it('closes a result-only deep link back to the canvas instead of leaving an empty result overlay', () => {
    expect(buildChecklistSearch(
      '?period=2026-07&overlay=result&checklistInstanceId=22222222-2222-4222-8222-222222222222',
      { result: null },
    )).toBe('?period=2026-07')
  })
})
