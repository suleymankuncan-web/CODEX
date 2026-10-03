import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { validateOnpremKeycloakContract } from './onprem-keycloak-contract.mjs'

const read = (path) => readFileSync(path, 'utf8')
const bootstrap = () => read('infra/onprem/core/keycloak/bootstrap.sh')
const uuid = '11111111-2222-4333-8444-555555555555'
const resourcePolicy = {
  clientId: 'store-ops-api', enabled: true, protocol: 'openid-connect',
  publicClient: false, bearerOnly: true, standardFlowEnabled: false,
  implicitFlowEnabled: false, directAccessGrantsEnabled: false,
  serviceAccountsEnabled: false, fullScopeAllowed: false,
  redirectUris: [], webOrigins: [], defaultClientScopes: [], optionalClientScopes: [],
}
function contractInput() {
  return {
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    keycloakDockerfile: read('infra/onprem/images/keycloak.Dockerfile'),
    bootstrapScript: bootstrap(), bootstrapSql: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'), compose: read('infra/onprem/core/compose.yaml'),
    photoProofCompose: read('infra/onprem/core/compose.photo-proof.yaml'), workflow: read('.github/workflows/onprem-image-proof.yml'),
    envTemplate: read('infra/onprem/core/env.template'), realmConfig: read('infra/onprem/core/keycloak/realm-config.json'),
    personaSeed: read('db/seeds/002_onprem_keycloak_personas.sql'),
  }
}
function runReconciliation(mode, patch = {}) {
  const source = bootstrap()
  const helper = source.match(/^reconcile_api_audience_client\(\) \{[\s\S]*?^\}/m)?.[0]
  const csv = source.match(/^csv_first_fields_matching_second\(\) \{[\s\S]*?^\}/m)?.[0]
  assert.ok(helper, 'bootstrap must reconcile the registered API audience target')
  assert.ok(csv, 'exact CSV identity selector must exist')
  const root = mkdtempSync(join(tmpdir(), 'onprem-api-audience-'))
  try {
    const state = JSON.stringify({ id: uuid, ...resourcePolicy, ...patch })
    const script = `
set -eu
umask 077
tmp_dir="$1"
mode="$2"
realm=store-ops
die() { printf '%s\\n' "$1" >&2; exit 42; }
${csv}
kcadm_query() {
  if [ "$1:$2" = 'get:clients' ]; then
    printf '%s\\n' inventory >> "$tmp_dir/events"
    case "$mode" in
      duplicate) printf '%s\\n' '${uuid},store-ops-api' '22222222-2222-4333-8444-555555555555,store-ops-api';;
      invalid-id) printf '%s\\n' '../other-client,store-ops-api';;
      missing|create-failed)
        if [ -f "$tmp_dir/created" ]; then printf '%s\\n' '${uuid},store-ops-api'; else printf '%s\\n' 'id,clientId'; fi;;
      unresolved) printf '%s\\n' 'id,clientId';;
      wrong-name) printf '%s\\n' '${uuid},store-ops-api-shadow';;
      query-failed) printf '%s\\n' 'password=private-fixture-value' >&2; return 1;;
      *) printf '%s\\n' '${uuid},store-ops-api';;
    esac
  elif [ "$1:$2" = 'get:clients/${uuid}' ]; then
    printf '%s\\n' readback >> "$tmp_dir/events"
    if [ "$mode" = readback-failed ]; then printf '%s\\n' 'password=private-fixture-value' >&2; return 1; fi
    printf '%s\\n' "$MOCK_API_STATE"
  else
    printf '%s\\n' unexpected-query >> "$tmp_dir/events"; return 1
  fi
}
kcadm_quiet() {
  printf '%s\\n' "$1:$2" >> "$tmp_dir/events"
  [ "$1:$2" = create:clients ] || return 1
  [ "$mode" != create-failed ] || return 1
  : > "$tmp_dir/created"
}
${helper}
reconcile_api_audience_client
`
    const result = spawnSync('sh', ['-c', script, 'sh', root, mode], {
      encoding: 'utf8', env: { ...process.env, MOCK_API_STATE: state },
    })
    let events = ''
    try { events = readFileSync(join(root, 'events'), 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
    let createdPolicy = null
    try { createdPolicy = JSON.parse(readFileSync(join(root, 'api-audience-client.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
    return { ...result, events, createdPolicy }
  } finally { rmSync(root, { recursive: true, force: true }) }
}

test('API audience target is registered without authentication or token-grant flows', () => {
  const realm = JSON.parse(read('infra/onprem/core/keycloak/realm-config.json'))
  const clients = realm.clients.filter((client) => client.clientId === 'store-ops-api')
  assert.equal(clients.length, 1)
  for (const [key, value] of Object.entries(resourcePolicy)) assert.deepEqual(clients[0][key], value, key)
  assert.equal(clients[0].secret, undefined)
  const source = bootstrap()
  const invocation = source.indexOf('\nreconcile_api_audience_client\n')
  assert.ok(invocation > 0)
  assert.ok(invocation < source.indexOf('\ncreate_or_update_mapper store-ops-api-audience '))
  assert.match(source, /"included\.client\.audience":"store-ops-api"/)
  assert.doesNotMatch(source, /included\.custom\.audience/)
  assert.match(read('scripts/onprem-keycloak-auth-proof.mjs'), /if \(!audiences\.includes\('store-ops-api'\)\) throw new Error\('OIDC access token audience contract failed'\)/)
})

test('missing API audience target is created once and read back with least privilege', () => {
  const result = runReconciliation('missing')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(result.events.match(/create:clients/g)?.length, 1)
  assert.match(result.events, /readback/)
  for (const [key, value] of Object.entries(resourcePolicy)) assert.deepEqual(result.createdPolicy[key], value, key)
  assert.equal(result.createdPolicy.secret, undefined)
})

test('existing approved API audience target is verified without updating or recreating it', () => {
  const result = runReconciliation('present')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.doesNotMatch(result.events, /(?:create|update|delete):/)
  assert.match(result.events, /readback/)
})

test('disabled or overprivileged existing API audience targets fail closed without mutation', () => {
  for (const patch of [
    { enabled: false }, { bearerOnly: false }, { publicClient: true },
    { standardFlowEnabled: true }, { implicitFlowEnabled: true },
    { directAccessGrantsEnabled: true }, { serviceAccountsEnabled: true },
    { fullScopeAllowed: true }, { protocol: 'saml' }, { clientId: 'other-api' },
    { id: '22222222-2222-4333-8444-555555555555' },
    { redirectUris: ['https://example.invalid'] }, { webOrigins: ['*'] },
    { defaultClientScopes: ['roles'] }, { optionalClientScopes: ['offline_access'] },
  ]) {
    const result = runReconciliation('present', patch)
    assert.equal(result.status, 42, JSON.stringify(patch))
    assert.doesNotMatch(result.events, /(?:create|update|delete):/)
    assert.equal(result.stdout, '')
  }
})

test('API audience inventory rejects duplicates and invalid IDs before mutation', () => {
  for (const mode of ['duplicate', 'invalid-id', 'query-failed']) {
    const result = runReconciliation(mode)
    assert.equal(result.status, 42, mode)
    assert.doesNotMatch(result.events, /(?:create|update|delete):/)
    assert.equal(result.stdout, '')
    assert.doesNotMatch(result.stderr, /private-fixture-value/)
  }
})

test('API audience creation and metadata failures preserve a sanitized failure', () => {
  for (const mode of ['create-failed', 'unresolved', 'wrong-name', 'readback-failed']) {
    const result = runReconciliation(mode)
    assert.equal(result.status, 42, mode)
    assert.doesNotMatch(result.events, /(?:update|delete):/)
    assert.equal(result.stdout, '')
    assert.doesNotMatch(result.stderr, /private-fixture-value/)
  }
})

test('source contract rejects missing, duplicate, or overprivileged API audience fixtures', () => {
  const baseline = contractInput()
  assert.equal(validateOnpremKeycloakContract(baseline).ok, true)
  for (const mutate of [
    (realm) => { realm.clients = realm.clients.filter((c) => c.clientId !== 'store-ops-api') },
    (realm) => { realm.clients.push({ ...resourcePolicy }) },
    ...['enabled', 'bearerOnly', 'publicClient', 'standardFlowEnabled', 'implicitFlowEnabled', 'directAccessGrantsEnabled', 'serviceAccountsEnabled', 'fullScopeAllowed'].map((key) => (realm) => {
      const client = realm.clients.find((c) => c.clientId === 'store-ops-api'); client[key] = !resourcePolicy[key]
    }),
  ]) {
    const realm = JSON.parse(baseline.realmConfig); mutate(realm)
    const result = validateOnpremKeycloakContract({ ...baseline, realmConfig: JSON.stringify(realm) })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((message) => /API audience/.test(message)))
  }
})

test('source contract rejects removing or weakening the API audience reconciliation', () => {
  const baseline = contractInput()
  for (const source of [
    baseline.bootstrapScript.replace(/^reconcile_api_audience_client$/m, ''),
    baseline.bootstrapScript.replace('"bearerOnly":true', '"bearerOnly":false'),
    baseline.bootstrapScript.replace("kcadm_quiet create clients -r \"$realm\" -f \"$api_client_file\"", "kcadm_quiet update clients -r \"$realm\" -f \"$api_client_file\""),
  ]) {
    assert.notEqual(source, baseline.bootstrapScript)
    const result = validateOnpremKeycloakContract({ ...baseline, bootstrapScript: source })
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((message) => /API audience/.test(message)))
  }
})
