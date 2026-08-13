import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')

const CORE_PROJECT_LABEL = 'com.hr-axis.project: ${HR_AXIS_PROJECT_ID:-hr-axis-onprem-core}'
const CORE_SECRET_ROOT = '${HR_AXIS_SECRET_ROOT:-./secret-files}'
const RESTORE_VOLUME_ENV = {
  postgres_data: 'OFFLINE_RESTORE_POSTGRES_VOLUME',
  redis_data: 'OFFLINE_RESTORE_REDIS_VOLUME',
  keycloak_data: 'OFFLINE_RESTORE_KEYCLOAK_VOLUME',
  keycloak_bootstrap_state: 'OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME',
  object_storage_data: 'OFFLINE_RESTORE_PHOTO_VOLUME',
}

function sources() {
  return {
    core: read('infra/onprem/core/compose.yaml'),
    photo: read('infra/onprem/photo-storage/compose.yaml'),
    restore: read('infra/onprem/offline/restore.compose.yaml'),
  }
}

function assertParameterizedProductionSources({ core, photo }) {
  const coreProjectLabels = core.match(/com\.hr-axis\.project:/g) ?? []
  assert.ok(coreProjectLabels.length >= 7, 'core should label services, networks, and volumes')
  assert.equal(
    core.match(new RegExp(CORE_PROJECT_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length,
    coreProjectLabels.length,
    'all core project labels must use HR_AXIS_PROJECT_ID',
  )
  const photoProjectLabels = photo.match(/com\.hr-axis\.project:/g) ?? []
  assert.ok(photoProjectLabels.length > 0, 'photo storage should label its service and volume')
  assert.equal(
    photo.match(new RegExp(CORE_PROJECT_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length,
    photoProjectLabels.length,
    'all photo project labels must use HR_AXIS_PROJECT_ID',
  )
  assert.doesNotMatch(core, /com\.hr-axis\.project:\s+hr-axis-onprem-core(?!\s*\})/)
  assert.doesNotMatch(photo, /com\.hr-axis\.project:\s+hr-axis-onprem-core(?!\s*\})/)

  const coreSecretPaths = core.match(/\n\s+file:\s+[^\n]+/g) ?? []
  assert.ok(coreSecretPaths.length >= 20, 'core should retain all file-backed secrets')
  for (const path of coreSecretPaths) assert.ok(path.includes(CORE_SECRET_ROOT), `secret path must use HR_AXIS_SECRET_ROOT: ${path}`)
  assert.doesNotMatch(core, /file:\s+\.\/secret-files\//)
}

function assertDefaultProductionBehavior({ core, photo }) {
  assert.match(core, /name: hr-axis-onprem-core\n/)
  assert.match(core, /ports:\n\s+- "443:8443"/)
  for (const subnet of ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']) {
    assert.match(core, new RegExp(`subnet: ${subnet.replaceAll('.', '\\.')}`))
  }
  assert.doesNotMatch(photo, /(^|\n)\s+ports:/)
  assert.match(photo, /com\.hr-axis\.project: \$\{HR_AXIS_PROJECT_ID:-hr-axis-onprem-core\}/)
}

function assertRestoreOverlay({ restore }) {
  assert.match(restore, /^services:\n/m)
  assert.match(restore, /caddy:\n\s+ports: !override \[\]/)
  for (const network of ['edge', 'proxy', 'app', 'data']) {
    const block = restore.match(new RegExp(`\\n  ${network}:\\n[\\s\\S]*?(?=\\n  (?:edge|proxy|app|data):|\\nvolumes:)`))?.[0] ?? ''
    assert.match(block, /ipam: !override\n\s+config: \[\]/, `${network} must reset to Docker-assigned IPAM`)
    assert.doesNotMatch(block, /subnet:/, `${network} restore IPAM must not retain a fixed subnet`)
  }
  for (const [volume, variable] of Object.entries(RESTORE_VOLUME_ENV)) {
    const block = restore.match(new RegExp(`\\n  ${volume}:[^\\n]*\\n[\\s\\S]*?(?=\\n  [a-z0-9_]+:|\\nsecrets:|$)`))?.[0] ?? ''
    assert.match(block, /external: true/)
    assert.match(block, new RegExp(`name: \\$\\{${variable}:\\?set the exact restore volume name\\}`))
  }
  const restorePorts = restore.match(/^\s+ports:.*$/gm) ?? []
  assert.deepEqual(restorePorts, ['    ports: !override []', '    ports: !override []'])
  assert.doesNotMatch(restore, /(^|\n)\s+-\s*"?(?:\d{1,3}\.){3}\d{1,3}:\d+:/)
}

test('offline restore contract keeps production labels, secret roots, and defaults parameterized', () => {
  const input = sources()
  assertParameterizedProductionSources(input)
  assertDefaultProductionBehavior(input)
})

test('offline restore overlay removes public Caddy exposure and all fixed core subnets', () => {
  const input = sources()
  assertRestoreOverlay(input)
})

test('offline restore contract rejects hardcoded project labels and omitted secret root', () => {
  const input = sources()
  const hardcodedProject = {
    ...input,
    core: input.core.replaceAll(CORE_PROJECT_LABEL, 'com.hr-axis.project: hr-axis-onprem-core'),
    photo: input.photo.replaceAll(CORE_PROJECT_LABEL, 'com.hr-axis.project: hr-axis-onprem-core'),
  }
  assert.throws(() => assertParameterizedProductionSources(hardcodedProject), /project label/)

  const omittedSecretRoot = {
    ...input,
    core: input.core.replace(`${CORE_SECRET_ROOT}/postgres/server.crt`, './secret-files/postgres/server.crt'),
  }
  assert.throws(() => assertParameterizedProductionSources(omittedSecretRoot), /secret path/)
})

test('offline restore contract rejects retained ports or fixed subnets', () => {
  const input = sources()
  const caddyPort = { restore: input.restore.replace('ports: !override []', 'ports:\n      - "443:8443"') }
  assert.throws(() => assertRestoreOverlay(caddyPort), /public Caddy|ports|restore overlay/i)

  const fixedSubnet = { restore: input.restore.replace('config: []', 'config:\n        - subnet: 172.30.0.0/24') }
  assert.throws(() => assertRestoreOverlay(fixedSubnet), /fixed subnet|Docker-assigned|subnet/i)
})

test('offline restore contract rejects non-external, missing, or caller-optional volume names', () => {
  const input = sources()
  const nonExternal = { restore: input.restore.replace('external: true', 'external: false') }
  assert.throws(() => assertRestoreOverlay(nonExternal), /external/)

  const missingName = { restore: input.restore.replace(/\n\s+name: \$\{OFFLINE_RESTORE_POSTGRES_VOLUME:\?set the exact restore volume name\}/, '') }
  assert.throws(() => assertRestoreOverlay(missingName), /exact restore volume name|name/)

  const optionalName = { restore: input.restore.replace(':?set the exact restore volume name', ':-restore-volume') }
  assert.throws(() => assertRestoreOverlay(optionalName), /exact restore volume name|name/)
})

test('offline restore contract rejects any newly added public object-storage port', () => {
  const input = sources()
  const addedPort = {
    restore: input.restore.replace(
      'services:\n',
      'services:\n  object-storage:\n    ports:\n      - "0.0.0.0:8333:8333"\n',
    ),
  }
  assert.throws(() => assertRestoreOverlay(addedPort), /public|port/i)
})
