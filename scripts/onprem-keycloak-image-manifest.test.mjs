import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createKeycloakImageManifest } from './onprem-keycloak-image-manifest.mjs'

const baseImage = 'quay.io/keycloak/keycloak:26.7.2@sha256:9d1f1b2b7261ff53c66cb1092dfcdc34a5fb77e81f9e6a6e75b8b6a795de8067'

test('Keycloak image manifest binds immutable image, SBOM, vulnerability, content, and license evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-manifest-'))
  try {
    const files = {}
    for (const name of ['sbom', 'trivy', 'license', 'licenseText', 'licensePaths', 'licenseReconciliation', 'licenseBundle', 'content']) {
      files[name] = join(root, `${name}.evidence`)
      writeFileSync(files[name], `${name}:synthetic\n`)
    }
    const manifest = createKeycloakImageManifest({
      baseImage,
      image: `hr-axis-onprem-keycloak@sha256:${'a'.repeat(64)}`,
      imageId: `sha256:${'b'.repeat(64)}`,
      ...files,
    })
    assert.equal(manifest.dataClass, 'synthetic')
    assert.deepEqual(Object.keys(manifest.artifacts).sort(), ['content', 'license', 'licenseBundle', 'licensePaths', 'licenseReconciliation', 'licenseText', 'sbom', 'trivy'])
    for (const artifact of Object.values(manifest.artifacts)) assert.match(artifact.sha256, /^[0-9a-f]{64}$/)
    assert.throws(() => createKeycloakImageManifest({ ...files, baseImage, image: 'hr-axis-onprem-keycloak:latest', imageId: `sha256:${'b'.repeat(64)}` }), /immutable/)
    assert.throws(() => createKeycloakImageManifest({ ...files, baseImage, image: `hr-axis-onprem-keycloak@sha256:${'a'.repeat(64)}`, imageId: 'not-a-digest' }), /image id/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
