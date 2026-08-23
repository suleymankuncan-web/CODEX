import { createHash } from 'node:crypto'
import { lstatSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import {
  acquireHostLock,
  hostContract,
  inspectDedicatedNativeDockerHost,
  releaseHostLock,
  resetDedicatedNativeDockerHost,
} from './onprem-native-docker-host.mjs'

const FIREWALLS = Object.freeze([
  Object.freeze({ key: 'ipv4', save: '/usr/sbin/iptables-save', restore: '/usr/sbin/iptables-restore' }),
  Object.freeze({ key: 'ipv6', save: '/usr/sbin/ip6tables-save', restore: '/usr/sbin/ip6tables-restore' }),
])
const RECOVERY_BINARIES = Object.freeze({
  sudo: '/usr/bin/sudo',
  rm: '/usr/bin/rm',
})
const RECOVERY_ENV = Object.freeze({
  LANG: 'C',
  LC_ALL: 'C',
  PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
})
export const DEFAULT_RECOVERY_BUDGET_MS = 5 * 60_000
export const FIREWALL_COMMAND_CAP_MS = 30_000
export const FIREWALL_RECOVERY_RESERVE_MS = 150_000
// Keep mismatch receipts useful for small rulesets while bounding every
// positional digest collection, including the offline rehearsal path that
// copies recovery diagnostics directly into its receipt.
export const FIREWALL_DIAGNOSTIC_LINE_CAP = 1_024
const FIXED_RECOVERY_BINARY = /^\/usr\/(?:sbin|bin)\/[A-Za-z0-9._-]+$/
for (const executable of [...FIREWALLS.flatMap(({ save, restore }) => [save, restore]), ...Object.values(RECOVERY_BINARIES)]) {
  if (!FIXED_RECOVERY_BINARY.test(executable)) throw new Error('recovery executable path is not fixed')
}
const GENERATED_WORKSPACE_PATHS = Object.freeze([
  Object.freeze({ label: 'proof', relative: 'proof' }),
  Object.freeze({ label: 'core-secret-files', relative: 'infra/onprem/core/secret-files' }),
  Object.freeze({ label: 'photo-storage-secret-files', relative: 'infra/onprem/photo-storage/secret-files' }),
])
const MAX_FAILURE_LENGTH = 320
const DECIMAL_COUNTER = /^[0-9]+$/
const SAFE_CHAIN_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:+-]*$/
const SAFE_POLICY_TOKEN = /^[A-Za-z0-9_.:+-]+$/

const fail = (message) => { throw new Error(message) }
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ''), 'utf8')).digest('hex')
}

function timeoutMs(deadlineAt, capMs = 120_000) {
  const remaining = Number.isFinite(deadlineAt) ? deadlineAt - Date.now() : 120_000
  return Math.max(1, Math.min(capMs, 120_000, remaining))
}

function recoveryCommandOptions({ cwd, deadlineAt, input, capMs } = {}) {
  const options = { cwd, env: RECOVERY_ENV, timeoutMs: timeoutMs(deadlineAt, capMs) }
  if (input !== undefined) options.input = input
  return options
}

function commandResult(commandRunner, file, args, options, label) {
  let result
  try { result = commandRunner(file, args, options) } catch { fail(`${label} command failed`) }
  if (!result || result.error || !Number.isInteger(result.status)) fail(`${label} command failed`)
  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout ?? ''),
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  }
}

function safeFailure(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'recovery failed')
  return message
    .replace(/[A-Za-z]:[\\/][^\s]*/g, '<path>')
    .replace(/\/(?:[^\s/]+\/){1,}[^\s/]*/g, '<path>')
    .replace(/\b(password|secret|token|credential|private.?key|access.?key)\s*[:=]\s*[^\s,;)]+/gi, '$1=<redacted>')
    .replace(/\b[0-9a-f]{64,}\b/gi, '<hex>')
    .replace(/[^\x20-\x7e]/g, '?')
    .slice(0, MAX_FAILURE_LENGTH)
}

function assertSnapshot(snapshot, key) {
  if (!snapshot || typeof snapshot.text !== 'string' || typeof snapshot.sha256 !== 'string') fail(`${key} firewall snapshot is unavailable`)
}

function firewallBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value)
  if (typeof value === 'string') return Buffer.from(value, 'utf8')
  fail('firewall mismatch input is invalid')
}

function positionalLineDigests(bytes) {
  const lines = []
  let start = 0
  for (let offset = 0; offset <= bytes.length; offset += 1) {
    if (offset < bytes.length && bytes[offset] !== 0x0a) continue
    if (lines.length >= FIREWALL_DIAGNOSTIC_LINE_CAP) {
      return Object.freeze({ lines: Object.freeze(lines), truncated: true })
    }
    const line = bytes.subarray(start, offset)
    lines.push(Object.freeze({
      sha256: sha256(line),
      byteLength: line.length,
    }))
    start = offset + 1
  }
  return Object.freeze({ lines: Object.freeze(lines), truncated: false })
}

function firstDifferingByteOffset(before, after) {
  const commonLength = Math.min(before.length, after.length)
  for (let offset = 0; offset < commonLength; offset += 1) {
    if (before[offset] !== after[offset]) return offset
  }
  return before.length === after.length ? null : commonLength
}

/**
 * Parse only the counter-bearing line forms emitted by iptables-save.
 *
 * This intentionally does not attempt to parse the complete iptables grammar.
 * A changed line must be one of these narrow forms; unchanged lines need no
 * interpretation. Any quoting/comment syntax is rejected so a `-c` string
 * cannot be mistaken for a counter token.
 */
function parseCounterLine(line) {
  if (typeof line !== 'string' || line.length === 0 || /[\r\t\0"'\\]/.test(line)) return null
  if (line.includes('--comment') || line.startsWith('#')) return null
  const tokens = line.split(' ')
  if (tokens.some((token) => token.length === 0)) return null

  if (tokens[0]?.startsWith(':')) {
    if (tokens.length !== 3) return null
    const chain = tokens[0].slice(1)
    const policy = tokens[1]
    const counter = /^\[([0-9]+):([0-9]+)\]$/.exec(tokens[2])
    if (!SAFE_CHAIN_TOKEN.test(chain) || !SAFE_POLICY_TOKEN.test(policy) || !counter) return null
    return { kind: 'chain', counterIndex: 2 }
  }

  if (tokens[0] !== '-A' || !SAFE_CHAIN_TOKEN.test(tokens[1] ?? '')) return null
  let counterIndexes = null
  for (let index = 2; index < tokens.length; index += 1) {
    if (tokens[index] !== '-c') continue
    if (counterIndexes || !DECIMAL_COUNTER.test(tokens[index + 1] ?? '') || !DECIMAL_COUNTER.test(tokens[index + 2] ?? '')) return null
    counterIndexes = [index + 1, index + 2]
    index += 2
  }
  return { kind: 'rule', counterIndexes: counterIndexes ?? [] }
}

function canonicalCounterLine(line, parsed) {
  const tokens = line.split(' ')
  if (parsed.kind === 'chain') {
    tokens[parsed.counterIndex] = '[PACKETS:BYTES]'
  } else {
    for (const index of parsed.counterIndexes) tokens[index] = index === parsed.counterIndexes[0] ? 'PACKETS' : 'BYTES'
  }
  return tokens.join(' ')
}

function counterOnlyRuleset(beforeText, afterText) {
  const beforeLines = String(beforeText).split('\n')
  const afterLines = String(afterText).split('\n')
  if (beforeLines.length !== afterLines.length) return false

  let changedCounterLine = false
  for (let index = 0; index < beforeLines.length; index += 1) {
    const beforeLine = beforeLines[index]
    const afterLine = afterLines[index]
    if (beforeLine === afterLine) continue

    const beforeParsed = parseCounterLine(beforeLine)
    const afterParsed = parseCounterLine(afterLine)
    if (!beforeParsed || !afterParsed || beforeParsed.kind !== afterParsed.kind) return false
    if (beforeParsed.kind === 'chain' && afterParsed.kind === 'chain') {
      if (beforeParsed.counterIndex !== afterParsed.counterIndex) return false
    } else if (JSON.stringify(beforeParsed.counterIndexes) !== JSON.stringify(afterParsed.counterIndexes)) {
      return false
    }
    if (canonicalCounterLine(beforeLine, beforeParsed) !== canonicalCounterLine(afterLine, afterParsed)) return false
    changedCounterLine = true
  }
  return changedCounterLine
}

function exactAsciiFirewallText(bytes) {
  for (const value of bytes) {
    if (value === 0x0a || (value >= 0x20 && value <= 0x7e)) continue
    return null
  }
  return bytes.toString('ascii')
}

/**
 * Return sanitized mismatch evidence without relaxing byte-for-byte recovery.
 * Buffers are retained as bytes for every hash and offset; textual parsing is
 * allowed only for exact ASCII iptables-save output and otherwise fails closed.
 */
export function analyzeFirewallMismatch(beforeValue, afterValue) {
  const before = firewallBytes(beforeValue)
  const after = firewallBytes(afterValue)
  const preLineDigests = positionalLineDigests(before)
  const postLineDigests = positionalLineDigests(after)
  const lineDigestTruncated = preLineDigests.truncated || postLineDigests.truncated
  // Do not parse/classify a full textual ruleset after either family has
  // exceeded the positional evidence cap. Hashes and byte offsets remain
  // useful, while classification must fail closed for incomplete evidence.
  const beforeText = lineDigestTruncated ? null : exactAsciiFirewallText(before)
  const afterText = lineDigestTruncated ? null : exactAsciiFirewallText(after)
  return Object.freeze({
    preByteLength: before.length,
    postByteLength: after.length,
    preSha256: sha256(before),
    postSha256: sha256(after),
    firstDifferingByteOffset: firstDifferingByteOffset(before, after),
    preLines: preLineDigests.lines,
    postLines: postLineDigests.lines,
    counterOnly: beforeText !== null && afterText !== null && counterOnlyRuleset(beforeText, afterText),
    lineDigestTruncated,
  })
}

/** Capture complete in-memory IPv4 and IPv6 rulesets. Rules never leave this process. */
export function captureFirewallSnapshots({ commandRunner, cwd, env, deadlineAt, perCommandTimeoutMs = 120_000 } = {}) {
  if (typeof commandRunner !== 'function') fail('firewall command runner is required')
  const snapshots = {}
  for (const firewall of FIREWALLS) {
    const result = commandResult(commandRunner, RECOVERY_BINARIES.sudo, ['-n', firewall.save], recoveryCommandOptions({ cwd, deadlineAt, capMs: perCommandTimeoutMs }), `${firewall.key} firewall snapshot`)
    if (result.status !== 0) fail(`${firewall.key} firewall snapshot failed`)
    snapshots[firewall.key] = {
      status: result.status,
      text: result.stdout,
      sha256: sha256(result.stdout),
    }
  }
  return Object.freeze(snapshots)
}

/** Restore both snapshots and then capture fresh bytes for exact comparison. */
export function restoreFirewallSnapshots({ snapshots, commandRunner, cwd, env, deadlineAt, perCommandTimeoutMs = FIREWALL_COMMAND_CAP_MS } = {}) {
  const outcome = {
    status: 'failed',
    timedOut: false,
    ipv4: { status: 'missing', preSha256: null, postSha256: null, byteEqual: false, diagnostic: null },
    ipv6: { status: 'missing', preSha256: null, postSha256: null, byteEqual: false, diagnostic: null },
    equal: false,
    failures: [],
  }
  const available = {}
  for (const firewall of FIREWALLS) {
    const snapshot = snapshots?.[firewall.key]
    const state = outcome[firewall.key]
    if (!snapshot) {
      outcome.failures.push(`${firewall.key} snapshot missing`)
      continue
    }
    try { assertSnapshot(snapshot, firewall.key) } catch (error) {
      outcome.failures.push(safeFailure(error))
      continue
    }
    state.preSha256 = snapshot.sha256
    const result = (() => {
      try {
        return commandResult(commandRunner, RECOVERY_BINARIES.sudo, ['-n', firewall.restore, '--counters'], recoveryCommandOptions({ cwd, deadlineAt, input: snapshot.text, capMs: perCommandTimeoutMs }), `${firewall.key} firewall restore`)
      } catch (error) {
        outcome.failures.push(safeFailure(error))
        return null
      }
    })()
    state.status = result?.status === 0 ? 'passed' : 'failed'
    if (state.status !== 'passed') outcome.failures.push(`${firewall.key} firewall restore failed`)
    available[firewall.key] = snapshot
  }
  let fresh = null
  try {
    fresh = captureFirewallSnapshots({ commandRunner, cwd, env, deadlineAt, perCommandTimeoutMs })
  } catch (error) {
    outcome.failures.push(safeFailure(error))
    outcome.timedOut = Number.isFinite(deadlineAt) && Date.now() >= deadlineAt
  }
  for (const firewall of FIREWALLS) {
    const state = outcome[firewall.key]
    const current = fresh?.[firewall.key]
    if (current) {
      state.postSha256 = current.sha256
      state.byteEqual = available[firewall.key]?.text === current.text
      if (!state.byteEqual) {
        state.diagnostic = analyzeFirewallMismatch(available[firewall.key]?.text, current.text)
        outcome.failures.push(`${firewall.key} firewall bytes differ after restore`)
      }
    }
  }
  outcome.equal = FIREWALLS.every(({ key }) => outcome[key].status === 'passed' && outcome[key].byteEqual)
  outcome.status = outcome.equal ? 'passed' : 'failed'
  return Object.freeze({ outcome, fresh })
}

function assertEmptyHostInspection(inspection) {
  if (!object(inspection) || !object(inspection.inventory)) fail('dedicated Docker host inspection is invalid')
  const values = Object.values(inspection.inventory)
  if (values.length === 0 || values.some((value) => value !== 0)) fail('dedicated Docker host preflight inventory is not empty')
  return inspection
}

function controllerOptions({ hostController, commandRunner, hostOptions = {}, lock, allowMutableInventory }) {
  const options = { ...hostOptions }
  // A controller command runner is a separate, explicit test-only injection;
  // never inherit one hidden inside the general host options bag.
  delete options.commandRunner
  if (commandRunner !== undefined) options.commandRunner = commandRunner
  if (lock !== undefined) options.lock = lock
  if (allowMutableInventory !== undefined) options.allowMutableInventory = allowMutableInventory
  return options
}

/** Acquire and retain the verified native-host lock through the full lifecycle. */
export function acquireVerifiedHost({ hostController = {}, commandRunner, hostOptions = {} } = {}) {
  if (commandRunner !== undefined && typeof commandRunner !== 'function') fail('native host command runner must be a function')
  const controller = {
    acquireHostLock: hostController.acquireHostLock ?? acquireHostLock,
    inspectDedicatedNativeDockerHost: hostController.inspectDedicatedNativeDockerHost ?? inspectDedicatedNativeDockerHost,
    releaseHostLock: hostController.releaseHostLock ?? releaseHostLock,
    resetDedicatedNativeDockerHost: hostController.resetDedicatedNativeDockerHost ?? resetDedicatedNativeDockerHost,
  }
  const lock = controller.acquireHostLock(controllerOptions({ hostController, commandRunner, hostOptions }))
  if (!lock || typeof lock !== 'object') fail('native Docker host lock token is missing')
  try {
    const inspection = assertEmptyHostInspection(controller.inspectDedicatedNativeDockerHost(controllerOptions({ hostController, commandRunner, hostOptions, lock, allowMutableInventory: false })))
    return Object.freeze({ lock, inspection, controller })
  } catch (error) {
    try { controller.releaseHostLock(lock, controllerOptions({ hostController, commandRunner, hostOptions })) } catch { /* preserve primary failure */ }
    throw error
  }
}

function callHostInspection(controller, commandRunner, hostOptions, lock) {
  return assertEmptyHostInspection(controller.inspectDedicatedNativeDockerHost(controllerOptions({ hostController: controller, commandRunner, hostOptions, lock, allowMutableInventory: false })))
}

/** Reset the verified dedicated daemon, restore both firewalls, and re-inspect the empty host. */
export function recoverDedicatedHost({ lock, inspectionBefore, hostController = {}, commandRunner, hostCommandRunner, hostOptions = {}, cwd, env, snapshots, deadlineAt, recoveryDeadlineAt, bodyBegan = true, allowDisposableDaemonReset = false } = {}) {
  if (hostCommandRunner !== undefined && typeof hostCommandRunner !== 'function') fail('native host command runner must be a function')
  const recoveryStarted = Date.now()
  const recoveryDeadline = Number.isFinite(recoveryDeadlineAt) ? recoveryDeadlineAt : Date.now() + DEFAULT_RECOVERY_BUDGET_MS
  const resetDeadline = Math.max(recoveryStarted, recoveryDeadline - FIREWALL_RECOVERY_RESERVE_MS)
  const controller = {
    resetDedicatedNativeDockerHost: hostController.resetDedicatedNativeDockerHost ?? resetDedicatedNativeDockerHost,
    inspectDedicatedNativeDockerHost: hostController.inspectDedicatedNativeDockerHost ?? inspectDedicatedNativeDockerHost,
  }
  const recovery = {
    attempted: Boolean(bodyBegan),
    budgetMs: Math.max(0, recoveryDeadline - recoveryStarted),
    resetBudgetMs: Math.max(0, resetDeadline - recoveryStarted),
    firewallBudgetMs: Math.min(FIREWALL_RECOVERY_RESERVE_MS, Math.max(0, recoveryDeadline - resetDeadline)),
    timedOut: false,
    dockerDaemonReset: false,
    hostBefore: inspectionBefore ?? null,
    hostAfter: null,
    firewall: null,
    failures: [],
    phases: {},
  }
  if (!bodyBegan) return Object.freeze(recovery)
  const resetStarted = Date.now()
  if (!allowDisposableDaemonReset) {
    recovery.failures.push('disposable daemon reset opt-in is missing')
    recovery.phases.reset = { status: 'failed', timedOut: false, durationMs: Date.now() - resetStarted }
  } else if (!lock || !inspectionBefore) {
    recovery.failures.push('verified host lock or preflight inspection is missing')
    recovery.phases.reset = { status: 'failed', timedOut: false, durationMs: Date.now() - resetStarted }
  } else {
    try {
      if (Date.now() >= resetDeadline) fail('dedicated Docker host reset budget is exhausted')
      const reset = controller.resetDedicatedNativeDockerHost(controllerOptions({ hostController: controller, commandRunner: hostCommandRunner, hostOptions: { ...hostOptions, recoveryDeadlineAt: resetDeadline }, lock }))
      recovery.dockerDaemonReset = reset?.dockerDaemonReset === true
      if (!recovery.dockerDaemonReset) recovery.failures.push('dedicated Docker daemon reset was not verified')
      if (reset?.before) recovery.hostBefore = reset.before
      recovery.phases.reset = { status: recovery.dockerDaemonReset ? 'passed' : 'failed', timedOut: false, durationMs: Date.now() - resetStarted }
    } catch (error) {
      recovery.failures.push(safeFailure(error))
      recovery.timedOut ||= Date.now() >= resetDeadline || /timed? ?out|deadline|budget is exhausted/i.test(String(error?.message))
      recovery.phases.reset = { status: 'failed', timedOut: recovery.timedOut, durationMs: Date.now() - resetStarted }
    }
  }
  // This is intentionally a separate finally-equivalent block: a reset error
  // must never suppress either firewall restore attempt.
  const firewallStarted = Date.now()
  try {
    // Recovery owns an independent bounded budget.  The proof deadline may be
    // expired after a timed-out body, but both firewall families still get
    // restore and byte-proof attempts under this fresh deadline.
    recovery.firewall = restoreFirewallSnapshots({ snapshots, commandRunner, cwd, env, deadlineAt: recoveryDeadline, perCommandTimeoutMs: FIREWALL_COMMAND_CAP_MS }).outcome
    if (recovery.firewall.equal !== true) recovery.failures.push(...(recovery.firewall.failures ?? []))
    recovery.phases.firewall = { status: recovery.firewall.equal === true ? 'passed' : 'failed', timedOut: recovery.firewall.timedOut === true, durationMs: Date.now() - firewallStarted }
  } catch (error) {
    recovery.firewall = { status: 'failed', equal: false, failures: [safeFailure(error)] }
    recovery.failures.push(safeFailure(error))
    recovery.timedOut ||= Date.now() >= recoveryDeadline
    recovery.phases.firewall = { status: 'failed', timedOut: recovery.timedOut, durationMs: Date.now() - firewallStarted }
  }
  const hostStarted = Date.now()
  try {
    recovery.hostAfter = callHostInspection(controller, hostCommandRunner, hostOptions, lock)
    recovery.phases.hostInspection = { status: 'passed', timedOut: false, durationMs: Date.now() - hostStarted }
  } catch (error) {
    recovery.failures.push(safeFailure(error))
    recovery.timedOut ||= Date.now() >= recoveryDeadline
    recovery.phases.hostInspection = { status: 'failed', timedOut: recovery.timedOut, durationMs: Date.now() - hostStarted }
  }
  if (!recovery.hostAfter) recovery.failures.push('post-reset dedicated Docker host inspection failed')
  return Object.freeze(recovery)
}

function exactTarget(target, expected, label) {
  if (typeof target !== 'string' || resolve(target) !== resolve(expected) || !resolve(target).startsWith(`${resolve(dirname(expected))}${sep}`)) fail(`${label} target is not exact`)
}

function assertNoSymlinkAncestors(target, label) {
  let cursor = resolve(target)
  while (true) {
    let stats
    try { stats = lstatSync(cursor) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const missingParent = dirname(cursor)
      if (missingParent === cursor) break
      cursor = missingParent
      continue
    }
    if (stats.isSymbolicLink()) fail(`${label} has a symlink`)
    const parent = dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
}

function verifyRemovableDirectory(target, expected, label, ownerUid, { allowRootOwner = true } = {}) {
  exactTarget(target, expected, label)
  assertNoSymlinkAncestors(target, label)
  let stats
  try { stats = lstatSync(target) } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) fail(`${label} is not a safe directory`)
  if (realpathSync(target) !== resolve(target)) fail(`${label} is not canonical`)
  // Directory nlink counts child directories; it is not a hardlink-alias
  // signal. File and symlink safety remains enforced by the checks above.
  if (ownerUid !== undefined && stats.uid !== undefined && stats.uid !== ownerUid && (!allowRootOwner || stats.uid !== 0)) fail(`${label} ownership is not fresh`)
  return true
}

function removeDirectory({ target, expected, label, commandRunner, cwd, env, deadlineAt, ownerUid, allowSudo = true, allowRootOwner = true, removePath = rmSync } = {}) {
  if (!verifyRemovableDirectory(target, expected, label, ownerUid, { allowRootOwner })) return 'absent'
  try {
    removePath(target, { recursive: true, force: true })
  } catch (error) {
    if (!allowSudo) throw error
    const result = commandResult(commandRunner, RECOVERY_BINARIES.sudo, ['-n', RECOVERY_BINARIES.rm, '--recursive', '--force', '--', target], recoveryCommandOptions({ cwd, deadlineAt }), `remove ${label}`)
    if (result.status !== 0) fail(`remove ${label} failed`)
  }
  let exists = false
  try { lstatSync(target); exists = true } catch (error) { if (error?.code !== 'ENOENT') throw error }
  if (exists) fail(`${label} remains after cleanup`)
  return 'removed'
}

function assertGeneratedPathsAbsent(workspaceRoot) {
  for (const generated of GENERATED_WORKSPACE_PATHS) {
    try { lstatSync(join(workspaceRoot, generated.relative)); fail(`generated workspace path remains: ${generated.label}`) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}

/** Remove only this run's generated workspace/run-root paths and reprove Git identity. */
export function cleanupFreshWorkspace({ workspaceRoot, runRoot, proofOutput, sourceSha, treeSha, commandRunner, env, deadlineAt, ownerUid = (typeof process.getuid === 'function' ? process.getuid() : undefined), includeWorkspaceGenerated = true, reproveGit = true, removePath = rmSync } = {}) {
  const outcome = { status: 'failed', timedOut: false, generated: {}, runRoot: 'not-run', proofOutput: 'preserved', git: null, failures: [] }
  const generated = GENERATED_WORKSPACE_PATHS.map((entry) => ({ ...entry, path: join(workspaceRoot, entry.relative) }))
  try {
    if (includeWorkspaceGenerated) {
      for (const entry of generated) outcome.generated[entry.label] = removeDirectory({ target: entry.path, expected: entry.path, label: entry.label, commandRunner, cwd: workspaceRoot, env, deadlineAt, ownerUid, allowSudo: true, allowRootOwner: true, removePath })
      assertGeneratedPathsAbsent(workspaceRoot)
    }
    // The proof body may leave root-owned children in RUNNER_TEMP.  Keep the
    // exact fresh-root/canonical/no-symlink/ownership checks above, then allow
    // only the narrowly scoped passwordless-sudo fallback for this run root.
    outcome.runRoot = removeDirectory({ target: runRoot, expected: runRoot, label: 'run root', commandRunner, cwd: workspaceRoot, env, deadlineAt, ownerUid, allowSudo: true, allowRootOwner: false, removePath })
    if (proofOutput) outcome.proofOutput = 'preserved'
    if (reproveGit) {
      const head = commandResult(commandRunner, 'git', ['rev-parse', 'HEAD'], { cwd: workspaceRoot, env, timeoutMs: timeoutMs(deadlineAt) }, 'Git HEAD recheck').stdout.trim()
      const tree = commandResult(commandRunner, 'git', ['rev-parse', 'HEAD^{tree}'], { cwd: workspaceRoot, env, timeoutMs: timeoutMs(deadlineAt) }, 'Git tree recheck').stdout.trim()
      const dirty = commandResult(commandRunner, 'git', ['status', '--porcelain', '--untracked-files=all'], { cwd: workspaceRoot, env, timeoutMs: timeoutMs(deadlineAt) }, 'Git clean recheck').stdout.trim()
      if (head !== sourceSha || tree !== treeSha || dirty !== '') fail('Git identity or clean status changed during recovery')
      outcome.git = { head: true, tree: true, clean: true }
    }
    outcome.status = 'passed'
  } catch (error) {
    outcome.failures.push(safeFailure(error))
    outcome.timedOut = Number.isFinite(deadlineAt) && Date.now() >= deadlineAt
  }
  return Object.freeze(outcome)
}

/** Remove a partial external artifact root only after strict canonical checks. */
export function removePartialProofOutput({ proofOutput, workspaceRoot, runRoot, commandRunner, env, deadlineAt, ownerUid = (typeof process.getuid === 'function' ? process.getuid() : undefined), removePath = rmSync } = {}) {
  if (!proofOutput) return 'absent'
  const overlaps = (left, right) => {
    const rel = relative(resolve(left), resolve(right))
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep))
  }
  if (overlaps(workspaceRoot, proofOutput) || overlaps(proofOutput, workspaceRoot) || overlaps(runRoot, proofOutput) || overlaps(proofOutput, runRoot)) fail('proof output removal target is unsafe')
  return removeDirectory({ target: proofOutput, expected: proofOutput, label: 'proof output', commandRunner, cwd: workspaceRoot, env, deadlineAt, ownerUid, allowSudo: false, allowRootOwner: false, removePath })
}

export const GENERATED_WORKSPACE_RELATIVE_PATHS = GENERATED_WORKSPACE_PATHS.map(({ relative: path }) => path)
export const FIREWALL_FAMILIES = FIREWALLS.map(({ key, save, restore }) => ({ key, save, restore }))
export const RECOVERY_COMMAND_BINARIES = RECOVERY_BINARIES
export const RECOVERY_COMMAND_ENV = RECOVERY_ENV
export const DISPOSABLE_DAEMON_ROOTS = Object.freeze([
  hostContract.dockerDataRoot,
  hostContract.dockerExecRoot,
  hostContract.containerdRoot,
  hostContract.containerdState,
  dirname(hostContract.marker),
])
