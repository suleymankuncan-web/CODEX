import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workflow = readFileSync('.github/workflows/onprem-image-proof.yml', 'utf8')
const backendDockerfile = readFileSync('infra/onprem/images/backend.Dockerfile', 'utf8')
const frontendDockerfile = readFileSync('infra/onprem/images/frontend.Dockerfile', 'utf8')
const backendTsconfig = JSON.parse(readFileSync('backend/nestjs/tsconfig.onprem.json', 'utf8'))
const backendPackage = JSON.parse(readFileSync('backend/nestjs/package.json', 'utf8'))
const frontendVite = readFileSync('admin-web/vite.config.ts', 'utf8')
const sameImageSmoke = workflow
  .split('- name: Start API and worker from the same backend image')[1]
  ?.split('- name: Generate SPDX SBOMs with pinned Syft')[0] ?? ''
const coreRuntimeProof = workflow
  .split('- name: Prepare UID-bound ephemeral synthetic secret files')[1]
  ?.split('- name: Upload sanitized runtime receipt')[0] ?? ''

test('ONP-1 images use immutable bases, non-root users, and no source-bearing OCI label', () => {
  for (const dockerfile of [backendDockerfile, frontendDockerfile]) {
    assert.match(dockerfile, /FROM\s+\S+@sha256:[0-9a-f]{64}/i)
    assert.match(dockerfile, /\bUSER\s+(?:nonroot|[1-9][0-9]*)\b/)
    assert.doesNotMatch(dockerfile, /org\.opencontainers\.image\.source/)
  }
  assert.doesNotMatch(backendDockerfile, /node_modules[^\n]*-iname 'build'/)
  assert.doesNotMatch(backendDockerfile, /node_modules[^\n]*\*\.txt/)
})

test('ONP-1 workflow proves read-only API and worker startup from one image', () => {
  assert.match(workflow, /--read-only/)
  assert.match(workflow, /--cap-drop=ALL/)
  assert.match(workflow, /--security-opt=no-new-privileges:true/)
  assert.match(workflow, /docker inspect -f '\{\{\.State\.Status\}\}' "\$api_id"\)" = running/)
  assert.match(workflow, /curl --fail --silent http:\/\/127\.0\.0\.1:18082\/api\/health\/live/)
  assert.match(workflow, /docker inspect -f '\{\{\.State\.ExitCode\}\}' "\$worker_id"\)" = 0/)
  assert.match(workflow, /BullMQ worker context started/)
  assert.match(workflow, /hr-axis-onprem-backend:proof dist\/src\/workers\.js/)
  assert.match(workflow, /Prove the pruned backend dependency graph and lazy runtime features/)
  assert.match(workflow, /require\.resolve\(name\)/)
  assert.match(workflow, /lazy-runtime-smoke=ok/)
  assert.match(workflow, /require\('sharp'\)/)
  assert.match(workflow, /require\('@e965\/xlsx'\)/)
  assert.match(workflow, /require\('@aws-sdk\/client-s3'\)/)
  assert.match(sameImageSmoke, /HR_AXIS_STRICT_LOCAL=false/)
  assert.doesNotMatch(sameImageSmoke, /HR_AXIS_STRICT_LOCAL=true/)
  assert.equal(backendPackage.dependencies['@nestjs/swagger'], '^11.4.6')
  assert.equal(backendPackage.devDependencies['@nestjs/swagger'], undefined)
  assert.equal(backendPackage.overrides['@nestjs/swagger']['js-yaml'], '5.2.3')
})

test('ONP-1 proof is reusable by the fail-closed required gate and binds manifest bases to Dockerfile pins', () => {
  assert.match(workflow, /workflow_call:\s*\n/)
  assert.doesNotMatch(workflow, /^\s*pull_request:/m)
  assert.match(workflow, /uses:\s*actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803\s+# v6/)
  assert.match(workflow, /uses:\s*actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38\s+# v6/)
  assert.match(workflow, /uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\s+# v4/)
  assert.match(workflow, /node-version:\s*24\.19\.0/)
  assert.match(workflow, /FROM \$BUILD_IMAGE AS dependencies/)
  assert.match(workflow, /FROM \$BUILD_IMAGE AS build/)
  assert.match(workflow, /FROM \$BACKEND_RUNTIME_IMAGE AS runtime/)
  assert.match(workflow, /FROM \$FRONTEND_RUNTIME_IMAGE AS runtime/)
})

test('ONP-2 runtime proof executes the exact image identities scanned and bound to the manifest', () => {
  assert.match(coreRuntimeProof, /docker image inspect hr-axis-onprem-frontend:proof/)
  assert.match(coreRuntimeProof, /docker image inspect hr-axis-onprem-backend:proof/)
  assert.doesNotMatch(workflow, /hr-axis-onprem-(?:frontend|backend):core-proof/)
  assert.equal((workflow.match(/docker build --file infra\/onprem\/images\/frontend\.Dockerfile/g) ?? []).length, 1)
  assert.equal((workflow.match(/docker build --file infra\/onprem\/images\/backend\.Dockerfile/g) ?? []).length, 1)
})

test('ONP-1 workflow self-tests with an external public-key file and defers the owner trust anchor to ONP-5', () => {
  assert.doesNotMatch(workflow, /BUILD_TIMESTAMP=synthetic/)
  assert.match(workflow, /docker image inspect hr-axis-onprem-frontend:proof --format '\{\{\.Id\}\}'/)
  assert.match(workflow, /docker image inspect hr-axis-onprem-backend:proof --format '\{\{\.Id\}\}'/)
  assert.match(workflow, /buildTimestamp:\s*process\.env\.BUILD_TIMESTAMP/)
  assert.match(workflow, /configSchemaVersion:\s*1/)
  assert.match(workflow, /imageIds:/)
  assert.match(workflow, /--public-key/)
  assert.match(workflow, /not the owner trust anchor/i)
  assert.match(workflow, /ONP-5 supplies and/i)
  assert.match(workflow, /pins the owner-controlled offline signing and verification keys/i)
  assert.match(workflow, /trap ['"]rm -f/)
  assert.doesNotMatch(workflow, /proof\/ephemeral-private\.pem/)
})

test('ONP-1 reconciles every final-image SBOM component and requires complete license text evidence', () => {
  assert.match(workflow, /npm ci --prefix tools\/onprem-license --ignore-scripts/)
  assert.match(workflow, /--node-modules proof\/backend-rootfs\/app\/node_modules/)
  assert.match(workflow, /onprem-image-license-reconciliation\.mjs/)
  assert.match(workflow, /base-license-policy-v1\.json/)
  assert.match(workflow, /--spdx-license-directory/)
  assert.match(workflow, /backendImageLicenseReconciliation:/)
  assert.match(workflow, /frontendImageLicenseReconciliation:/)
  assert.match(workflow, /backendImageNotices:/)
  assert.match(workflow, /frontendImageNotices:/)
  assert.match(workflow, /tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner/)
  assert.match(workflow, /-cf proof\/base-license-evidence\.tar -C proof\/base-license-evidence \./)
  assert.match(workflow, /baseLicenseEvidenceBundle:\s*'proof\/base-license-evidence\.tar'/)
  assert.match(workflow, /proof\/base-license-evidence\.tar/)
})

test('ONP-1 explicitly disables frontend and backend source maps', () => {
  assert.equal(backendTsconfig.compilerOptions.sourceMap, false)
  assert.equal(backendTsconfig.compilerOptions.inlineSourceMap, false)
  assert.equal(backendTsconfig.compilerOptions.inlineSources, false)
  assert.match(frontendVite, /sourcemap:\s*false/)
  assert.match(frontendDockerfile, /ARG VITE_API_BASE_URL=\/api/)
  assert.doesNotMatch(frontendDockerfile, /ARG VITE_API_BASE_URL=http:\/\/api:3000/)
})

test('ONP-3B frontend image pins OIDC to the secure cookie-session transport', () => {
  assert.match(frontendDockerfile, /VITE_AUTH_MODE=bearer/)
  assert.match(frontendDockerfile, /VITE_AUTH_PROVIDER=oidc/)
  assert.match(frontendDockerfile, /VITE_BROWSER_SESSION_TRANSPORT=cookie/)
  assert.match(frontendDockerfile, /VITE_SENTRY_ENABLED=false/)
})

test('ONP runtime cleanup uses guarded exact-project CLIs and still restores the firewall on cleanup failure', () => {
  const cleanup = coreRuntimeProof.split('          cleanup() {')[1]?.split('          trap cleanup EXIT')[0] ?? ''
  assert.match(cleanup, /onprem-keycloak-runtime-proof\.mjs --cleanup/)
  assert.match(cleanup, /onprem-core-runtime-proof\.mjs --cleanup/)
  assert.match(cleanup, /--project hr-axis-onprem-keycloak/)
  assert.match(cleanup, /--project hr-axis-onprem-core/)
  assert.match(cleanup, /--release-id "\$RELEASE_ID"/)
  assert.match(cleanup, /iptables-restore < "\$firewall_snapshot"/)
  assert.match(cleanup, /cleanup_status/)
  assert.match(cleanup, /return "\$cleanup_status"/)
  assert.doesNotMatch(cleanup, /docker compose[^\n]*down --remove-orphans/)
  assert.doesNotMatch(cleanup, /--cleanup[^\n]*\|\| true/)
})

test('ONP image proof keeps shell heredocs inside their YAML run blocks', () => {
  const lines = workflow.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const opener = lines[index].match(/^(\s*).*<<-?\s*['"]?([A-Z][A-Z0-9_]*)['"]?\s*$/)
    if (!opener) continue

    const [, , delimiter] = opener
    const runBlockIndex = lines.findLastIndex(
      (line, candidateIndex) => candidateIndex < index && /^\s*run:\s*\|\s*$/.test(line),
    )
    assert.notEqual(runBlockIndex, -1, `missing YAML run block before heredoc at line ${index + 1}`)
    const runIndentation = lines[runBlockIndex].match(/^\s*/)?.[0].length ?? 0
    const requiredIndentation = runIndentation + 2
    const closingIndex = lines.findIndex(
      (line, candidateIndex) => candidateIndex > index && line.trim() === delimiter,
    )
    assert.notEqual(closingIndex, -1, `missing ${delimiter} heredoc delimiter after line ${index + 1}`)

    for (let bodyIndex = index + 1; bodyIndex <= closingIndex; bodyIndex += 1) {
      const line = lines[bodyIndex]
      if (line.length === 0) continue
      const bodyIndentation = line.match(/^\s*/)?.[0].length ?? 0
      assert.ok(
        bodyIndentation >= requiredIndentation,
        `${delimiter} heredoc escaped its YAML run block at line ${bodyIndex + 1}`,
      )
    }
    index = closingIndex
  }
})

test('ONP-3B content guard invokes keycloak kind for the final image and every layer', () => {
  const keycloakGuardCalls = (workflow.match(/node scripts\/onprem-image-content-guard\.mjs --rootfs[^\n]+/g) ?? [])
    .filter((call) => /keycloak-rootfs|keycloak_layer_root/.test(call))
  assert.equal(keycloakGuardCalls.length, 2)
  for (const call of keycloakGuardCalls) {
    assert.match(call, /--kind keycloak/)
    assert.match(call, /--application-root \/opt\/keycloak/)
  }
})
