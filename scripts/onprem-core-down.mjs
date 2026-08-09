import { spawnSync } from 'node:child_process'

const compose = process.argv[2] ?? 'infra/onprem/core/compose.yaml'
const envFile = process.argv[3]
if (!envFile) {
  console.error('usage: node scripts/onprem-core-down.mjs <compose-file> <env-file>')
  process.exit(2)
}

const args = ['compose', '--env-file', envFile, '--file', compose, '--profile', 'infra', '--profile', 'migrate', '--profile', 'seed', '--profile', 'runtime', 'down', '--remove-orphans']
if (args.includes('--volumes') || args.includes('-v')) throw new Error('rollback down must preserve named volumes')
const result = spawnSync('docker', args, { stdio: 'inherit', windowsHide: true })
process.exitCode = result.status ?? 1
