import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSnapshotPairGuard } from './visual-snapshot-pair-guard.mjs'

function commandAvailable(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function buildDoctorReport({
  workspaceRoot,
  nodeVersion = process.versions.node,
  platform = process.platform,
}) {
  const checks = []
  const add = (id, status, detail) => checks.push({ id, status, detail })
  const nodeMajor = Number.parseInt(nodeVersion.split('.')[0] ?? '', 10)
  add(
    'node',
    nodeMajor === 24 ? 'pass' : 'error',
    nodeMajor === 24 ? `Node ${nodeVersion}` : `Node 24 required; found ${nodeVersion}`,
  )
  add('platform', 'pass', `${platform}/${process.arch}`)
  add(
    'git',
    existsSync(join(workspaceRoot, '.git')) || commandAvailable('git') ? 'pass' : 'error',
    'Git executable and workspace metadata',
  )

  for (const packagePath of ['admin-web', 'backend/nestjs']) {
    const dependencyPath = join(workspaceRoot, ...packagePath.split('/'), 'node_modules')
    add(
      `${packagePath}:dependencies`,
      existsSync(dependencyPath) ? 'pass' : 'warn',
      existsSync(dependencyPath)
        ? 'dependencies installed'
        : `run npm.cmd --prefix ${packagePath} ci`,
    )
  }

  const playwrightCli = join(
    workspaceRoot,
    'admin-web',
    'node_modules',
    '@playwright',
    'test',
    'cli.js',
  )
  add(
    'playwright',
    existsSync(playwrightCli) ? 'pass' : 'warn',
    existsSync(playwrightCli) ? 'Playwright CLI installed' : 'frontend browser test CLI unavailable',
  )

  const snapshots = runSnapshotPairGuard(workspaceRoot)
  add(
    'visual-snapshots',
    snapshots.errors.length === 0 ? 'pass' : 'error',
    snapshots.errors.length === 0
      ? `${snapshots.pairCount} Linux/Windows pair(s)`
      : snapshots.errors.join('; '),
  )

  return {
    checks,
    errorCount: checks.filter(({ status }) => status === 'error').length,
    warningCount: checks.filter(({ status }) => status === 'warn').length,
  }
}

export function doctorExitCode(report, strict = false) {
  return report.errorCount > 0 || (strict && report.warningCount > 0) ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const workspaceRoot = join(import.meta.dirname, '..')
  const strict = process.argv.includes('--strict')
  const report = buildDoctorReport({ workspaceRoot })
  console.log('[test-doctor] Local verification readiness')
  for (const check of report.checks) {
    console.log(`${check.status.toUpperCase().padEnd(5)} ${check.id}: ${check.detail}`)
  }
  console.log(`Summary: errors=${report.errorCount} warnings=${report.warningCount}`)
  process.exitCode = doctorExitCode(report, strict)
}
