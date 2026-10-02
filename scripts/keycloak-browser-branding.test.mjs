import assert from 'node:assert/strict'
import { test } from 'node:test'
import { axisLoginIconPath, assertAxisLoginIcon } from './keycloak-browser-branding.mjs'

const resource = '/resources/theme-v1/login/hr-axis/img/axis-lufian-favicon.png'
const html = (href = resource, title = 'Axis Lufian') => `<title>${title}</title><link rel="icon" type="image/png" href="${href}">`
test('browser branding validates the rendered title and only the local original-logo resource', () => {
  assert.equal(axisLoginIconPath(html(), 'axis.example.test'), resource)
  assert.equal(axisLoginIconPath(html(`https://axis.example.test${resource}`), 'axis.example.test'), resource)
  assert.throws(() => axisLoginIconPath(html(resource, 'store-ops'), 'axis.example.test'))
  for (const href of [`https://other.example.test${resource}`, `/admin${resource}`, `${resource}?token=x`, `http://axis.example.test${resource}`]) {
    assert.throws(() => axisLoginIconPath(html(href), 'axis.example.test'))
  }
})
test('the served favicon must be exactly the original PNG bytes', () => {
  const original = Buffer.from('original-logo')
  const response = { status: 200, headers: { 'content-type': 'image/png' }, bodyBuffer: original }
  assertAxisLoginIcon(response, original)
  assert.throws(() => assertAxisLoginIcon({ ...response, status: 404 }, original))
  assert.throws(() => assertAxisLoginIcon({ ...response, bodyBuffer: Buffer.from('old-logo') }, original))
})
