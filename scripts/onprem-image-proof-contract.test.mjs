import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workflow = readFileSync('.github/workflows/onprem-image-proof.yml', 'utf8')
const backendDockerfile = readFileSync('infra/onprem/images/backend.Dockerfile', 'utf8')
const frontendDockerfile = readFileSync('infra/onprem/images/frontend.Dockerfile', 'utf8')
const backendTsconfig = JSON.parse(readFileSync('backend/nestjs/tsconfig.onprem.json', 'utf8'))
const backendPackage = JSON.parse(readFileSync('backend/nestjs/package.json', 'utf8'))
const frontendVite = readFileSync('admin-web/vite.config.ts', 'utf8')
const requiredGateWorkflow = readFileSync('.github/workflows/required-release-gate.yml', 'utf8')
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
  assert.equal(
    (sameImageSmoke.match(/worker_started=true/g) ?? []).length,
    2,
  )
  assert.match(sameImageSmoke, /if test "\$worker_status" = running; then\s+if docker logs "\$worker_id" 2>&1 \| grep -F 'BullMQ worker context started' >\/dev\/null; then\s+worker_started=true\s+fi/)
  assert.match(sameImageSmoke, /elif test "\$worker_status" = exited; then\s+test "\$\(docker inspect -f '\{\{\.State\.ExitCode\}\}' "\$worker_id"\)" = 0\s+if docker logs "\$worker_id" 2>&1 \| grep -F 'BullMQ worker context started' >\/dev\/null; then\s+worker_started=true\s+fi/)
  assert.doesNotMatch(sameImageSmoke, /grep -Fq/)
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
  const fullWorkflow = workflow.split('  component_proof:')[0]
  assert.match(coreRuntimeProof, /docker image inspect hr-axis-onprem-frontend:proof/)
  assert.match(coreRuntimeProof, /docker image inspect hr-axis-onprem-backend:proof/)
  assert.doesNotMatch(workflow, /hr-axis-onprem-(?:frontend|backend):core-proof/)
  assert.equal((fullWorkflow.match(/docker build --file infra\/onprem\/images\/frontend\.Dockerfile/g) ?? []).length, 1)
  assert.equal((fullWorkflow.match(/docker build --file infra\/onprem\/images\/backend\.Dockerfile/g) ?? []).length, 1)
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

test('tiered proof workflow requires mode, image scope, and exact expected SHA inputs', () => {
  assert.match(workflow, /workflow_call:\s*\n\s+inputs:/)
  for (const input of ['proof_mode', 'image_scope', 'expected_sha']) {
    assert.match(workflow, new RegExp(`${input}:[\\s\\S]{0,180}?required:\\s*true`))
  }
  assert.match(workflow, /ref:\s*\$\{\{ inputs\.expected_sha \}\}/)
  assert.doesNotMatch(workflow, /inputs\.expected_sha\s*\|\|\s*github\.sha/)
  assert.match(workflow, /source-preflight:/)
  assert.match(workflow, /needs:\s*source-preflight/)
  assert.doesNotMatch(workflow, /onprem-proof-dispatch\.mjs verify-status/)
  const sourceGate = workflow.split('  proof:')[0]
  assert.match(sourceGate, /source-preflight:[\s\S]*permissions:[\s\S]*contents:\s*read/)
  assert.match(sourceGate, /Run bounded exact-SHA on-prem source preflight/)
  assert.match(sourceGate, /node --check scripts\/onprem-offline-target-proof\.mjs/)
  assert.match(sourceGate, /onprem-offline-target-proof\.test\.mjs/)
  assert.match(sourceGate, /onprem-image-proof-contract\.test\.mjs/)
  assert.match(sourceGate, /onprem-offline-workflow-contract\.test\.mjs/)
  assert.doesNotMatch(sourceGate, /GITHUB_EVENT_NAME|GITHUB_EXECUTION_SHA|GITHUB_TOKEN/)
  assert.doesNotMatch(workflow.slice(workflow.indexOf('  proof:')), /permissions:[\s\S]*statuses:\s*read/)
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/)
  assert.match(workflow, /proof_mode:\s*\n\s+description:/)
  assert.match(workflow, /image_scope:\s*\n\s+description:/)
  assert.match(workflow, /evidence_sha:/)
  assert.match(workflow, /receipt_sha256:/)
  assert.match(workflow, /proven_sha:/)
  assert.match(workflow, /\[\[ "\$EXPECTED_SHA" =~ \^\[a-f0-9\]\{40\}\$ \]\]/)
  assert.equal((workflow.match(/proven_sha: \$\{\{ steps\.emit-proof-output\.outputs\.proven_sha \}\}/g) ?? []).length, 2)
  assert.equal((workflow.match(/echo "proven_sha=\$EXPECTED_SHA"/g) ?? []).length, 2)
})

test('manual dispatch is fail-closed with full/both defaults bound to the dispatched SHA', () => {
  const dispatch = workflow.match(/  workflow_dispatch:[\s\S]*?\n\npermissions:/)?.[0] ?? ''
  assert.match(dispatch, /proof_mode:[\s\S]{0,220}?required:\s*false[\s\S]{0,220}?default:\s*full/)
  assert.match(dispatch, /image_scope:[\s\S]{0,220}?required:\s*false[\s\S]{0,220}?default:\s*both/)
  assert.match(dispatch, /expected_sha:[\s\S]{0,220}?required:\s*true/)
  assert.match(workflow, /EXPECTED_SHA:\s*\$\{\{ inputs\.expected_sha \}\}/)
  for (const artifact of ['onprem-core-runtime-proof', 'onprem-keycloak-runtime-proof', 'onprem-photo-storage-proof', 'onprem-image-proof', 'onprem-image-component-proof']) {
    const artifactIndex = workflow.indexOf(`name: ${artifact}-`)
    assert.ok(artifactIndex >= 0, `${artifact} upload is required`)
    assert.match(workflow.slice(artifactIndex, artifactIndex + 120), /\$\{\{ github\.sha \}\}/)
  }
  assert.doesNotMatch(workflow, /name:\s*onprem-(?:core-runtime-proof|keycloak-runtime-proof|photo-storage-proof|image-proof|image-component-proof)-\$\{\{ inputs\.expected_sha \}\}/)
  assert.match(workflow, /case "\$PROOF_MODE:\$IMAGE_SCOPE" in\s+full:both\|component:frontend\|component:backend\|component:both\) ;;\s+\*\) exit 1 ;;\s+esac/)
  assert.doesNotMatch(workflow, /case "\$PROOF_MODE:\$IMAGE_SCOPE" in[\s\S]{0,180}full:frontend/)
})

test('tiered selector wiring passes exact scope and SHA to reusable proof and exports child evidence identity', () => {
  assert.match(requiredGateWorkflow, /proof_mode:\s*\$\{\{ needs\.scope\.outputs\.proof_mode \}\}/)
  assert.match(requiredGateWorkflow, /image_scope:\s*\$\{\{ needs\.scope\.outputs\.image_scope \}\}/)
  assert.match(requiredGateWorkflow, /expected_sha:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_MODE:/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_SCOPE:/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_EVIDENCE_SHA:/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_RECEIPT_SHA256:/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_ONPREM_IMAGE_PROOF_PROVEN_SHA:/)
  assert.match(requiredGateWorkflow, /REQUIRED_RELEASE_GATE_EXPECTED_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/)
})

test('full proof retains every existing expensive runtime and artifact stage', () => {
  const expectedSteps = [
    'Pull pinned Keycloak base and build the optimized ONP-3B image',
    'Build dedicated images with synthetic inputs',
    'Prove ONP-2 static Compose, network, and firewall contracts',
    'Prove ONP-3B production-shaped Keycloak contracts',
    'Prove non-root image users',
    'Prove capability-free Caddy bootstrap under production restrictions',
    'Prove the pruned backend dependency graph and lazy runtime features',
    'Start frontend with read-only root and least privilege',
    'Start API and worker from the same backend image',
    'Generate SPDX SBOMs with pinned Syft',
    'Fail closed on image vulnerabilities and secrets with pinned Trivy',
    'Export final filesystems and layers then run content guards',
    'Generate production license inventories and notices',
    'Generate sanitized Keycloak image manifest',
    'Self-test signed synthetic release manifest',
    'Prepare UID-bound ephemeral synthetic secret files',
    'Run mandatory fresh-volume core proof behind a reversible firewall',
    'Upload sanitized runtime receipt',
    'Upload sanitized Keycloak runtime receipt',
    'Upload sanitized proof artifacts',
  ]
  for (const step of expectedSteps) {
    assert.equal((workflow.match(new RegExp(`- name: ${step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length, 1, step)
  }
  assert.match(workflow, /KEYCLOAK_IMAGE_ID/)
  assert.match(workflow, /onprem-core-runtime-receipt\.json/)
  assert.match(workflow, /onprem-keycloak-runtime-receipt\.json/)
  assert.match(workflow, /proof\/release-manifest\.json/)
})

test('component proof has selected-image build, runtime, SBOM, scan, layer, and license evidence', () => {
  const component = workflow.split('  component_proof:')[1] ?? ''
  assert.match(component, /if:\s*inputs\.proof_mode == 'component'/)
  assert.match(component, /docker build --file infra\/onprem\/images\/frontend\.Dockerfile/)
  assert.match(component, /docker build --file infra\/onprem\/images\/backend\.Dockerfile/)
  assert.match(component, /--read-only --cap-drop=ALL --security-opt=no-new-privileges:true/)
  assert.match(component, /curl --fail --silent http:\/\/127\.0\.0\.1:18080\/health/)
  assert.match(component, /require\.resolve\(name\)/)
  assert.match(component, /lazy-runtime-smoke=ok/)
  assert.match(component, /BullMQ worker context started/)
  assert.match(component, /SYFT_IMAGE/)
  assert.match(component, /TRIVY_IMAGE/)
  assert.match(component, /--scanners vuln,secret/)
  assert.match(component, /onprem-image-content-guard\.mjs --rootfs/)
  assert.match(component, /onprem-third-party-notices\.mjs/)
  assert.match(component, /onprem-image-license-reconciliation\.mjs/)
  assert.match(component, /component-evidence\.json/)
  assert.match(component, /onprem-proof-receipt\.json/)
  assert.match(component, /echo "evidence_sha=/)
  assert.match(component, /echo "receipt_sha256=/)
  assert.match(component, /echo "proven_sha=\$EXPECTED_SHA"/)
})

test('component receipt binds selected image IDs and every selected evidence digest', () => {
  const component = workflow.split('  component_proof:')[1] ?? ''
  const emit = component.split('- name: Emit fresh component proof identity and receipt')[1]?.split('- name: Upload sanitized component proof artifacts')[0] ?? ''
  assert.match(emit, /docker', \['image', 'inspect', `hr-axis-onprem-\$\{image\}:component-proof`/)
  assert.match(emit, /const imageId =/)
  assert.match(emit, /imageId,/)
  assert.match(emit, /artifacts: paths\.map/)
  assert.match(emit, /bytes: statSync\(pathname\)\.size, sha256: sha256\(pathname\)/)
  assert.match(emit, /evidence\.baseLicenseEvidence =/)
  assert.match(emit, /imageIds: Object\.fromEntries/)
  assert.match(emit, /evidenceSha/)
  assert.match(emit, /proof\/component-proof-digests\.env/)
  assert.doesNotMatch(emit, /const receipt = \{ proofMode: 'component', imageScope: scope, expectedSha \}/)
})

test('on-prem Dockerfiles expose every application input copied into production images', () => {
  assert.match(frontendDockerfile, /COPY admin-web\/package\*\.json \.\/admin-web\//)
  assert.match(frontendDockerfile, /COPY admin-web\/ \.\/admin-web\//)
  assert.match(backendDockerfile, /COPY backend\/nestjs\/package\*\.json \.\//)
  assert.match(backendDockerfile, /COPY backend\/nestjs\/ \.\//)
  assert.match(backendDockerfile, /COPY db\/schema\.sql \/app\/db\/schema\.sql/)
  assert.match(backendDockerfile, /COPY db\/migrations\/ \/app\/db\/migrations\//)
  assert.match(backendDockerfile, /COPY db\/seeds\/001_reference_seed\.sql/)
  assert.match(backendDockerfile, /COPY db\/seeds\/002_onprem_keycloak_personas\.sql/)
})
