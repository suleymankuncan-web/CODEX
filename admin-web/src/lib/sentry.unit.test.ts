import { describe, expect, it } from 'vitest'
import {
  captureFrontendException,
  initializeFrontendSentry,
  sanitizeSentryEvent,
} from './sentry'

describe('frontend Sentry delivery contract', () => {
  it('removes request, user, breadcrumb, extra, and local stack data', () => {
    const sanitized = sanitizeSentryEvent({
      request: {
        headers: { authorization: 'Bearer secret' },
        url: 'https://example.test/api?token=secret',
      },
      user: { email: 'person@example.com' },
      breadcrumbs: [{ message: 'password=secret' }],
      extra: { token: 'secret' },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'password=secret',
            stacktrace: {
              frames: [
                {
                  filename: 'app.js',
                  function: 'run',
                  vars: { password: 'secret' },
                },
              ],
            },
          },
        ],
      },
    } as never)

    const serialized = JSON.stringify(sanitized)
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('person@example.com')
    expect(sanitized.request).toBeUndefined()
    expect(sanitized.user).toBeUndefined()
    expect(sanitized.breadcrumbs).toBeUndefined()
    expect(sanitized.extra).toBeUndefined()
  })

  it('stays disabled without the explicit Vite enable flag', () => {
    expect(initializeFrontendSentry()).toBe(false)
    expect(
      captureFrontendException(new Error('ignored'), {
        event: 'test',
        source: 'unit',
      }),
    ).toBe(false)
  })
})
