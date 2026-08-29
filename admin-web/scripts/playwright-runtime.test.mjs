import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import test from 'node:test'

import {
  buildReleasePlaywrightEnvironment,
  findAvailablePreviewPort,
  parsePreviewPort,
} from './playwright-runtime.mjs'

test('release environment disables server reuse and enables structured reports', () => {
  assert.deepEqual(
    buildReleasePlaywrightEnvironment({ CAPTURE_COMMAND_CANVAS_EVIDENCE: '1', KEEP: 'yes' }, 4321),
    {
      KEEP: 'yes',
      PLAYWRIGHT_PREVIEW_PORT: '4321',
      PLAYWRIGHT_REUSE_EXISTING_SERVER: '0',
      PLAYWRIGHT_STRUCTURED_REPORTS: '1',
    },
  )
})

test('explicit busy port fails rather than attaching to another worktree server', async () => {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    await assert.rejects(
      findAvailablePreviewPort({ requestedPort: String(port) }),
      /already in use/,
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('port parser rejects invalid values', () => {
  assert.equal(parsePreviewPort('4174'), 4174)
  assert.throws(() => parsePreviewPort('70000'), /at most 65535/)
  assert.throws(() => parsePreviewPort('auto'), /four or five digit/)
})
