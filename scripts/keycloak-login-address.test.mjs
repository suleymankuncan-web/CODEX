import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

const theme = new URL('../infra/onprem/core/keycloak/themes/hr-axis/login/', import.meta.url)
const source = readFileSync(new URL('resources/js/login-address.js', theme), 'utf8')
const native = 'https://axis.example.test/realms/store-ops/login-actions/authenticate?client_id=store-ops-admin-web&tab_id=native-tab&client_data=native-session'

function present(href = native, fail = false) {
  const state = { existing: 'preserved' }
  const calls = []
  const events = new Map()
  const window = {
    location: { href },
    addEventListener: (name, handler) => events.set(name, handler),
    history: { state, replaceState: (...args) => {
      if (fail) throw new Error('History API unavailable')
      calls.push(args)
    } },
  }
  // There are deliberately no storage, document, fetch or navigation helpers.
  runInNewContext(source, { window, URL })
  return { calls, state, window, events }
}

test('native login changes only its displayed history entry and preserves existing history state', () => {
  const { calls, state, window } = present()
  assert.deepEqual(calls, [[state, '', '/auth/login']])
  assert.equal(calls[0][0], state)
  assert.equal(window.location.href, native)
})

test('other clients, realms, action-token links and application callbacks keep their addresses', () => {
  const rejected = [
    native.replace('https:', 'http:'),
    native.replace('/store-ops/', '/other-realm/'),
    native.replace('store-ops-admin-web', 'account-console'),
    native + '&client_id=store-ops-admin-web',
    native.replace('authenticate?', 'reset-credentials?'),
    native.replace('authenticate?', 'action-token?'),
    'https://axis.example.test/auth/callback?code=callback&state=pkce-state',
    'https://axis.example.test/auth/login',
    'not-a-url',
  ]
  for (const href of rejected) assert.deepEqual(present(href).calls, [], href)
})

test('a browser that disallows history replacement can still use the native login page', () => {
  assert.deepEqual(present(native, true).calls, [])
})

test('a form response or back/forward restoration reapplies the short address on pageshow', () => {
  const { calls, state, events } = present()
  assert.equal(events.size, 2)
  events.get('DOMContentLoaded')()
  events.get('pageshow')()
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [state, '', '/auth/login']))
})

test('only application native login/error pages load the guarded address helper before rendering', () => {
  const template = readFileSync(new URL('template.ftl', theme), 'utf8')
  assert.match(template, /<#if \(pageId == "login" \|\| pageId == "error"\) && client\?\? && client\.clientId == "store-ops-admin-web">\s*<script src="\$\{url\.resourcesPath\}\/js\/login-address\.js"><\/script>/)
  assert.ok(template.indexOf('/js/login-address.js') < template.indexOf('properties.styles'))
  assert.match(template, /action="\$\{url\.loginAction\}" method="post"/)
  assert.match(template, /startSessionPolling\(\$\{url\.ssoLoginInOtherTabsUrl\?c\}\)/)
  assert.match(template, /checkAuthSession\(\$\{authenticationSession\.authSessionIdHash\?c\}\)/)
})

test('account completion is restricted to finished successful application actions and keeps native continuations', () => {
  const info = readFileSync(new URL('info.ftl', theme), 'utf8')
  assert.match(info, /client\.clientId == "store-ops-admin-web"/)
  assert.match(info, /messageHeader == "accountUpdatedTitle"/)
  assert.match(info, /message\.type == "success"/)
  assert.match(info, /\(requiredActions!\[\]\)\?size == 0/)
  assert.match(info, /!\(actionUri!""\)\?has_content/)
  assert.match(info, /id="axis-login-return"[^>]*href="\/auth\/login"/)
  assert.match(info, /<#if !skipLink\?\?>/)
  for (const target of ['pageRedirectUri', 'actionUri', 'client.baseUrl']) {
    assert.ok(info.includes(`href="\${${target}}"`))
  }
  const tr = readFileSync(new URL('messages/messages_tr.properties', theme), 'utf8')
  assert.match(tr, /^axisAccountCompleteTitle=İşlemler tamamlandı$/m)
  assert.match(tr, /^axisAccountCompleteLogin=Giriş yap$/m)
})

test('native errors retain support tracing, sanitization, skip-link and other-client continuations', () => {
  const error = readFileSync(new URL('error.ftl', theme), 'utf8')
  assert.match(error, /kcSanitize\(message\.summary\)/)
  assert.match(error, /<#if traceId\?\?>/)
  assert.match(error, /msg\("traceIdSupportMessage", traceId\)/)
  assert.match(error, /<#if !skipLink\?\?>/)
  assert.match(error, /client\.clientId == "store-ops-admin-web"/)
  assert.match(error, /id="axis-error-login-return"[^>]*href="\/auth\/login"/)
  assert.match(error, /id="backToApplication" href="\$\{client\.baseUrl\}"/)
})
