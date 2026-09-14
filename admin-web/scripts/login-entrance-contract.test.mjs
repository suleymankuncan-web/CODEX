import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const providerScript = readFileSync(new URL('../../infra/onprem/core/keycloak/themes/hr-axis/login/template.ftl', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)?.[1]

function offset({ saved = null, now = 10000, type = 'navigate', blocked = false } = {}) {
  let value
  runInNewContext(providerScript, {
    Date: { now: () => now }, Math, Number, String,
    sessionStorage: {
      getItem(key) {
        assert.equal(key, 'hr-axis-login-entrance-start')
        if (blocked) throw new Error('Storage disabled')
        return saved
      },
      setItem() {},
    },
    performance: { getEntriesByType: () => [{ type }] },
    document: { documentElement: { style: { setProperty(name, next) {
      assert.equal(name, '--login-motion-offset')
      value = next
    } } } },
  })
  return value
}

test('provider continues the React entrance instead of replaying it', () => {
  assert.equal(offset({ saved: '10000', now: 10430 }), '-430ms')
})
test('provider form posts keep the settled screen; an explicit reload replays', () => {
  assert.equal(offset({ saved: '1000' }), '-2000ms')
  assert.equal(offset({ saved: '1000', type: 'reload' }), '-0ms')
})
test('provider remains usable with unavailable storage', () => {
  assert.equal(offset({ blocked: true }), '-0ms')
})
test('invalid or future timestamps cannot delay the form', () => {
  for (const saved of ['invalid', 'Infinity', '-1', '99999999']) {
    assert.equal(offset({ saved }), '-0ms')
  }
})
