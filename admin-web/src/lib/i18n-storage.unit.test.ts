import { afterEach, expect, it, vi } from 'vitest'
import { readStoredAppLocale, writeStoredAppLocale } from './i18n'
afterEach(() => vi.unstubAllGlobals())
it('keeps the login screen usable when site preferences cannot be read or saved', () => {
  vi.stubGlobal('window', { get localStorage() { throw new DOMException('Restricted', 'SecurityError') } })
  expect(readStoredAppLocale()).toBe('tr')
  expect(() => writeStoredAppLocale('en')).not.toThrow()
})
