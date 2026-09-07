import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commandInvocation } from './release-stage-runner.mjs'

export function checkInstalledDependencies({ workspaceRoot, run = spawnSync }) {
  const invocation = commandInvocation(['npm', 'ls', '--all', '--json'])
  for (const project of ['backend/nestjs', 'admin-web']) {
    const result = run(invocation.command, invocation.args, {
      cwd: join(workspaceRoot, project), encoding: 'utf8', windowsHide: true,
      timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    })
    let tree
    try { tree = JSON.parse(result.stdout) } catch { /* malformed output fails closed below */ }
    // npm can report harmless optional-platform extras with exit 0 after npm ci.
    // Missing/invalid/unknown problems still fail; this is not an inventory purge.
    const problems = tree?.problems ?? []
    if (result.error || result.status !== 0 || !tree?.dependencies || tree.error ||
        !Array.isArray(problems) || problems.some(problem => typeof problem !== 'string' || !problem.startsWith('extraneous: '))) {
      throw new Error(`Dependency preflight failed for ${project}; inspect npm ls and run npm ci in that worktree before release`)
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkInstalledDependencies({ workspaceRoot: fileURLToPath(new URL('..', import.meta.url)) })
  console.log('[dependency-preflight] installed dependency trees satisfy npm constraints')
}
