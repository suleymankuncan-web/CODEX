import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const action = process.argv[2]
if (!['upload', 'promote'].includes(action)) {
  throw new Error('Usage: node scripts/cloudflare-release.mjs <upload|promote>')
}

const adminRoot = process.cwd()
const workspaceRoot = join(adminRoot, '..')
const git = (args) => execFileSync('git', args, { cwd: workspaceRoot, encoding: 'utf8' }).trim()
const head = git(['rev-parse', 'HEAD'])
const status = git(['status', '--porcelain', '--untracked-files=all'])

if (status) {
  throw new Error('Cloudflare release requires a clean worktree bound to one committed HEAD')
}

const tag = `git-${head.slice(0, 12)}`
const npmCli = process.env.npm_execpath
if (!npmCli) {
  throw new Error('Cloudflare release must run through the repository npm scripts')
}
const wranglerCli = join(adminRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

if (action === 'upload') {
  const build = spawnSync(process.execPath, [npmCli, 'run', 'build:cloudflare'], {
    cwd: adminRoot,
    env: { ...process.env, VITE_SENTRY_RELEASE: head },
    stdio: 'inherit',
  })
  if (build.error) throw build.error
  if (build.status !== 0) process.exit(build.status ?? 1)

  const postBuildStatus = git(['status', '--porcelain', '--untracked-files=all'])
  if (postBuildStatus) {
    throw new Error('Cloudflare build changed the clean worktree; refusing an unbound upload')
  }
}

if (action === 'promote') {
  execFileSync('git', ['fetch', 'origin', 'main', '--quiet'], { cwd: workspaceRoot })
  const branch = git(['branch', '--show-current'])
  const originMain = git(['rev-parse', 'origin/main'])
  if (branch !== 'main' || head !== originMain) {
    throw new Error('Cloudflare promotion requires main and origin/main to equal the exact HEAD')
  }
}

const args = action === 'upload'
  ? [
      'versions',
      'upload',
      '--strict',
      '--tag',
      tag,
      '--preview-alias',
      tag,
      '--message',
      `git:${head}`,
    ]
  : [
      'versions',
      'deploy',
      '--version-tag',
      `${tag}@100%`,
      '--message',
      `git:${head}`,
      '--yes',
    ]

const result = spawnSync(process.execPath, [wranglerCli, ...args], {
  cwd: adminRoot,
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
