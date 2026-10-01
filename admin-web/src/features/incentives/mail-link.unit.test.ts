import { describe, expect, it } from 'vitest'
import { incentivePeriodFromMailLink } from './mail-link'

describe('approved-month mail link', () => {
  it('opens the explicit approved month', () => {
    expect(incentivePeriodFromMailLink('?period=2026-09')).toBe('2026-09')
  })
  it.each(['', '?period=2026-13', '?period=2026-00', '?period=2026-9', '?period=2026-09&period=2026-10', '?period=<script>'])('keeps the normal period fallback for %s', search => {
    expect(incentivePeriodFromMailLink(search)).toBeUndefined()
  })
})
