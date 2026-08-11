import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const attributes = readFileSync('.gitattributes', 'utf8')

test('on-prem executable and mutation-test inputs keep LF bytes across platforms', () => {
  for (const rule of [
    '*.sh text eol=lf',
    '*.mjs text eol=lf',
    '*.yml text eol=lf',
    '*.yaml text eol=lf',
    '*.json text eol=lf',
    '*.Dockerfile text eol=lf',
    'Dockerfile text eol=lf',
  ]) {
    assert.match(attributes, new RegExp(`^${rule.replaceAll('*', '\\*')}$`, 'm'))
  }

  for (const path of [
    'infra/onprem/core/keycloak/bootstrap.sh',
    'infra/onprem/core/compose.yaml',
    'infra/onprem/core/keycloak/realm-config.json',
    '.github/workflows/onprem-image-proof.yml',
    'scripts/onprem-keycloak-contract.mjs',
  ]) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /\r\n/, `${path} must use LF bytes`)
  }
})
