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
  const outcome = unexpected > 0 || flaky > 0 || skipped > 0 || report?.errors?.length || total === 0 ? 'FAIL' : 'PASS'
  return [
    '## Frontend Playwright proof',
    '',
    `**${outcome}** — ${total} tests · ${expected} passed · ${unexpected} failed · ${flaky} flaky · ${skipped} skipped`,
    '',
    `Duration: ${(durationMs / 60_000).toFixed(2)} minutes`,
    '',
  ].join('\n')
}

export function materializePlaywrightSummary({ reportPath, summaryPath, ledgerPath }) {
  if (!existsSync(reportPath)) {
    const missing = '## Frontend Playwright proof\n\nStructured report was not materialized.\n\n'
    if (summaryPath) appendFileSync(summaryPath, missing)
    return { found: false, markdown: missing }
  }
  let markdown = buildPlaywrightSummary(JSON.parse(readFileSync(reportPath, 'utf8')))
  if (ledgerPath && existsSync(ledgerPath)) {
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
    markdown += '**Complete inventory: ' + ledger.outcome.toUpperCase() + '** — ' +
      ledger.executedCount + ' executed + ' + ledger.reusedCount + ' retained = ' + ledger.cases.length + ' cases.\n\n'
    markdown += 'Wall time: ' + (ledger.wallTimeMs / 60000).toFixed(2) +
      ' min; retained prior case time: ' + (ledger.retainedPriorDurationMs / 1000).toFixed(1) + 's (not wall-time savings).\n\n'
    const slowest = [...ledger.cases].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10)
    markdown += 'Slowest cases (current execution or retained prior measurement):\n\n' +
      slowest.map((item) => '- ' + item.file + ': ' + (item.durationMs / 1000).toFixed(1) + 's').join('\n') + '\n\n'
  }
  if (summaryPath) appendFileSync(summaryPath, markdown)
  return { found: true, markdown }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const adminRoot = join(import.meta.dirname, '..')
  const result = materializePlaywrightSummary({
    reportPath: join(adminRoot, 'test-results', 'playwright-results.json'),
    summaryPath: process.env.GITHUB_STEP_SUMMARY,
    ledgerPath: join(adminRoot, '..', 'tmp/release-gate/playwright-recovery.json'),
  })
  console.log(result.markdown.trim())
}
