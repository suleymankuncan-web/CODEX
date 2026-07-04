import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptDir)

loadEnvFile(join(appRoot, '.env.local'))

setEnvFromPilot('AUTH_SMOKE_USERNAME', 'PILOT_SP_USERNAME')
setEnvFromPilot('AUTH_SMOKE_PASSWORD', 'PILOT_SP_PASSWORD')
setEnvFromPilot('AUTH_SMOKE_OTP', 'PILOT_SP_OTP')

process.env.AUTH_SMOKE_EXPECTED_ROLE = 'STORE_PERSONNEL'
process.env.AUTH_SMOKE_EXPECTED_LANDING = '/store/me'

await import('./auth-cookie-session-live-smoke.mjs')

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return
  }

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^(?:\$env:|export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || process.env[match[1]] !== undefined) {
      continue
    }

    process.env[match[1]] = stripEnvQuotes(match[2].trim())
  }
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function setEnvFromPilot(target, source) {
  if (!hasValue(process.env[source])) {
    return
  }

  process.env[target] = process.env[source]
}
