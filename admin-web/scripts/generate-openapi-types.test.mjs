import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function runGenerator(args = [], env = {}) {
  return spawnSync(process.execPath, ['scripts/generate-openapi-types.mjs', ...args], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  })
}

test('frontend OpenAPI generator selection matches the tracked API document', () => {
  const result = runGenerator(['--check'])
  const output = `${result.stdout}\n${result.stderr}`

  assert.equal(result.status, 0, output)
  assert.match(output, /Generated OpenAPI types are current\./)
  const generated = readFileSync(join(appRoot, 'src/generated/openapi-types.ts'), 'utf8')
  assert.match(generated, /"\/api\/checklists\/command-canvas\/visit-plans\/period"/)
  assert.match(generated, /"\/api\/checklists\/command-canvas\/visit-plans\/candidates"/)
  assert.match(generated, /ChecklistVisitPlanPeriodResponse/)
  assert.match(generated, /ChecklistVisitPlanCandidateResponse/)
})

test('frontend OpenAPI generator fails when a selected operation is absent', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'openapi-selection-'))
  const openApiPath = join(tempDir, 'openapi.json')
  const outputPath = join(tempDir, 'openapi-types.ts')

  try {
    writeFileSync(
      openApiPath,
      JSON.stringify({
        openapi: '3.0.0',
        paths: {
          '/api/auth/bootstrap': {
            get: {
              responses: {
                200: {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          ok: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {},
        },
      }),
    )

    const result = runGenerator([], {
      OPENAPI_TYPES_SOURCE: openApiPath,
      OPENAPI_TYPES_OUTPUT: outputPath,
    })
    const output = `${result.stdout}\n${result.stderr}`

    assert.notEqual(result.status, 0)
    assert.match(output, /Selected OpenAPI operations are missing/)
    assert.match(output, /GET \/api\/auth\/action-store-assignments/)
    assert.equal(existsSync(outputPath), false)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
