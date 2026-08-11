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

function isRfc3339Timestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/.test(value)
    && Number.isFinite(Date.parse(value))
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
  since,
  readLogs,
  wait = () => {},
  secretValues = new Map(),
}) {
  const result = assertCleanStoppedState({ service, state })
  if (String(service) !== 'keycloak') return { ...result, markerObserved: false }
  if (!isRfc3339Timestamp(since)) throw new Error('keycloak graceful shutdown observation requires an RFC3339 stop timestamp')
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
  throw new Error('keycloak graceful shutdown marker missing')
}
