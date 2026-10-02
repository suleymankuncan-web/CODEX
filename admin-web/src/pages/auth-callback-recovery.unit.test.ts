import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthCallbackPage } from './AuthCallbackPage'

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isError: false }) }))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../features/auth/api', () => ({ getAuthBootstrap: vi.fn() }))
vi.mock('../features/session/session-context-value', () => ({
  useSession: () => ({ startProviderSession: vi.fn(), startManagedSession: vi.fn() }),
}))
vi.mock('../features/localization/useLocalization', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

afterEach(() => vi.unstubAllGlobals())

it.each(['access_denied', 'login_required', 'interaction_required'])('provides a fresh login exit after %s', (error) => {
  vi.stubGlobal('window', { location: {
    search: `?error=${error}&error_description=Sign-in+expired&state=old-state`, hash: '',
  } })
  const html = renderToStaticMarkup(createElement(AuthCallbackPage))
  expect(html).toContain('Sign-in expired')
  expect(html).toMatch(/<a[^>]*href="\/auth\/login"[^>]*>authFlow\.restartLogin<\/a>/)
  expect(html).not.toContain('old-state')
})
