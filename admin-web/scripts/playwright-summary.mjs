import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function buildPlaywrightSummary(report) {
  const stats = report?.stats ?? {}
  const expected = Number(stats.expected ?? 0)
  const unexpected = Number(stats.unexpected ?? 0)
  const flaky = Number(stats.flaky ?? 0)
  const skipped = Number(stats.skipped ?? 0)
  const durationMs = Number(stats.duration ?? 0)
  const total = expected + unexpected + flaky + skipped
  const outcome = unexpected > 0 ? 'FAIL' : 'PASS'
  return [
    '## Frontend Playwright proof',
    '',
    `**${outcome}** — ${total} tests · ${expected} passed · ${unexpected} failed · ${flaky} flaky · ${skipped} skipped`,
    '',
    `Duration: ${(durationMs / 60_000).toFixed(2)} minutes`,
    '',
  ].join('\n')
}

export function materializePlaywrightSummary({ reportPath, summaryPath }) {
  if (!existsSync(reportPath)) {
    const missing = '## Frontend Playwright proof\n\nStructured report was not materialized.\n\n'
    if (summaryPath) appendFileSync(summaryPath, missing)
    return { found: false, markdown: missing }
  }
  const markdown = buildPlaywrightSummary(JSON.parse(readFileSync(reportPath, 'utf8')))
  if (summaryPath) appendFileSync(summaryPath, markdown)
  return { found: true, markdown }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const adminRoot = join(import.meta.dirname, '..')
  const result = materializePlaywrightSummary({
    reportPath: join(adminRoot, 'test-results', 'playwright-results.json'),
    summaryPath: process.env.GITHUB_STEP_SUMMARY,
  })
  console.log(result.markdown.trim())
}
