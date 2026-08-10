const KEYCLOAK_GRACEFUL_STOP_MARKER = /^.*\bINFO\s+\[io\.quarkus\]\s+\(Shutdown thread\)\s+Keycloak stopped in \d+(?:\.\d+)?s\s*$/m

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

export function assertGracefulStopState({ service, state = {}, logs = '', secretValues = new Map() }) {
  const exactService = String(service)
  const exactLogs = String(logs)
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
  if (exactService === 'keycloak') {
    assertSecretSafeLogs(exactLogs, secretValues)
    if (!KEYCLOAK_GRACEFUL_STOP_MARKER.test(exactLogs)) throw new Error('keycloak graceful shutdown marker missing')
  }
  return { exitCode: state.ExitCode, markerObserved: exactService === 'keycloak' }
}
