const KEYCLOAK_GRACEFUL_STOP_MARKER = /^.*\bINFO\s+\[io\.quarkus\]\s+\(Shutdown thread\)\s+Keycloak stopped in \d+(?:\.\d+)?s\s*$/m

// Docker can report a container as exited before its logging driver has made
// the final shutdown line visible. Keep the exact marker fail-closed, but give
// the bounded snapshot reader enough time for that asynchronous flush.
export const KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS = 30
export const KEYCLOAK_GRACEFUL_STOP_WAIT_MS = 1000

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
  const allowedExitCodes = exactService === 'keycloak' ? [0, 143] : [0]
  const stoppedCleanly = state.Status === 'exited'
    && state.Running === false
    && state.Paused === false
    && state.Restarting === false
    && state.OOMKilled === false
    && state.Dead === false
    && !state.Error
    && allowedExitCodes.includes(state.ExitCode)
  if (!stoppedCleanly) throw new Error(`${exactService} did not stop gracefully: ${safeStopDiagnostic(state)}`)
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

function gracefulStopExhaustionDiagnostic(state, attempts) {
  const exitCode = Number.isSafeInteger(state?.ExitCode) && state.ExitCode >= 0 && state.ExitCode <= 255 ? state.ExitCode : null
  const status = state?.Status === 'exited' ? 'exited' : 'unknown'
  return `keycloak graceful shutdown marker missing (category=marker-missing; exitCode=${exitCode}; state=${status}; windowValid=true; attempts=${attempts})`
}

export function assertCleanStoppedServiceState({ service, state = {} }) {
  return assertCleanStoppedState({ service, state })
}

export function assertGracefulStopState({ service, state = {}, logs = '', secretValues = new Map() }) {
  const result = assertCleanStoppedState({ service, state })
  if (String(service) === 'keycloak') {
    const exactLogs = String(logs)
    assertSecretSafeLogs(exactLogs, secretValues)
    if (!KEYCLOAK_GRACEFUL_STOP_MARKER.test(exactLogs)) throw new Error('keycloak graceful shutdown marker missing')
  }
  return { ...result, markerObserved: String(service) === 'keycloak' }
}

/**
 * Validate a stopped service before reading any logs, then poll only the
 * post-stop Keycloak log window. The reader is intentionally injected so the
 * runtime proofs can enforce Docker's --since/--timestamps contract while
 * tests exercise delayed, missing, secret-bearing, and failing samples without
 * a live daemon.
 */
export function observeKeycloakGracefulStop({
  service = 'keycloak',
  state = {},
  readLogs,
  wait = () => {},
  secretValues = new Map(),
}) {
  const result = assertCleanStoppedState({ service, state })
  if (String(service) !== 'keycloak') return { ...result, markerObserved: false }
  const since = deriveDockerLogCursor(state)
  if (typeof readLogs !== 'function') throw new Error('keycloak graceful shutdown observation requires a log reader')

  for (let attempt = 0; attempt < KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS; attempt += 1) {
    let sample
    try {
      sample = readLogs({ since, timestamps: true, attempt })
    } catch {
      throw new Error('keycloak graceful shutdown log retrieval failed')
    }
    const logs = normalizeLogSample(sample)
    assertSecretSafeLogs(logs, secretValues)
    if (KEYCLOAK_GRACEFUL_STOP_MARKER.test(logs)) {
      return { ...result, markerObserved: true, attempts: attempt + 1 }
    }
    if (attempt + 1 < KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS) wait(KEYCLOAK_GRACEFUL_STOP_WAIT_MS)
  }
  throw new Error(gracefulStopExhaustionDiagnostic(state, KEYCLOAK_GRACEFUL_STOP_MAX_ATTEMPTS))
}
