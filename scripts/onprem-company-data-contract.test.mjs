import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
test('company overlay is explicit and base runtime remains synthetic', () => {
  const base = read('infra/onprem/core/compose.yaml')
  const overlay = read('infra/onprem/core/compose.company-data.yaml')
  assert.doesNotMatch(base, /HR_AXIS_COMPANY_DATA_ENABLED/)
  assert.match(base, /HR_AXIS_DATA_CLASS: synthetic/)
  assert.match(overlay, /HR_AXIS_STRICT_LOCAL: "true"/)
  assert.match(overlay, /HR_AXIS_DATA_CLASS: company/)
  assert.match(overlay, /HR_AXIS_COMPANY_DATA_ENABLED: "true"/)
  assert.deepEqual([...overlay.split('\nnetworks:')[0].matchAll(/^  ([a-z-]+):$/gm)].map(match => match[1]),
    ['api', 'worker', 'migrator', 'synthetic-seed', 'identity-binder', 'keycloak-bootstrap', 'caddy', 'frontend', 'keycloak', 'smtp-egress', 'redis', 'postgres'])
  assert.match(overlay, /com\.hr-axis\.data-class: company/)
  assert.equal((overlay.match(/labels: \*company-labels/g) ?? []).length, 18)
  const relay = overlay.match(/^  smtp-egress:\n[\s\S]*?(?=^  redis:\n)/m)?.[0]
  assert.ok(relay)
  assert.doesNotMatch(overlay.replace(relay, ''), /\b(?:ports|secrets|privileged|cap_add|command|entrypoint):/)
  assert.match(overlay, /smtp\.office365\.com=172\.30\.10\.40/)
  assert.match(overlay, /smtp-egress:\n        condition: service_healthy/)
  assert.match(relay, /image: \$\{HR_AXIS_BACKEND_IMAGE:\?/)
  assert.match(relay, /command: \["dist\/src\/onprem\/smtp-egress-proxy\.js"\]/)
  assert.match(relay, /ipv4_address: 172\.30\.0\.40/)
  assert.match(relay, /ipv4_address: 172\.30\.10\.40/)
  assert.match(relay, /read_only: true/)
  assert.match(relay, /cap_drop: \[ALL\]/)
  assert.match(relay, /security_opt: \[no-new-privileges:true\]/)
  assert.doesNotMatch(relay, /\b(?:ports|secrets|privileged|cap_add):/)
  const proxy = read('backend/nestjs/src/onprem/smtp-egress-proxy.ts')
  assert.match(proxy, /const OFFICE365_HOST = "smtp\.office365\.com"/)
  assert.match(proxy, /const OFFICE365_PORT = 587/)
})

test('company mode keeps synthetic initialization closed at process and database boundaries', () => {
  const mode = read('backend/nestjs/src/shared/strict-local-data-class.ts')
  const seed = read('backend/nestjs/src/onprem/synthetic-seed.service.ts')
  assert.match(mode, /role === "synthetic-seed" \|\| role === "identity-binder"/)
  assert.match(seed, /LOCK TABLE ops\.company IN SHARE ROW EXCLUSIVE MODE/)
  assert.ok(seed.indexOf('target.rows.length') < seed.indexOf('client.query(seed.sql)'))
  const bootstrap = read('infra/onprem/core/keycloak/bootstrap.sh')
  assert.match(bootstrap, /HR_AXIS_DATA_CLASS/)
  assert.match(bootstrap, /synthetic/)
})

test('application admin deep links reach only the frontend before the Keycloak admin denial', () => {
  const caddy = read('infra/onprem/core/caddy/Caddyfile')
  const route = caddy.match(/@appAdmin path ([^\n]+)\n    handle @appAdmin \{\n      reverse_proxy frontend:8080\n    \}/)
  assert.ok(route)
  const paths = route[1].split(' ')
  assert.ok(paths.includes('/admin/master-data'))
  assert.ok(paths.includes('/admin/operations'))
  for (const denied of ['/admin', '/admin/*', '/admin/realms', '/admin/realms/*', '/admin/master/console', '/admin/master/*']) assert.ok(!paths.includes(denied))
  assert.ok(caddy.indexOf('handle @appAdmin') < caddy.indexOf('respond @keycloakAdmin'))
  assert.match(caddy, /respond @keycloakAdmin `\{"error":"not_found"\}` 404/)
})
