const KEYCLOAK_GRACEFUL_STOP_MARKER = /^.*\bINFO\s+\[io\.quarkus\]\s+\(Shutdown thread\)\s+Keycloak stopped in \d+(?:\.\d+)?s\s*$/m

export const KEYCLOAK_STOP_SIGNAL = 'SIGTERM'
export const KEYCLOAK_STOP_TIMEOUT_SECONDS = 60

function assertSecretSafeLogs(logs, secretValues) {
  for (const entry of secretValues ?? []) {
    const [name, secret] = Array.isArray(entry) ? entry : ['active_secret', entry]
    if (secret && logs.includes(secret)) throw new Error(`secret value leaked into stopped service logs: ${name}`)
  }
}

function safeStopDiagnostic(state) {
  return JSON.stringify({
    status: typeof state.Status === 'string' ? state.Status : 'unknown',
    exitCode: Number.isInteger(state.ExitCode) ? state.ExitCode : null,
    running: state.Running === true,
    restarting: state.Restarting === true,
    oomKilled: state.OOMKilled === true,
    dead: state.Dead === true,
    errorPresent: Boolean(state.Error),
  })
}

function assertCleanStoppedState({ service, state = {} }) {
  const exactService = String(service)
  const allowedExitCodes = exactService === 'keycloak' ? [143] : [0]
  const stoppedCleanly = state.Status === 'exited'
    && state.Running === false
    && state.Paused === false
    && state.Restarting === false
    && state.OOMKilled === false
    && state.Dead === false
    && !state.Error
    && allowedExitCodes.includes(state.ExitCode)
  if (!stoppedCleanly) throw new Error(`${exactService} did not stop gracefully: ${safeStopDiagnostic(state)}`)
  if (exactService === 'keycloak') deriveDockerLogCursor(state)
  return { exitCode: state.ExitCode }
}

function normalizeLogSample(sample) {
  if (typeof sample === 'string') return sample
  return `${sample?.stderr ?? ''}\n${sample?.stdout ?? ''}`
}

const RFC3339_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/

function parseRfc3339Timestamp(value) {
  if (typeof value !== 'string') return null
  const match = value.match(RFC3339_TIMESTAMP)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText = '', zone, sign, offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = Number(offsetHourText ?? 0)
  const offsetMinute = Number(offsetMinuteText ?? 0)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]
    || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return null
  const fractionMilliseconds = Number(`0.${fractionText || '0'}`) * 1000
  if (!Number.isFinite(fractionMilliseconds)) return null
  const base = new Date(0)
  base.setUTCFullYear(year, month - 1, day)
  base.setUTCHours(hour, minute, second, 0)
  const offsetMilliseconds = zone === 'Z' ? 0 : (offsetHour * 60 + offsetMinute) * 60 * 1000 * (sign === '-' ? -1 : 1)
  const baseMilliseconds = base.getTime() - offsetMilliseconds
  const parsedMilliseconds = Date.parse(value)
  if (!Number.isFinite(baseMilliseconds) || !Number.isFinite(parsedMilliseconds)
    || parsedMilliseconds !== baseMilliseconds + Math.floor(fractionMilliseconds)) return null
  const fractionNanoseconds = BigInt((fractionText + '000000000').slice(0, 9) || '0')
  const epochNanoseconds = BigInt(baseMilliseconds) * 1_000_000n + fractionNanoseconds
  const zeroDockerTimestamp = year === 1 && month === 1 && day === 1 && hour === 0 && minute === 0 && second === 0
    && /^0*$/.test(fractionText) && offsetMilliseconds === 0
  if (zeroDockerTimestamp) return null
  return { value, epochNanoseconds }
}

function deriveDockerLogCursor(state) {
  const startedAt = parseRfc3339Timestamp(state?.StartedAt)
  const finishedAt = parseRfc3339Timestamp(state?.FinishedAt)
  // Docker can expose equal lifecycle timestamps at engine precision; equality
  // is still a valid closed window, while a reversed window is stale/unsafe.
  if (!startedAt || !finishedAt || startedAt.epochNanoseconds > finishedAt.epochNanoseconds) {
    throw new Error('keycloak graceful shutdown observation requires a valid Docker lifecycle window')
  }
  return startedAt.value
}

function inspectRecord(inspect) {
  return Array.isArray(inspect) ? (inspect[0] ?? {}) : (inspect ?? {})
}

function validatedContainerId(containerId) {
  const value = typeof containerId === 'string' ? containerId.trim() : ''
  if (!value || /\s/.test(value)) throw new Error('keycloak stop requires a validated container identity')
  return value
}

export function buildKeycloakStopArgs(containerId) {
  const validatedId = validatedContainerId(containerId)
  return ['stop', '--signal', KEYCLOAK_STOP_SIGNAL, '--timeout', String(KEYCLOAK_STOP_TIMEOUT_SECONDS), validatedId]
}

export function assertKeycloakContainerIdentity({ containerId, inspect, expectedRestartCount = 0 } = {}) {
  const record = inspectRecord(inspect)
  const candidateId = validatedContainerId(containerId)
  const inspectedId = validatedContainerId(record.Id)
  if (candidateId !== inspectedId) throw new Error('keycloak container identity contract failed')
  if (!Number.isSafeInteger(record.RestartCount) || record.RestartCount !== expectedRestartCount) {
    throw new Error('keycloak container restart contract failed')
  }
  return { containerId: candidateId, restartCount: record.RestartCount }
}

export function assertKeycloakPreStopState({ containerId, inspect } = {}) {
  const record = inspectRecord(inspect)
  const identity = assertKeycloakContainerIdentity({ containerId, inspect: record, expectedRestartCount: 0 })
  const state = record.State ?? {}
  const healthy = state.Health?.Status === 'healthy'
  const cleanFlags = state.Status === 'running'
    && state.Running === true
    && state.Paused === false
    && state.Restarting === false
    && state.OOMKilled === false
    && state.Dead === false
    && !state.Error
  if (!cleanFlags || !healthy || !parseRfc3339Timestamp(state.StartedAt)) {
    throw new Error('keycloak pre-stop state contract failed')
  }
  return { ...identity, startedAt: state.StartedAt }
}

export function assertControlledKeycloakStop({ beforeInspect, afterInspect } = {}) {
  const before = inspectRecord(beforeInspect)
  const after = inspectRecord(afterInspect)
  const beforeIdentity = assertKeycloakPreStopState({ containerId: before.Id, inspect: before })
  const afterIdentity = assertKeycloakContainerIdentity({ containerId: beforeIdentity.containerId, inspect: after, expectedRestartCount: 0 })
  if (afterIdentity.containerId !== beforeIdentity.containerId
    || afterIdentity.restartCount !== beforeIdentity.restartCount
    || after.State?.StartedAt !== beforeIdentity.startedAt) {
    throw new Error('keycloak container identity/lifecycle continuity contract failed')
  }
  const result = assertCleanStoppedState({ service: 'keycloak', state: after.State ?? {} })
  deriveDockerLogCursor(after.State ?? {})
  return { containerId: beforeIdentity.containerId, restartCount: afterIdentity.restartCount, exitCode: result.exitCode, lifecycleVerified: true }
}

export function assertCleanStoppedServiceState({ service, state = {} }) {
  return assertCleanStoppedState({ service, state })
}

export function assertGracefulStopState({ service, state = {}, logs = '', secretValues = new Map() }) {
  const result = assertCleanStoppedState({ service, state })
  let markerObserved = false
  if (String(service) === 'keycloak') {
    const exactLogs = String(logs)
    assertSecretSafeLogs(exactLogs, secretValues)
    markerObserved = KEYCLOAK_GRACEFUL_STOP_MARKER.test(exactLogs)
  }
  return { ...result, markerObserved }
}

/**
 * Validate a stopped service before reading one post-stop Keycloak log window.
 * The exact shutdown marker is optional telemetry; lifecycle state remains the
 * mandatory proof. The reader is injected so runtime proofs enforce Docker's
 * --since/--timestamps contract while tests remain daemon-free.
 */
export function observeKeycloakGracefulStop({
  service = 'keycloak',
  state = {},
  readLogs,
  secretValues = new Map(),
}) {
  const result = assertCleanStoppedState({ service, state })
  if (String(service) !== 'keycloak') return { ...result, markerObserved: false }
  const since = deriveDockerLogCursor(state)
  if (typeof readLogs !== 'function') throw new Error('keycloak graceful shutdown observation requires a log reader')

  let sample
  try {
    sample = readLogs({ since, timestamps: true })
  } catch {
    throw new Error('keycloak graceful shutdown log retrieval failed')
  }
  const logs = normalizeLogSample(sample)
  assertSecretSafeLogs(logs, secretValues)
  return { ...result, markerObserved: KEYCLOAK_GRACEFUL_STOP_MARKER.test(logs), attempts: 1 }
}
