import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { commandDigest, digestReleaseEnvironment, digestWorkspaceFiles, npmVersion, sha256, stableJson } from './release-stage-proof.mjs'

export const RECOVERY_VERSION = 2
export const MAX_PROOF_AGE_MS = 24 * 60 * 60 * 1000
const metadataKeys = new Set([
  'GITHUB_RUN_ID', 'GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT', 'GITHUB_SHA',
  'GITHUB_REF', 'GITHUB_REF_NAME', 'GITHUB_HEAD_REF', 'GITHUB_EVENT_PATH',
  'GITHUB_ENV', 'GITHUB_PATH', 'GITHUB_OUTPUT', 'GITHUB_STEP_SUMMARY',
  'GITHUB_ACTION', 'GITHUB_ACTION_REPOSITORY', 'GITHUB_ACTION_REF', 'GITHUB_ACTION_PATH',
  'GITHUB_JOB', 'GITHUB_WORKFLOW_REF', 'GITHUB_WORKFLOW_SHA', 'RUNNER_TRACKING_ID', 'RUNNER_NAME',
  // Repository recovery control, not inputs consumed by tests or builds.
  'RELEASE_RECOVERY_MODE', 'RELEASE_RECOVERY_IMPORT',
])
export const isSpec = (path) => /^admin-web\/e2e\/[^/]+\.spec\.ts$/.test(path)
let npmIdentity

export function gitText(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function workspacePaths(root) {
  return [...new Set(gitText(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0').filter(Boolean))].sort()
}

export function stageInputPaths(paths, family) {
  // Unknown paths are included by default. Only reviewed independent families
  // are excluded; helpers/config/contracts remain shared inputs.
  if (family === 'backend-release') return paths.filter((path) =>
    !/^admin-web\/(src|public|e2e)\//.test(path))
  if (family === 'frontend-static' || family === 'frontend-e2e-shared') return paths.filter((path) => !isSpec(path))
  return paths
}

export function recoveryEnvironment(root, environment = process.env) {
  return digestReleaseEnvironment(root, Object.fromEntries(
    Object.entries(environment).filter(([key]) => !metadataKeys.has(key)),
  ))
}

export function treeDigest(root, relativeDirectory) {
  const directory = join(root, relativeDirectory)
  if (!existsSync(directory)) return null
  const paths = []
  function walk(current) {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const relative = current + '/' + entry.name
      if (entry.isSymbolicLink()) throw new Error('Recovery does not accept linked build outputs')
      if (entry.isDirectory()) walk(relative)
      else if (entry.isFile()) paths.push(relative)
      else throw new Error('Recovery output is not a regular file')
    }
  }
  walk(relativeDirectory)
  return paths.length ? digestWorkspaceFiles(root, paths) : null
}

export function buildStageInputs({ root, stage, environment = process.env, family = stage.id, toolchain = {} }) {
  const paths = stageInputPaths(workspacePaths(root), family)
  if (paths.some((path) => existsSync(join(root, path)) && lstatSync(join(root, path)).isSymbolicLink())) {
    throw new Error('Recovery inputs contain a symlink')
  }
  const identity = {
    version: RECOVERY_VERSION,
    family,
    command: commandDigest(stage),
    source: digestWorkspaceFiles(root, paths),
    environment: recoveryEnvironment(root, environment),
    node: process.version,
    npm: npmIdentity ??= npmVersion(root),
    platform: process.platform,
    arch: process.arch,
    ...toolchain,
  }
  return { ...identity, digest: sha256(stableJson(identity)) }
}

export function stageOutputDigest(root, stage) {
  if (stage.id === 'backend-release') return treeDigest(root, 'backend/nestjs/dist')
  if (stage.id === 'frontend-static') return treeDigest(root, 'admin-web/dist')
  return null
}

export function reusableStage({ record, stage, inputs, outputDigest, now = Date.now() }) {
  if (stage.volatile || stage.id === 'root-contracts' || stage.id === 'frontend-e2e') return { reuse: false, reason: 'fresh verification required' }
  if (record?.version !== RECOVERY_VERSION || record.stageId !== stage.id || record.status !== 'success') return { reuse: false, reason: 'no successful stage proof' }
  if (record.inputs?.digest !== inputs.digest) return { reuse: false, reason: 'stage inputs changed' }
  if (!outputDigest || record.outputDigest !== outputDigest) return { reuse: false, reason: 'build output missing or changed' }
  const completed = Date.parse(record.completedAt)
  if (!Number.isFinite(completed) || completed > now || now - completed > MAX_PROOF_AGE_MS) return { reuse: false, reason: 'proof expired or invalid' }
  if (!/^[a-f0-9]{40}$/.test(record.sourceHead ?? '') || !Number.isFinite(record.durationMs) || record.durationMs < 0) return { reuse: false, reason: 'invalid proof provenance' }
  return { reuse: true, reason: 'identical stage inputs and output' }
}

export function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

export function makeStageRecord({ root, stage, inputs, startedAt, durationMs, now = new Date() }) {
  const after = buildStageInputs({ root, stage })
  if (inputs.digest !== after.digest) throw new Error('Stage inputs changed during verification: ' + stage.id)
  return {
    version: RECOVERY_VERSION, stageId: stage.id, status: 'success',
    sourceHead: gitText(root, ['rev-parse', 'HEAD']), inputs,
    outputDigest: stageOutputDigest(root, stage), startedAt,
    completedAt: now.toISOString(), durationMs,
  }
}
