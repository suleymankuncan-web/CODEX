import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api-error'
import { SessionRecoveryState } from './session-recovery-state'

const localization = vi.hoisted(() => ({ locale: 'tr' }))
vi.mock('../localization/useLocalization', () => ({ useLocalization: () => localization }))
afterEach(() => { vi.useRealTimers(); localization.locale = 'tr' })

it.each(['tr', 'en'])('shows a disabled cooldown action in %s without claiming an unverified session is open', (locale) => {
  localization.locale = locale
  vi.useFakeTimers()
  const html = renderToStaticMarkup(createElement(SessionRecoveryState, {
    onRetry: vi.fn(), error: new ApiError(429, 'private technical detail', Date.now() + 5000),
  }))
  expect(html).toContain('disabled=""')
  expect(html).toContain(locale === 'tr' ? '5 saniye sonra yeniden dene' : 'Retry in 5 seconds')
  expect(html).not.toContain('private technical detail')
  expect(html).not.toMatch(/Oturumunuz kapanmadı|Your session is still open/)
})

it('provides an enabled manual retry after cooldown without an automatic action', () => {
  const onRetry = vi.fn()
  const html = renderToStaticMarkup(createElement(SessionRecoveryState, {
    onRetry, error: new ApiError(429, 'temporary', Date.now() - 1000),
  }))
  expect(html).not.toContain('disabled=""')
  expect(html).toContain('Yeniden dene')
  expect(onRetry).not.toHaveBeenCalled()
})
