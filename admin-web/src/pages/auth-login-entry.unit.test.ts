import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthLoginPage } from './AuthLoginPage'

const bootstrap = vi.hoisted(() => ({
  isPending: true,
  isLoading: true,
  isError: false,
  data: undefined as undefined | { provider: { configured: boolean } },
}))

vi.mock('@tanstack/react-query', () => ({ useQuery: () => bootstrap }))
vi.mock('react-router', () => ({
  useLocation: () => ({ state: null }),
  useSearchParams: () => [new URLSearchParams()],
}))
vi.mock('../app/route-preloaders', () => ({ preloadRouteModule: vi.fn() }))
vi.mock('../features/auth/api', () => ({ getAuthBootstrap: vi.fn() }))
vi.mock('../features/auth/clerk-session', () => ({
  ClerkLoginActions: () => createElement('span', null, 'Clerk form'),
}))
vi.mock('../features/localization/useLocalization', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

function firstPaint() {
  // Effects have not run: this reproduces the frame before the redirect is ready.
  return renderToStaticMarkup(createElement(AuthLoginPage, { shellMode: 'setup-required' }))
}

describe('Docker login first paint', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_PROVIDER', 'oidc')
    vi.stubEnv('VITE_OIDC_AUTO_REDIRECT', 'true')
    Object.assign(bootstrap, { isPending: true, isLoading: true, isError: false, data: undefined })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('never renders the legacy login card while bootstrap is pending', () => {
    const html = firstPaint()
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toMatch(/auth-login-brand|auth-login-panel|auth-login-primary/)
    expect(html).toContain('İyi bir gün,')
    expect(html).toContain('Hoş geldin.')
    expect(html).toContain('onprem-login-entry')
    expect(html).toMatch(/id="entry-username"[^>]*disabled=""/)
    expect(html).not.toContain('<form')
    expect(html).not.toContain('role="alert"')
  })

  it('keeps the transition while the configured provider URL is being prepared', () => {
    Object.assign(bootstrap, { isPending: false, isLoading: false, data: { provider: { configured: true } } })
    expect(firstPaint()).toContain('aria-busy="true"')
    expect(firstPaint()).not.toContain('auth-login-panel')
  })

  it('shows recovery instead of an endless spinner when bootstrap fails', () => {
    Object.assign(bootstrap, { isPending: false, isLoading: false, isError: true })
    const html = firstPaint()
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-busy="false"')
    expect(html).toContain('authFlow.retrySignIn')
    expect(html).not.toContain('auth-login-panel')
  })

  it('shows recovery when the provider configuration is unavailable', () => {
    Object.assign(bootstrap, { isPending: false, isLoading: false, data: { provider: { configured: false } } })
    expect(firstPaint()).toContain('authFlow.loginTemporarilyUnavailable')
    expect(firstPaint()).toContain('authFlow.retrySignIn')
  })

  it('preserves the manual OIDC entry when direct login is not enabled', () => {
    vi.stubEnv('VITE_OIDC_AUTO_REDIRECT', 'false')
    expect(firstPaint()).toContain('auth-login-panel')
  })

  it('preserves hosted Clerk login even if the Docker flag is accidentally set', () => {
    vi.stubEnv('VITE_AUTH_PROVIDER', 'clerk')
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_local_fixture')
    expect(firstPaint()).toContain('Clerk form')
    expect(firstPaint()).not.toContain('onprem-login-entry')
  })
})
