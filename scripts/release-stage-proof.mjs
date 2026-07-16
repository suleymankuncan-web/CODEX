import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  lstatSync,
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from 'node:fs'
import { join } from 'node:path'

export const RELEASE_RECEIPT_SCHEMA_VERSION = 1

export function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function validateReleaseManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest?.receiptSchemaVersion !== 1) {
    throw new Error('Unsupported release stage manifest schema')
  }
  if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) {
    throw new Error('Release stage manifest must contain stages')
  }

  const ids = new Set()
  for (const stage of manifest.stages) {
    if (!/^[a-z][a-z0-9-]*$/u.test(stage?.id ?? '') || ids.has(stage.id)) {
      throw new Error(`Invalid or duplicate release stage id: ${stage?.id ?? '(missing)'}`)
    }
    ids.add(stage.id)
    if (
      typeof stage.cwd !== 'string' ||
      stage.cwd.startsWith('/') ||
      stage.cwd.startsWith('\\') ||
      stage.cwd.split(/[\\/]/u).includes('..')
    ) {
      throw new Error(`Invalid cwd for release stage ${stage.id}`)
    }
    if (!Array.isArray(stage.commands) || stage.commands.length === 0) {
      throw new Error(`Release stage ${stage.id} has no commands`)
    }
    for (const command of stage.commands) {
      if (!Array.isArray(command) || command.length === 0 || command.some((part) => typeof part !== 'string' || !/^[A-Za-z0-9_./:\\-]+$/u.test(part))) {
        throw new Error(`Release stage ${stage.id} has an invalid command`)
      }
      if (!['node', 'npm'].includes(command[0])) {
        throw new Error(`Release stage ${stage.id} uses a non-allowlisted executable`)
      }
    }
    if (!Array.isArray(stage.dependsOn) || typeof stage.volatile !== 'boolean') {
      throw new Error(`Release stage ${stage.id} has invalid dependency metadata`)
    }
  }

  for (const stage of manifest.stages) {
    for (const dependency of stage.dependsOn) {
      if (!ids.has(dependency) || dependency === stage.id) {
        throw new Error(`Release stage ${stage.id} has invalid dependency ${dependency}`)
      }
    }
  }

  const visited = new Set()
  const visiting = new Set()
  const byId = new Map(manifest.stages.map((stage) => [stage.id, stage]))
  function visit(id) {
    if (visiting.has(id)) {
      throw new Error(`Release stage dependency cycle includes ${id}`)
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id).dependsOn) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of ids) visit(id)

  return manifest
}

export function commandDigest(stage) {
  return sha256(stableJson({ cwd: stage.cwd, commands: stage.commands }))
}

export function receiptDigest(receipt) {
  return sha256(stableJson(receipt))
}

export function receiptCanBeReused({
  receipt,
  stage,
  proofIdentityDigest,
  upstreamReceiptDigests,
}) {
  return Boolean(
    !stage.volatile &&
      receipt?.schemaVersion === RELEASE_RECEIPT_SCHEMA_VERSION &&
      receipt?.stageId === stage.id &&
      receipt?.status === 'success' &&
      !Number.isNaN(Date.parse(receipt?.startedAt ?? '')) &&
      !Number.isNaN(Date.parse(receipt?.completedAt ?? '')) &&
      Number.isFinite(receipt?.durationMs) &&
      receipt.durationMs >= 0 &&
      receipt?.proofIdentityDigest === proofIdentityDigest &&
      receipt?.commandDigest === commandDigest(stage) &&
      stableJson(receipt?.upstreamReceiptDigests ?? {}) === stableJson(upstreamReceiptDigests),
  )
}

function git(workspaceRoot, args) {
  return execFileSync('git', args, {
    cwd: workspaceRoot,
    encoding: args.includes('-z') ? 'buffer' : 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

function npmVersion(workspaceRoot) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm'
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd --version']
    : ['--version']
  return execFileSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

export function digestWorkspaceFiles(workspaceRoot, relativePaths) {
  const hash = createHash('sha256')
  for (const relativePath of [...new Set(relativePaths)].sort()) {
    const absolutePath = join(workspaceRoot, ...relativePath.split('/'))
    const stat = lstatSync(absolutePath)
    hash.update(relativePath)
    hash.update('\0')
    hash.update(String(stat.mode))
    hash.update('\0')
    if (stat.isSymbolicLink()) {
      hash.update('symlink\0')
      hash.update(readlinkSync(absolutePath, 'utf8'))
    } else if (stat.isFile()) {
      hash.update('file\0')
      hash.update(readFileSync(absolutePath))
    } else {
      throw new Error(`Unsupported tracked input type: ${relativePath}`)
    }
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function digestReleaseEnvironment(workspaceRoot, environment = process.env) {
  const environmentFiles = []
  for (const relativeDirectory of ['.', 'admin-web', 'backend/nestjs']) {
    const directory = join(workspaceRoot, ...relativeDirectory.split('/'))
    if (!existsSync(directory)) continue
    for (const name of readdirSync(directory)) {
      if (name === '.env' || name.startsWith('.env.')) {
        const relativePath = relativeDirectory === '.' ? name : `${relativeDirectory}/${name}`
        if (lstatSync(join(directory, name)).isFile()) environmentFiles.push(relativePath)
      }
    }
  }
  const fileDigests = Object.fromEntries(
    environmentFiles.sort().map((path) => [
      path,
      sha256(readFileSync(join(workspaceRoot, ...path.split('/')))),
    ]),
  )
  const environmentEntries = Object.fromEntries(
    Object.entries(environment)
      .filter(([, value]) => typeof value === 'string')
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  return sha256(stableJson({ environment: environmentEntries, files: fileDigests }))
}

export function buildReleaseProofIdentity({ workspaceRoot, manifestPath }) {
  const manifestBytes = readFileSync(manifestPath)
  const listed = git(workspaceRoot, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  ])
  const relativePaths = listed
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => path.replaceAll('\\', '/'))

  const packageLockDigests = {}
  for (const path of ['admin-web/package-lock.json', 'backend/nestjs/package-lock.json']) {
    packageLockDigests[path] = sha256(readFileSync(join(workspaceRoot, ...path.split('/'))))
  }

  const identity = {
    schemaVersion: 1,
    headSha: git(workspaceRoot, ['rev-parse', 'HEAD']).trim(),
    manifestDigest: sha256(manifestBytes),
    node: process.version,
    npm: npmVersion(workspaceRoot),
    platform: process.platform,
    arch: process.arch,
    packageLockDigests,
    releaseEnvironmentDigest: digestReleaseEnvironment(workspaceRoot),
    workspaceDigest: digestWorkspaceFiles(workspaceRoot, relativePaths),
  }

  return { ...identity, proofIdentityDigest: sha256(stableJson(identity)) }
}
