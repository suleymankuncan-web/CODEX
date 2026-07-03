import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const actionToastSource = readFileSync(new URL('../src/lib/action-toast.ts', import.meta.url), 'utf8')
const toasterSource = readFileSync(new URL('../src/components/hr-axis-toaster.tsx', import.meta.url), 'utf8')
const uiSonnerSource = readFileSync(new URL('../src/components/ui/sonner.tsx', import.meta.url), 'utf8')

test('HR Axis toaster is mounted once at the app root', () => {
  assert.match(mainSource, /import \{ HrAxisToaster \} from '\.\/components\/hr-axis-toaster'/)
  assert.equal((mainSource.match(/<HrAxisToaster \/>/g) ?? []).length, 1)
})

test('action toast helper owns all direct Sonner calls for app pages', () => {
  assert.match(actionToastSource, /from 'sonner'/)
  assert.match(actionToastSource, /getUserFacingErrorMessage/)
  assert.match(actionToastSource, /toastErrorFromUnknown/)
  assert.match(actionToastSource, /success\(message/)
  assert.match(actionToastSource, /error\(error: unknown, fallbackMessage: string/)
  assert.match(actionToastSource, /promise: toast\.promise/)
  assert.match(uiSonnerSource, /Toaster as SonnerToaster/)
})

test('global toaster keeps the approved placement and viewport offset contract', () => {
  assert.match(toasterSource, /position="bottom-right"/)
  assert.match(toasterSource, /visibleToasts=\{3\}/)
  assert.match(toasterSource, /--hr-axis-toast-right/)
  assert.match(toasterSource, /--hr-axis-toast-mobile-bottom/)
  assert.match(toasterSource, /hr-axis-toast/)
})
