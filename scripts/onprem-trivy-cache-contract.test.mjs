import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const imageWorkflowPath = '.github/workflows/onprem-image-proof.yml'
const offlineWorkflowPath = '.github/workflows/onprem-offline-proof.yml'
const imageWorkflow = readFileSync(imageWorkflowPath, 'utf8')
const offlineWorkflow = readFileSync(offlineWorkflowPath, 'utf8')
const trivyRef = 'aquasec/trivy:0.72.0@sha256:cffe3f5161a47a6823fbd23d985795b3ed72a4c806da4c4df16266c02accdd6f'
const cacheBasenames = [
  'onprem-image-proof-trivy-cache',
  'onprem-image-component-trivy-cache',
  'onprem-offline-trivy-cache',
]
const allowedRunnerTempUploads = new Set([
  '${{ runner.temp }}/onprem-core-runtime-receipt.json',
  '${{ runner.temp }}/onprem-keycloak-runtime-receipt.json',
  '${{ runner.temp }}/onprem-photo-storage-runtime-receipt.json',
  '${{ runner.temp }}/onprem-bundle-archives',
  '${{ runner.temp }}/onprem-trust',
  '${{ runner.temp }}/offline-receipts',
])

function jobSection(source, name) {
  const marker = `  ${name}:`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing ${name} job`)
  const nextMatch = source.slice(start + marker.length).match(/\n  [a-z][a-z0-9_]*:\s*\n/)
  const next = nextMatch ? start + marker.length + nextMatch.index : -1
  return source.slice(start, next === -1 ? source.length : next)
}

function stepSection(job, name) {
  const marker = `      - name: ${name}`
  const start = job.indexOf(marker)
  assert.notEqual(start, -1, `missing ${name} step`)
  const nextMatch = job.slice(start + marker.length).match(/\n      - name:/)
  const next = nextMatch ? start + marker.length + nextMatch.index : -1
  return job.slice(start, next === -1 ? job.length : next)
}

function namedStepSections(source) {
  const lines = source.split(/\r?\n/)
  const starts = lines.flatMap((line, index) => (/^      - name:/.test(line) ? [index] : []))
  return starts.map((start, position) => lines.slice(start, starts[position + 1] ?? lines.length).join('\n'))
}

function trivyCommandStarts(section) {
  const lines = section.split(/\r?\n/)
  const trivyStart = /"\$(?:KEYCLOAK_)?TRIVY_IMAGE"\s+image\s*\\\s*$/
  return lines.flatMap((line, index) => (line.includes('docker run') && trivyStart.test(line) ? [index] : []))
}

function trivyCommands(section) {
  const lines = section.split(/\r?\n/)
  return trivyCommandStarts(section).map((start) => {
    const commandLines = [lines[start]]
    let index = start
    while (commandLines.at(-1).trimEnd().endsWith('\\')) {
      index += 1
      assert.ok(index < lines.length, `Trivy command at line ${start + 1} has no terminating continuation`)
      commandLines.push(lines[index])
    }
    return commandLines.join('\n')
  })
}

function normalizedCommand(command) {
  return command.replace(/\\\s*\r?\n\s*/g, ' ').trim().replace(/\s+/g, ' ')
}

function assertCacheSetup(section, basename) {
  const starts = trivyCommandStarts(section)
  assert.ok(starts.length > 0, 'scan section must contain a Trivy invocation')
  const setup = section.split(/\r?\n/).slice(0, starts[0]).join('\n')
  const required = [
    'test -n "$RUNNER_TEMP"',
    `cache_dir="$RUNNER_TEMP/${basename}"`,
    'test "${cache_dir%/*}" = "$RUNNER_TEMP"',
    'test "$(dirname -- "$cache_dir")" = "$RUNNER_TEMP"',
    'test "${cache_dir##*/}" = ' + basename,
    'if [ -e "$cache_dir" ] || [ -L "$cache_dir" ]; then',
    'rm -rf -- "$cache_dir"',
    'test ! -e "$cache_dir" && test ! -L "$cache_dir"',
    'mkdir -- "$cache_dir"',
    'chmod 0700 "$cache_dir"',
    'test -d "$cache_dir" && test ! -L "$cache_dir"',
    'test "$(stat -c \'%a\' "$cache_dir")" = 700',
    'printf \'TRIVY_CACHE_DIR=%s\\n\' "$cache_dir" >> "$GITHUB_ENV"',
    'export TRIVY_CACHE_DIR="$cache_dir"',
  ]
  for (const token of required) assert.ok(setup.includes(token), `cache setup is missing: ${token}`)
  assert.doesNotMatch(setup, /actions\/cache|github\.(?:run|sha)|run_number|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT/)
  return setup
}

function assertCacheCommand(command, imageVariable) {
  const imagePattern = imageVariable
    ? new RegExp(`"\\$${imageVariable}"\\s+image`)
    : /"\$(?:KEYCLOAK_)?TRIVY_IMAGE"\s+image/
  assert.match(command, imagePattern)
  assert.equal((command.match(/--volume "\$TRIVY_CACHE_DIR:\/trivy-cache"/g) ?? []).length, 1)
  assert.deepEqual(optionValues(command, 'cache-dir'), ['/trivy-cache'])
}

function optionValues(command, name) {
  const aliases = name === 'format' ? ['f'] : []
  const spellings = [`--${name}`, ...aliases.map((alias) => `-${alias}`)]
  const matcher = new RegExp(`(?:^|\\s)(?:${spellings.join('|')})(?:=|\\s+)([^\\s\\\\]+)`, 'g')
  return [...command.matchAll(matcher)].map((match) => match[1])
}

function scannerValues(command) {
  return optionValues(command, 'scanners')
}

function severityValues(command) {
  return optionValues(command, 'severity')
}

function assertCombinedReport(command, { imageVariable, imageToken, outputToken }) {
  assertCacheCommand(command, imageVariable)
  assert.ok(command.includes(imageToken), `combined report image/input identity is missing: ${imageToken}`)
  assert.deepEqual(optionValues(command, 'format'), ['json'])
  assert.deepEqual(scannerValues(command), ['vuln,secret'])
  assert.deepEqual(severityValues(command), ['CRITICAL,HIGH,MEDIUM,LOW'])
  assert.deepEqual(optionValues(command, 'exit-code'), [])
  assert.equal((command.match(/--output/g) ?? []).length, 1)
  assert.ok(command.includes(outputToken), `combined report output is missing: ${outputToken}`)
  assert.equal(normalizedCommand(command), [
    'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock',
    '--volume "$TRIVY_CACHE_DIR:/trivy-cache" -v "$PWD/proof:/out"',
    `"$${imageVariable}" image --cache-dir /trivy-cache`,
    '--format json --scanners vuln,secret --severity CRITICAL,HIGH,MEDIUM,LOW',
    outputToken,
    imageToken,
  ].join(' '))
}

function assertImageFailClosed(command, { imageVariable, imageToken, scanner, severity }) {
  assertCacheCommand(command, imageVariable)
  assert.ok(command.includes(imageToken), `fail-closed image/input identity is missing: ${imageToken}`)
  assert.deepEqual(optionValues(command, 'format'), [])
  assert.equal((command.match(/--output/g) ?? []).length, 0)
  assert.deepEqual(scannerValues(command), [scanner])
  assert.deepEqual(severityValues(command), severity ? [severity] : [])
  assert.deepEqual(optionValues(command, 'exit-code'), ['1'])
  assert.equal(normalizedCommand(command), [
    'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock',
    '--volume "$TRIVY_CACHE_DIR:/trivy-cache"',
    `"$${imageVariable}" image --cache-dir /trivy-cache`,
    `--scanners ${scanner}`,
    ...(severity ? [`--severity ${severity}`] : []),
    '--exit-code 1',
    imageToken,
  ].join(' '))
}

function assertOfflineReport(command, { imageVariable, scanner, outputToken, policy }) {
  assertCacheCommand(command, imageVariable)
  assert.ok(command.includes('--input "/out/${image}-image.tar"'))
  assert.deepEqual(optionValues(command, 'format'), ['json'])
  assert.deepEqual(scannerValues(command), [scanner])
  assert.deepEqual(severityValues(command), scanner === 'vuln' ? ['CRITICAL'] : [])
  assert.deepEqual(optionValues(command, 'exit-code'), ['1'])
  assert.equal((command.match(/--output/g) ?? []).length, 1)
  assert.ok(command.includes(outputToken), `offline report output is missing: ${outputToken}`)
  if (policy) {
    assert.equal((command.match(/-v "\$vendor_evidence:\/policy:ro"/g) ?? []).length, 1)
    assert.equal((command.match(/--ignorefile \/policy\/postgres-gosu\.trivyignore\.yaml/g) ?? []).length, 1)
    assert.equal((command.match(/--show-suppressed/g) ?? []).length, 1)
  } else {
    assert.doesNotMatch(command, /\/policy|--ignorefile|--show-suppressed/)
  }
  assert.equal(normalizedCommand(command), [
    'docker run --rm -v "$vendor_evidence:/out"',
    ...(policy ? ['-v "$vendor_evidence:/policy:ro"'] : []),
    '--volume "$TRIVY_CACHE_DIR:/trivy-cache"',
    `"$${imageVariable}" image --cache-dir /trivy-cache`,
    '--input "/out/${image}-image.tar" --format json',
    `--scanners ${scanner}`,
    ...(scanner === 'vuln' ? ['--severity CRITICAL'] : []),
    ...(policy ? ['--ignorefile /policy/postgres-gosu.trivyignore.yaml --show-suppressed'] : []),
    '--exit-code 1',
    outputToken,
  ].join(' '))
}

function assertUploadCacheIsolation(upload) {
  assert.doesNotMatch(upload, /trivy-cache/)
  for (const basename of cacheBasenames) assert.doesNotMatch(upload, new RegExp(basename))
  for (const line of upload.split(/\r?\n/).filter((candidate) => /\$\{\{\s*runner\.temp\s*\}\}/.test(candidate))) {
    const pathname = line.trim().replace(/^path:\s*/, '')
    assert.ok(allowedRunnerTempUploads.has(pathname), `runner.temp upload path is not narrowly allowlisted: ${pathname}`)
  }
}

test('job-local Trivy cache setup is inline, fresh, distinct, and outside uploaded roots', () => {
  const imageProof = jobSection(imageWorkflow, 'proof')
  const componentProof = jobSection(imageWorkflow, 'component_proof')
  const offlineBuild = jobSection(offlineWorkflow, 'build_bundle')
  const imageScan = stepSection(imageProof, 'Fail closed on image vulnerabilities and secrets with pinned Trivy')
  const componentScan = stepSection(componentProof, 'Generate selected image SBOMs and fail-closed vulnerability/secret scans')
  const offlineScan = stepSection(offlineBuild, 'Pull pinned vendor images and save immutable archives')

  assert.doesNotMatch(imageWorkflow, /^\s*- name: Establish fresh job-local Trivy cache/m)
  assert.doesNotMatch(offlineWorkflow, /^\s*- name: Establish fresh job-local Trivy cache/m)
  assertCacheSetup(imageScan, cacheBasenames[0])
  assertCacheSetup(componentScan, cacheBasenames[1])
  assertCacheSetup(offlineScan, cacheBasenames[2])
  assert.equal(new Set(cacheBasenames).size, cacheBasenames.length)
  const workflowCacheBasenames = [imageWorkflow, offlineWorkflow]
    .flatMap((workflow) => [...workflow.matchAll(/cache_dir="\$RUNNER_TEMP\/([^"]+)"/g)].map((match) => match[1]))
  assert.deepEqual([...workflowCacheBasenames].sort(), [...cacheBasenames].sort())
  for (const workflow of [imageWorkflow, offlineWorkflow]) {
    assert.doesNotMatch(workflow, /actions\/cache/)
    for (const line of workflow.split(/\r?\n/).filter((line) => /cache_dir|TRIVY_CACHE_DIR/.test(line))) {
      assert.doesNotMatch(line, /github\.(?:run|sha)|run_number|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT/)
    }
    for (const upload of namedStepSections(workflow).filter((step) => /uses:\s*actions\/upload-artifact@/.test(step))) {
      assertUploadCacheIsolation(upload)
    }
  }
})

test('cache contracts reject conflicting duplicate options and broad runner-temp uploads', () => {
  const proof = jobSection(imageWorkflow, 'proof')
  const commands = trivyCommands(stepSection(proof, 'Fail closed on image vulnerabilities and secrets with pinned Trivy'))
  const reportArgs = { imageVariable: 'TRIVY_IMAGE', imageToken: '"hr-axis-onprem-${image}:proof"', outputToken: '--output "/out/${image}-trivy.json"' }
  const failClosedArgs = { imageVariable: 'TRIVY_IMAGE', imageToken: '"hr-axis-onprem-${image}:proof"', scanner: 'vuln', severity: 'CRITICAL' }
  assert.throws(() => assertCombinedReport(`${commands[0]} --format table`, reportArgs))
  assert.throws(() => assertCombinedReport(`${commands[0]} --cache-dir /another-cache`, reportArgs))
  assert.throws(() => assertImageFailClosed(`${commands[1]} --exit-code 0`, failClosedArgs))
  assert.throws(() => assertCombinedReport(`${commands[0]} --format=table`, reportArgs))
  assert.throws(() => assertCombinedReport(`${commands[0]} -f table`, reportArgs))
  assert.throws(() => assertCombinedReport(`${commands[0]} --cache-dir=/another-cache`, reportArgs))
  assert.throws(() => assertImageFailClosed(`${commands[1]} --exit-code=0`, failClosedArgs))
  assert.throws(() => assertImageFailClosed(`${commands[1]} -s UNKNOWN`, failClosedArgs))
  assert.throws(() => assertCombinedReport(`${commands[0]} -o /out/other.json`, reportArgs))
  assert.throws(() => assertUploadCacheIsolation('      - name: unsafe\n        uses: actions/upload-artifact@pinned\n        with:\n          path: ${{ runner.temp }}'))
  assert.throws(() => assertUploadCacheIsolation('      - name: unsafe\n        uses: actions/upload-artifact@pinned\n        with:\n          path: ${{ runner.temp }}/**'))
})

test('full image and component Trivy command roles preserve exact cache, image, scanner, severity, and report contracts', () => {
  const proof = jobSection(imageWorkflow, 'proof')
  const component = jobSection(imageWorkflow, 'component_proof')
  const fullCommands = trivyCommands(stepSection(proof, 'Fail closed on image vulnerabilities and secrets with pinned Trivy'))
  const photoCommands = trivyCommands(stepSection(proof, 'Generate SeaweedFS storage SBOM, license, and vulnerability evidence'))
  const componentCommands = trivyCommands(stepSection(component, 'Generate selected image SBOMs and fail-closed vulnerability/secret scans'))

  assert.equal(trivyCommands(imageWorkflow).length, 12)
  assert.equal(trivyCommands(offlineWorkflow).length, 3)
  assert.equal(fullCommands.length, 6)
  assert.equal(photoCommands.length, 3)
  assert.equal(componentCommands.length, 3)
  assert.match(stepSection(proof, 'Fail closed on image vulnerabilities and secrets with pinned Trivy'), /for image in frontend backend; do/)
  for (const command of [fullCommands[0], fullCommands[1], fullCommands[2]]) {
    assert.ok(command.includes('"$TRIVY_IMAGE" image'))
    assert.ok(command.includes('hr-axis-onprem-${image}:proof'))
  }
  assertCombinedReport(fullCommands[0], { imageVariable: 'TRIVY_IMAGE', imageToken: '"hr-axis-onprem-${image}:proof"', outputToken: '--output "/out/${image}-trivy.json"' })
  assertImageFailClosed(fullCommands[1], { imageVariable: 'TRIVY_IMAGE', imageToken: '"hr-axis-onprem-${image}:proof"', scanner: 'vuln', severity: 'CRITICAL' })
  assertImageFailClosed(fullCommands[2], { imageVariable: 'TRIVY_IMAGE', imageToken: '"hr-axis-onprem-${image}:proof"', scanner: 'secret' })
  assertCombinedReport(fullCommands[3], { imageVariable: 'KEYCLOAK_TRIVY_IMAGE', imageToken: '"$KEYCLOAK_IMAGE"', outputToken: '--output /out/keycloak-trivy.json' })
  assertImageFailClosed(fullCommands[4], { imageVariable: 'KEYCLOAK_TRIVY_IMAGE', imageToken: '"$KEYCLOAK_IMAGE"', scanner: 'vuln', severity: 'CRITICAL' })
  assertImageFailClosed(fullCommands[5], { imageVariable: 'KEYCLOAK_TRIVY_IMAGE', imageToken: '"$KEYCLOAK_IMAGE"', scanner: 'secret' })
  assertCombinedReport(photoCommands[0], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$SEAWEEDFS_IMAGE"', outputToken: '--output /out/photo-storage-trivy.json' })
  assertImageFailClosed(photoCommands[1], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$SEAWEEDFS_IMAGE"', scanner: 'vuln', severity: 'CRITICAL' })
  assertImageFailClosed(photoCommands[2], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$SEAWEEDFS_IMAGE"', scanner: 'secret' })
  assert.match(stepSection(component, 'Generate selected image SBOMs and fail-closed vulnerability/secret scans'), /for image in frontend backend; do/)
  assertCombinedReport(componentCommands[0], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$tag"', outputToken: '--output "/out/${image}-component-trivy.json"' })
  assertImageFailClosed(componentCommands[1], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$tag"', scanner: 'vuln', severity: 'CRITICAL' })
  assertImageFailClosed(componentCommands[2], { imageVariable: 'TRIVY_IMAGE', imageToken: '"$tag"', scanner: 'secret' })
})

test('offline vendor Trivy command roles preserve exact input, report, fail-closed, and PostgreSQL-only policy contracts', () => {
  const build = jobSection(offlineWorkflow, 'build_bundle')
  const vendor = stepSection(build, 'Pull pinned vendor images and save immutable archives')
  const commands = trivyCommands(vendor)

  assert.equal(commands.length, 3)
  assert.match(vendor, /for image in caddy postgres redis seaweedfs; do/)
  const postgresStart = vendor.indexOf('if [ "$image" = postgres ]; then')
  assert.notEqual(postgresStart, -1)
  const elseStart = vendor.indexOf('\n            else\n', postgresStart)
  assert.notEqual(elseStart, -1)
  const fiStart = vendor.indexOf('\n            fi\n', elseStart)
  assert.notEqual(fiStart, -1)
  const postgresCommands = trivyCommands(vendor.slice(postgresStart, elseStart))
  const nonPostgresCommands = trivyCommands(vendor.slice(elseStart, fiStart))
  const secretCommands = trivyCommands(vendor.slice(fiStart))
  assert.equal(postgresCommands.length, 1)
  assert.equal(nonPostgresCommands.length, 1)
  assert.equal(secretCommands.length, 1)
  assertOfflineReport(postgresCommands[0], { imageVariable: 'TRIVY_IMAGE', scanner: 'vuln', outputToken: '--output "/out/${image}-trivy-vuln.json"', policy: true })
  assertOfflineReport(nonPostgresCommands[0], { imageVariable: 'TRIVY_IMAGE', scanner: 'vuln', outputToken: '--output "/out/${image}-trivy-vuln.json"', policy: false })
  assertOfflineReport(secretCommands[0], { imageVariable: 'TRIVY_IMAGE', scanner: 'secret', outputToken: '--output "/out/${image}-trivy-secret.json"', policy: false })
})

test('both exact-SHA source preflights run the dedicated Trivy cache contract and preserve pinned images', () => {
  assert.match(jobSection(imageWorkflow, 'source-preflight'), /scripts\/onprem-trivy-cache-contract\.test\.mjs/)
  assert.match(jobSection(offlineWorkflow, 'source-preflight'), /scripts\/onprem-trivy-cache-contract\.test\.mjs/)
  const escapedRef = trivyRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.equal((imageWorkflow.match(new RegExp(`^  TRIVY_IMAGE: ${escapedRef}$`, 'gm')) ?? []).length, 1)
  assert.equal((imageWorkflow.match(new RegExp(`^  KEYCLOAK_TRIVY_IMAGE: ${escapedRef}$`, 'gm')) ?? []).length, 1)
  assert.equal((offlineWorkflow.match(new RegExp(`^  TRIVY_IMAGE: ${escapedRef}$`, 'gm')) ?? []).length, 1)
})
