import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  EXPECTED_REPOSITORY_OWNER,
  LOCAL_PROOF_RECEIPT_PATH,
  LOCAL_STATUS_CONTEXT,
  PINNED_NODE_IMAGE,
  archiveWorkspace,
  buildDispatchInputs,
  buildCanonicalProofInvocation,
  buildLinuxProofDockerArgs,
  buildStreamingCommandOptions,
  buildReceipt,
  collectDockerIdentity,
  evaluateStatusList,
  githubRequest,
  isPrivateModeAcceptable,
  main,
  currentGitState,
  parseGitHubRepositoryRemote,
  normalizeGitHubApiUrl,
  parseCli,
  pathsAreDisjoint,
  sanitizeProofEnvironment,
  validateSafePath,
  validateCleanGitOutput,
  validateLocalProofReceipt,
  verifyStatus,
} from './onprem-proof-dispatch.mjs'

const SHA = 'a'.repeat(40)
const TREE = 'b'.repeat(40)
const DIGEST = 'c'.repeat(64)

function receipt(overrides = {}) {
  return buildReceipt({
    headSha: SHA,
    treeSha: TREE,
    branch: 'codex/local-proof',
    proofIdentityDigest: DIGEST,
    workspaceDigest: DIGEST,
    manifestDigest: DIGEST,
    stageReceipts: { root: DIGEST },
    archiveSha256: DIGEST,
    nodeImage: { reference: PINNED_NODE_IMAGE, configImageId: `sha256:${PINNED_NODE_IMAGE.slice(PINNED_NODE_IMAGE.indexOf('@sha256:') + 8)}` },
    docker: {
      identityDigest: DIGEST,
      serverVersion: '29.4.0',
      serverOs: 'linux',
      serverArch: 'amd64',
      composeVersion: '2.39.4',
    },
    suites: { onprem: 'passed', offline: 'passed', network: 'none' },
    startedAt: '2026-08-16T10:00:00.000Z',
    completedAt: '2026-08-16T10:30:00.000Z',
    ...overrides,
  })
}

test('local proof receipt is compact, hashed, and validates only the approved passed shape', () => {
  const value = receipt()
  assert.equal(value.schemaVersion, 1)
  assert.equal(value.status, 'passed')
  assert.equal(value.operation, 'onprem-local-proof')
  assert.match(value.receiptSha256, /^[a-f0-9]{64}$/)
  assert.equal(validateLocalProofReceipt(value, { now: Date.parse('2026-08-16T11:00:00.000Z') }).receiptSha256, value.receiptSha256)
  assert.equal(JSON.stringify(value).includes('secret'), false)
  assert.equal(JSON.stringify(value).includes('https://'), false)
  assert.match(LOCAL_PROOF_RECEIPT_PATH.replaceAll('\\', '/'), /tmp\/onprem-proof-dispatch\/receipt\.json$/)
})

test('receipt validation rejects identity, suite, pinned-image, and freshness drift', () => {
  const value = receipt()
  const mutations = [
    { headSha: 'd'.repeat(40) },
    { treeSha: 'e'.repeat(40) },
    { proofIdentityDigest: 'f'.repeat(64) },
    { suites: { onprem: 'failed', offline: 'passed', network: 'none' } },
    { nodeImage: { reference: 'node:latest', configImageId: `sha256:${DIGEST}` } },
    { completedAt: '2026-08-14T00:00:00.000Z' },
  ]
  for (const mutation of mutations) {
    const candidate = { ...value, ...mutation }
    assert.throws(() => validateLocalProofReceipt(candidate, { now: Date.parse('2026-08-16T11:00:00.000Z') }), /receipt|identity|suite|image|fresh|digest/i)
  }
  const nestedSecret = buildReceipt({ ...value, docker: { ...value.docker, token: 'secret-not-permitted' } })
  assert.throws(() => validateLocalProofReceipt(nestedSecret, { now: Date.parse('2026-08-16T11:00:00.000Z') }), /unsanitized|Docker/i)
})

test('clean-tree guard accepts empty porcelain and rejects tracked, index, and nonignored-untracked output', () => {
  assert.equal(validateCleanGitOutput(''), true)
  for (const output of [' M scripts/example.mjs\n', 'M  scripts/example.mjs\n', '?? scripts/untracked.mjs\n']) {
    assert.throws(() => validateCleanGitOutput(output), /clean|dirty|untracked/i)
  }
})

test('Linux proof Docker command is source-archive-only, pinned, offline, read-only, and capability bounded', () => {
  const args = buildLinuxProofDockerArgs('/tmp/onprem-proof/archive.tar', DIGEST)
  assert.deepEqual(args.slice(0, 4), ['run', '--pull=never', '--rm', '--interactive'])
  assert.equal(args.includes('--user'), false)
  assert.ok(args.includes('--read-only'))
  assert.ok(args.includes('--network') && args[args.indexOf('--network') + 1] === 'none')
  assert.ok(args.includes('--cap-drop') && args[args.indexOf('--cap-drop') + 1] === 'ALL')
  for (const capability of ['CHOWN', 'SETUID', 'SETGID']) {
    const index = args.findIndex((value, position) => value === '--cap-add' && args[position + 1] === capability)
    assert.ok(index >= 0, `missing ${capability}`)
  }
  assert.ok(args.includes('--security-opt') && args[args.indexOf('--security-opt') + 1] === 'no-new-privileges')
  assert.ok(args.some((value) => value === '/workspace:rw,nosuid,nodev,size=512m,mode=0755'))
  assert.ok(args.some((value) => value === '/tmp:rw,nosuid,nodev,size=512m,mode=0700'))
  assert.ok(args.every((value) => !value.includes('mode=1777')))
  assert.ok(args.some((value) => value === '/test-tmp:rw,nosuid,nodev,exec,size=512m,mode=0700'))
  assert.deepEqual(args.slice(args.indexOf('--env'), args.indexOf('--env') + 2), ['--env', 'TMPDIR=/test-tmp'])
  assert.ok(args.some((value) => value === '/var/lib:rw,nosuid,nodev,size=512m,mode=0755'))
  assert.ok(args.some((value) => value.includes('/tmp/onprem-proof/archive.tar:/input/onprem-source.tar:ro')))
  const archiveDigestEnv = args.findIndex((value, index) => value === '--env' && args[index + 1] === `ONPREM_ARCHIVE_SHA256=${DIGEST}`)
  assert.ok(archiveDigestEnv >= 0)
  assert.ok(args.includes(PINNED_NODE_IMAGE))
  assert.equal(args.some((value) => value.includes('docker.sock')), false)
  const proofScript = args.at(-1)
  assert.ok(proofScript.indexOf('sha256sum /input/onprem-source.tar') < proofScript.indexOf('tar -xf /input/onprem-source.tar'))
  assert.ok(proofScript.indexOf('tar -xf /input/onprem-source.tar') < proofScript.indexOf('npm run test:onprem'))
  assert.throws(() => buildLinuxProofDockerArgs('/tmp/onprem-proof/archive.tar', 'not-a-digest'), /archive.*digest|SHA-256/i)
})

test('Windows path checks skip POSIX mode bits but still reject type, symlink, and root escapes', () => {
  assert.equal(isPrivateModeAcceptable(0o666, { platform: 'win32' }), true)
  assert.equal(isPrivateModeAcceptable(0o666, { platform: 'linux' }), false)
  const root = mkdtempSync(join(tmpdir(), 'onprem-proof-path-'))
  try {
    const file = join(root, 'file')
    const directory = join(root, 'directory')
    writeFileSync(file, 'safe')
    mkdirSync(directory)
    assert.equal(validateSafePath(file, { root, kind: 'file', platform: 'win32' }), true)
    assert.throws(() => validateSafePath(directory, { root, kind: 'file', platform: 'win32' }), /regular file/i)
    assert.throws(() => validateSafePath(join(root, '..'), { root, kind: 'directory', platform: 'win32' }), /escapes|ancestor/i)
    try {
      const link = join(root, 'link')
      symlinkSync(file, link, 'file')
      assert.throws(() => validateSafePath(link, { root, kind: 'file', platform: 'win32' }), /symlink|reparse/i)
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error?.code)) throw error
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('proof archive temp root is disjoint from workspace while nested/equal roots are rejected', () => {
  assert.equal(pathsAreDisjoint('C:/workspace', 'C:/temp/onprem-proof'), true)
  assert.equal(pathsAreDisjoint('C:/workspace', 'C:/workspace/tmp'), false)
  assert.equal(pathsAreDisjoint('C:/workspace', 'C:/workspace'), false)
  assert.equal(pathsAreDisjoint('C:/workspace', 'C:/workspace-other'), true)
})

test('git archive is read-only inside a private root before its content is accepted', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-proof-archive-'))
  try {
    const archive = archiveWorkspace('/synthetic-workspace', root, {
      commandRunner: (command, args) => {
        assert.equal(command, 'git')
        const archivePath = args[args.indexOf('--output') + 1]
        writeFileSync(archivePath, 'synthetic source archive')
        chmodSync(archivePath, 0o664)
        return { status: 0, stdout: '' }
      },
    })
    assert.equal(statSync(root).mode & 0o777, 0o700)
    assert.equal(statSync(archive.archivePath).mode & 0o777, 0o644)
    assert.equal(isPrivateModeAcceptable(statSync(archive.archivePath).mode), true)
    assert.match(archive.archiveSha256, /^[a-f0-9]{64}$/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('git archive refuses a symlink output before changing its target permissions', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-proof-archive-link-'))
  try {
    const target = join(root, 'target')
    writeFileSync(target, 'untouched')
    chmodSync(target, 0o644)
    assert.throws(() => archiveWorkspace('/synthetic-workspace', root, {
      commandRunner: (_command, args) => {
        symlinkSync(target, args[args.indexOf('--output') + 1])
        return { status: 0, stdout: '' }
      },
    }), /regular file/i)
    assert.equal(statSync(target).mode & 0o777, 0o644)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('long proof commands stream output while identity probes retain bounded capture', () => {
  assert.deepEqual(buildStreamingCommandOptions({ cwd: '/workspace', env: { SAFE: '1' }, timeout: 99 }), {
    cwd: '/workspace',
    env: { SAFE: '1' },
    timeout: 99,
    stdio: 'inherit',
  })
  assert.equal(Object.hasOwn(buildStreamingCommandOptions({ cwd: '/workspace', env: {}, timeout: 99 }), 'maxBuffer'), false)
})

test('canonical proof invocation uses the exact Node executable and direct check-release entrypoint', () => {
  const invocation = buildCanonicalProofInvocation({ nodeExecutable: 'node-test', workspaceRoot: '/repo', env: { SAFE: '1' }, timeout: 7 })
  assert.deepEqual(invocation, {
    command: 'node-test',
    args: ['scripts/check-release.mjs'],
    options: { cwd: '/repo', env: { SAFE: '1' }, timeout: 7, stdio: 'inherit' },
  })
  assert.doesNotMatch(invocation.args.join(' '), /npm\s+run|check:release\s+--/)
})

test('proof environment strips only credential transport variables and CLI rejects positional/token input', () => {
  assert.deepEqual(sanitizeProofEnvironment({
    GITHUB_TOKEN: 'secret',
    GH_TOKEN: 'secret2',
    DOCKER_HOST: 'ssh://remote',
    DOCKER_CONTEXT: 'remote',
    DOCKER_TLS_VERIFY: '1',
    DOCKER_CERT_PATH: '/secret-certs',
    OTHER: 'bound',
  }), { OTHER: 'bound' })
  assert.deepEqual(
    sanitizeProofEnvironment({ GITHUB_TOKEN: 'one', GH_TOKEN: 'two', OTHER: 'bound' }),
    sanitizeProofEnvironment({ GITHUB_TOKEN: 'changed', GH_TOKEN: 'changed2', OTHER: 'bound' }),
  )
  assert.deepEqual(parseCli(['verify-status', '--expected-sha', SHA, '--repository', `${EXPECTED_REPOSITORY_OWNER}/CODEX`]), {
    command: 'verify-status',
    kind: undefined,
    values: { expected_sha: SHA, repository: `${EXPECTED_REPOSITORY_OWNER}/CODEX` },
  })
  assert.throws(() => parseCli(['prove', 'unexpected']), /unsupported/i)
  assert.throws(() => parseCli(['verify-status', '--expected-sha']), /requires/i)
  return assert.rejects(() => main(['publish', '--token', 'secret']), /unsupported/i)
})

test('all injected child probes receive credential-sanitized environments', () => {
  const safeEnvironment = sanitizeProofEnvironment({ PATH: 'safe', GITHUB_TOKEN: 'secret', GH_TOKEN: 'secret2' })
  const seen = []
  const output = (stdout) => ({ status: 0, stdout, stderr: '' })
  const gitRunner = (command, args, options) => {
    seen.push(options.env)
    if (args[0] === 'status') return output('')
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return output(`${SHA}\n`)
    if (args[0] === 'rev-parse') return output(`${TREE}\n`)
    return output('codex/local-proof\n')
  }
  currentGitState(process.cwd(), { commandRunner: gitRunner, env: safeEnvironment })
  const dockerRunner = (command, args, options) => {
    seen.push(options.env)
    if (args[0] === 'version') return output(JSON.stringify({ Os: 'linux', Arch: 'amd64', Version: '29.4.0', ApiVersion: '1', MinAPIVersion: '1', GitCommit: 'g' }))
    if (args[0] === 'info') return output(JSON.stringify({ ID: 'id', ServerVersion: '29.4.0', OSType: 'linux', Architecture: 'x86_64', KernelVersion: 'k', Driver: 'overlay2' }))
    if (args[0] === 'image') return output(JSON.stringify({ Os: 'linux', Architecture: 'amd64', Id: `sha256:${PINNED_NODE_IMAGE.split('@sha256:')[1]}`, RepoDigests: [`node@sha256:${PINNED_NODE_IMAGE.split('@sha256:')[1]}`] }))
    if (args[0] === 'compose') return output('2.39.4\n')
    if (args[0] === 'buildx') return output('github.com/docker/buildx v0.25.0 1234567\n')
    if (args[0] === 'context' && args[1] === 'show') return output('desktop-linux\n')
    if (args[0] === 'context' && args[1] === 'inspect') return output('"npipe:////./pipe/dockerDesktopLinuxEngine"\n')
    throw new Error(`unexpected Docker command: ${args.join(' ')}`)
  }
  const dockerIdentity = collectDockerIdentity(process.cwd(), { commandRunner: dockerRunner, env: safeEnvironment })
  assert.match(dockerIdentity.identityDigest, /^[a-f0-9]{64}$/)
  const driftIdentity = collectDockerIdentity(process.cwd(), {
    commandRunner: (command, args, options) => args[0] === 'buildx'
      ? output('github.com/docker/buildx v0.26.0 changed\n')
      : dockerRunner(command, args, options),
    env: safeEnvironment,
  })
  assert.notEqual(dockerIdentity.identityDigest, driftIdentity.identityDigest)
  assert.throws(
    () => collectDockerIdentity(process.cwd(), {
      commandRunner: (command, args, options) => args[0] === 'context' && args[1] === 'inspect'
        ? output('"ssh://remote.example/run/docker.sock"\n')
        : dockerRunner(command, args, options),
      env: safeEnvironment,
    }),
    /local Docker|endpoint|remote/i,
  )
  assert.ok(seen.length >= 9)
  for (const environment of seen) {
    assert.equal(environment.GITHUB_TOKEN, undefined)
    assert.equal(environment.GH_TOKEN, undefined)
  }
})

test('remote parser accepts only exact GitHub forms and API requests reject unapproved hosts before fetch', async () => {
  assert.equal(parseGitHubRepositoryRemote(`https://github.com/${EXPECTED_REPOSITORY_OWNER}/CODEX.git`), `${EXPECTED_REPOSITORY_OWNER}/CODEX`)
  assert.equal(parseGitHubRepositoryRemote(`git@github.com:${EXPECTED_REPOSITORY_OWNER}/CODEX`), `${EXPECTED_REPOSITORY_OWNER}/CODEX`)
  assert.equal(parseGitHubRepositoryRemote(`ssh://git@github.com/${EXPECTED_REPOSITORY_OWNER}/CODEX.git`), `${EXPECTED_REPOSITORY_OWNER}/CODEX`)
  for (const remote of [
    `https://evilgithub.com/${EXPECTED_REPOSITORY_OWNER}/CODEX`,
    `https://github.com.evil.test/${EXPECTED_REPOSITORY_OWNER}/CODEX`,
    `https://user@github.com/${EXPECTED_REPOSITORY_OWNER}/CODEX`,
    `https://github.com:443/${EXPECTED_REPOSITORY_OWNER}/CODEX`,
    `https://github.com/${EXPECTED_REPOSITORY_OWNER}/CODEX?x=1`,
    `https://github.com/${EXPECTED_REPOSITORY_OWNER}/CODEX/extra`,
  ]) assert.throws(() => parseGitHubRepositoryRemote(remote), /GitHub repository URL/i)
  assert.equal(normalizeGitHubApiUrl('https://api.github.com/'), 'https://api.github.com')
  let fetchCalled = false
  await assert.rejects(
    () => githubRequest({ apiUrl: 'https://evilgithub.com', token: 'secret-token', path: '/user', fetchImpl: async () => { fetchCalled = true } }),
    /approved.*api\.github\.com/i,
  )
  assert.equal(fetchCalled, false)
  let requestInit
  await githubRequest({
    apiUrl: 'https://api.github.com',
    token: 'secret-token',
    path: '/user',
    fetchImpl: async (_url, init) => {
      requestInit = init
      return { ok: true, status: 200, json: async () => ({}) }
    },
  })
  assert.equal(requestInit.redirect, 'error')
})

test('verify-status binds workflow-dispatch execution SHA before any API polling and permits pull-request merge SHA', async () => {
  const expectedSha = SHA
  const executionSha = 'b'.repeat(40)
  let fetchCalled = false
  const noFetch = async () => { fetchCalled = true; throw new Error('fetch must not run') }
  for (const mutation of [
    { eventName: undefined, executionSha },
    { eventName: 'workflow_dispatch', executionSha },
    { eventName: 'workflow_dispatch', executionSha: 'not-a-sha' },
  ]) {
    await assert.rejects(
      () => verifyStatus({ ...mutation, expectedSha, repository: `${EXPECTED_REPOSITORY_OWNER}/CODEX`, token: 'secret-token', fetchImpl: noFetch }),
      /event|execution SHA|match/i,
    )
  }
  assert.equal(fetchCalled, false)
  const now = Date.parse('2026-08-16T11:00:00.000Z')
  const statusValue = status({ updated_at: '2026-08-16T10:30:00.000Z' })
  const result = await verifyStatus({
    expectedSha,
    executionSha,
    eventName: 'pull_request',
    repository: `${EXPECTED_REPOSITORY_OWNER}/CODEX`,
    token: 'secret-token',
    now: () => now,
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith('/user') ? {} : url.includes('/statuses?') ? [statusValue] : {
        full_name: `${EXPECTED_REPOSITORY_OWNER}/CODEX`,
        owner: { login: EXPECTED_REPOSITORY_OWNER, type: 'User' },
      },
    }),
  })
  assert.equal(result.state, 'success')
})

test('dispatch input builder derives SHA and exact artifact identity instead of accepting a bare digest', () => {
  assert.deepEqual(buildDispatchInputs('image', { headSha: SHA, proofMode: 'full', imageScope: 'both' }), {
    expected_sha: SHA,
    proof_mode: 'full',
    image_scope: 'both',
  })
  assert.deepEqual(buildDispatchInputs('image', { headSha: SHA, proofMode: 'component', imageScope: 'frontend' }), {
    expected_sha: SHA,
    proof_mode: 'component',
    image_scope: 'frontend',
  })
  assert.deepEqual(buildDispatchInputs('offline', { headSha: SHA, proofRunId: '31720253857' }), {
    expected_sha: SHA,
    proof_artifact_name: `onprem-image-proof-${SHA}`,
    proof_run_id: '31720253857',
  })
  assert.throws(() => buildDispatchInputs('offline', { headSha: SHA, proofRunId: 'not-a-run' }), /run/i)
  assert.throws(() => buildDispatchInputs('image', { headSha: SHA, proofMode: 'full', imageScope: 'frontend' }), /scope|incompatible/i)
})

function status(overrides = {}) {
  return {
    id: 1,
    context: LOCAL_STATUS_CONTEXT,
    state: 'success',
    description: `hr-axis-local-proof-v1 receipt=${DIGEST}`,
    creator: { login: EXPECTED_REPOSITORY_OWNER, type: 'User' },
    created_at: '2026-08-16T10:00:00.000Z',
    updated_at: '2026-08-16T10:00:00.000Z',
    ...overrides,
  }
}

test('status selector requires latest exact owner success and rejects stale/foreign/bare-digest statuses', () => {
  const now = Date.parse('2026-08-16T11:00:00.000Z')
  assert.equal(evaluateStatusList([status()], { expectedSha: SHA, now }).state, 'success')
  assert.equal(evaluateStatusList([status({ id: 1 }), status({ id: 2, state: 'failure', updated_at: '2026-08-16T10:01:00.000Z' })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([status({ creator: { login: 'other-user', type: 'User' } })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([status({ description: 'receipt=' + DIGEST })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([status({ updated_at: '2026-08-14T00:00:00.000Z' })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([status({ state: 'pending', updated_at: '2026-08-14T00:00:00.000Z' })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([status({ updated_at: undefined, created_at: undefined })], { expectedSha: SHA, now }).state, 'failure')
  assert.equal(evaluateStatusList([], { expectedSha: SHA, now }).state, 'pending')
})

test('repository operating docs make the local proof wrapper mandatory before GitHub evidence', () => {
  const agents = readFileSync('AGENTS.md', 'utf8')
  const discipline = readFileSync('discipline.md', 'utf8')
  for (const text of [agents, discipline]) {
    assert.match(text, /check:onprem:dispatch.*prove/s)
    assert.match(text, /publish/s)
    assert.match(text, /GitHub.*(?:diagnostic|hata ayiklama)/is)
  }
})
