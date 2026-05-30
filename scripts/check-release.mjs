import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const workspaceRoot = join(import.meta.dirname, '..')

const checks = [
  {
    label: 'Backend release check',
    cwd: join(workspaceRoot, 'backend/nestjs'),
    args: ['run', 'check:release'],
  },
  {
    label: 'Frontend release check',
    cwd: join(workspaceRoot, 'admin-web'),
    args: ['run', 'check:release'],
  },
]

function runMigrationChangeWarning() {
  const result = spawnSync(process.execPath, ['scripts/migration-change-warning.mjs'], {
    cwd: workspaceRoot,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(`Failed to start migration change warning: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function npmRun(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm.cmd', ...args].join(' ')],
    }
  }

  return {
    command: 'npm',
    args,
  }
}

runMigrationChangeWarning()

for (const check of checks) {
  console.log(`\n==> ${check.label}`)
  const command = npmRun(check.args)
  const result = spawnSync(command.command, command.args, {
    cwd: check.cwd,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(`Failed to start ${check.label}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
