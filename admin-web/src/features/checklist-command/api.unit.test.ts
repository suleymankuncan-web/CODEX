import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendOpenApiJson } from '../../lib/openapi-client'
import { saveChecklistVisitPlan } from './api'

vi.mock('../../lib/openapi-client', () => ({
  fetchOpenApiJson: vi.fn(),
  sendOpenApiJson: vi.fn(),
}))

const body = {
  expectedRevision: 3,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  items: [],
}

describe('saveChecklistVisitPlan', () => {
  beforeEach(() => {
    vi.mocked(sendOpenApiJson).mockReset()
  })

  it('rejects an assigned-store write without a valid scope revision before sending', () => {
    expect(() => saveChecklistVisitPlan({ weekStart: '2026-07-13', body })).toThrow(
      'Assigned visit plan requires a current scope revision',
    )
    expect(() => saveChecklistVisitPlan({
      weekStart: '2026-07-13',
      body: { ...body, expectedScopeRevision: 'bad' },
    })).toThrow('Assigned visit plan requires a current scope revision')
    expect(sendOpenApiJson).not.toHaveBeenCalled()
  })

  it('sends a validated scope revision to the assigned-store endpoint', () => {
    const assignedBody = { ...body, expectedScopeRevision: 'a'.repeat(64) }

    saveChecklistVisitPlan({ weekStart: '2026-07-13', body: assignedBody })

    expect(sendOpenApiJson).toHaveBeenCalledWith(
      '/api/checklists/command-canvas/visit-plans/assigned/{weekStart}',
      expect.objectContaining({ body: assignedBody }),
    )
  })

  it('keeps the scope revision optional for the legacy region endpoint', () => {
    saveChecklistVisitPlan({ regionId: 'region-a', weekStart: '2026-07-13', body })

    expect(sendOpenApiJson).toHaveBeenCalledWith(
      '/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}',
      expect.objectContaining({ body }),
    )
  })
})
