import { createServer } from 'node:net'

export function parsePreviewPort(value) {
  if (value === undefined || value === '') return null
  if (!/^\d{4,5}$/u.test(value)) throw new Error('Playwright preview port must be a four or five digit number')
  const port = Number(value)
  if (port > 65_535) throw new Error('Playwright preview port must be at most 65535')
  return port
}

function canListen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true))
    })
  })
}

export async function findAvailablePreviewPort({
  requestedPort,
  startPort = 4174,
  attempts = 100,
} = {}) {
  const parsedRequestedPort = parsePreviewPort(requestedPort)
  if (parsedRequestedPort !== null) {
    if (await canListen(parsedRequestedPort)) return parsedRequestedPort
    throw new Error(`Requested Playwright preview port ${parsedRequestedPort} is already in use`)
  }

  const offset = process.pid % attempts
  for (let index = 0; index < attempts; index += 1) {
    const port = startPort + ((offset + index) % attempts)
    if (await canListen(port)) return port
  }
  throw new Error(`No available Playwright preview port in ${startPort}-${startPort + attempts - 1}`)
}

export function buildReleasePlaywrightEnvironment(environment, previewPort) {
  const result = {
    ...environment,
    PLAYWRIGHT_PREVIEW_PORT: String(previewPort),
    PLAYWRIGHT_REUSE_EXISTING_SERVER: '0',
    PLAYWRIGHT_STRUCTURED_REPORTS: '1',
  }
  delete result.CAPTURE_COMMAND_CANVAS_EVIDENCE
  return result
}
