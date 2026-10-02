import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildPushedAuthorizationPath } from './onprem-keycloak-auth-proof.mjs'

const reference = 'urn:ietf:params:oauth:request_uri:1234567890abcdefghijklmnopqrstuv'
test('PAR navigation carries only the browser client and a bounded reference', () => {
  const path = buildPushedAuthorizationPath({ status: 201, json: { request_uri: reference, expires_in: 60 } })
  const url = new URL(path, 'https://axis.example.test')
  assert.equal(url.pathname, '/realms/store-ops/protocol/openid-connect/auth')
  assert.deepEqual([...url.searchParams.keys()], ['client_id', 'request_uri'])
  assert.equal(url.searchParams.get('request_uri'), reference)
})

test('PAR proof rejects errors, unsafe references and expired requests', () => {
  for (const response of [
    { status: 400, json: { request_uri: reference, expires_in: 60 } },
    { status: 201, json: { request_uri: 'https://outside.example.test', expires_in: 60 } },
    { status: 201, json: { request_uri: reference, expires_in: 0 } },
    { status: 201, json: { request_uri: reference, expires_in: 601 } },
    { status: 201, json: { request_uri: reference, expires_in: '60' } },
    null,
  ]) assert.throws(() => buildPushedAuthorizationPath(response), /PAR reference contract failed/)
})

test('Caddy exposes only the exact PAR POST and preserves realm cookie paths', () => {
  const caddy = readFileSync(new URL('../infra/onprem/core/caddy/Caddyfile', import.meta.url), 'utf8')
  assert.match(caddy, /@pushedAuthorization\s*\{\s*method POST\s*path \/realms\/store-ops\/protocol\/openid-connect\/ext\/par\/request\s*\}/)
  assert.ok(caddy.indexOf('respond @keycloakAdmin') < caddy.indexOf('handle @pushedAuthorization'))
  assert.doesNotMatch(caddy, /header_down\s+Set-Cookie|rewrite.*login-actions|@axisLogin/)
  assert.match(caddy, /respond @authUnknown.*404/)
  assert.doesNotMatch(caddy, /path[^\n]*\/ext\/(?:\*|par\/\*)/)
})

test('the onprem build opts in while normal frontend builds retain their login provider', () => {
  const docker = readFileSync(new URL('../infra/onprem/images/frontend.Dockerfile', import.meta.url), 'utf8')
  assert.match(docker, /VITE_OIDC_PAR_ENABLED=true/)
  const flow = readFileSync(new URL('../admin-web/src/features/auth/auth-flow.ts', import.meta.url), 'utf8')
  assert.match(flow, /import\.meta\.env\.VITE_OIDC_PAR_ENABLED === 'true'/)
  assert.match(flow, /buildPushedAuthorizationLoginUrl\(url\)/)
})
