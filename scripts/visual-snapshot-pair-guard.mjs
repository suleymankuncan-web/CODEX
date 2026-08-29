import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SNAPSHOT_PATTERN = /^(.*)-chromium-(linux|win32)\.png$/u

function normalizePath(value) {
  return value.replaceAll('\\', '/')
}

export function snapshotPairKey(path) {
  const normalized = normalizePath(path)
  const match = normalized.match(SNAPSHOT_PATTERN)
  return match ? { key: match[1], platform: match[2] } : null
}

export function validateSnapshotPairs(snapshotFiles, changedFiles = []) {
  const groups = new Map()
  for (const path of snapshotFiles.map(normalizePath)) {
    const identity = snapshotPairKey(path)
    if (!identity) continue
    const platforms = groups.get(identity.key) ?? new Map()
    platforms.set(identity.platform, path)
    groups.set(identity.key, platforms)
  }

  const changed = new Set(changedFiles.map(normalizePath))
  const errors = []
  for (const [key, platforms] of groups) {
    const linux = platforms.get('linux')
    const win32 = platforms.get('win32')
    if (!linux || !win32) {
      errors.push(`${key}: missing ${linux ? 'win32' : 'linux'} snapshot counterpart`)
      continue
    }

    const linuxChanged = changed.has(linux)
    const win32Changed = changed.has(win32)
    if (linuxChanged !== win32Changed) {
      errors.push(
        `${key}: ${linuxChanged ? 'linux' : 'win32'} changed without its ${linuxChanged ? 'win32' : 'linux'} counterpart`,
      )
    }
  }

  return { pairCount: groups.size, errors }
}

function walkPngFiles(directory, workspaceRoot, output = []) {
  if (!existsSync(directory)) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walkPngFiles(path, workspaceRoot, output)
    else if (entry.isFile() && entry.name.endsWith('.png')) {
      output.push(normalizePath(relative(workspaceRoot, path)))
    }
  }
  return output
}

function git(workspaceRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

export function changedFilesFromGit(workspaceRoot) {
  const mergeBase = git(workspaceRoot, ['merge-base', 'origin/main', 'HEAD']).trim()
  const commands = [
    ['diff', '--name-only'],
    ['diff', '--name-only', '--cached'],
    mergeBase ? ['diff', '--name-only', mergeBase, 'HEAD'] : null,
  ].filter(Boolean)

  return [
    ...new Set(
      commands.flatMap((args) =>
        git(workspaceRoot, args)
          .split(/\r?\n/u)
          .map(normalizePath)
          .filter(Boolean),
      ),
    ),
  ]
}

export function runSnapshotPairGuard(workspaceRoot) {
  const snapshotFiles = walkPngFiles(join(workspaceRoot, 'admin-web', 'e2e'), workspaceRoot)
  return validateSnapshotPairs(snapshotFiles, changedFilesFromGit(workspaceRoot))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const workspaceRoot = join(import.meta.dirname, '..')
  const result = runSnapshotPairGuard(workspaceRoot)
  if (result.errors.length > 0) {
    console.error('[visual-snapshots] FAIL')
    for (const error of result.errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log(`[visual-snapshots] PASS pairs=${result.pairCount}`)
  }
}
