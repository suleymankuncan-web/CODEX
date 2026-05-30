import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const envChangedFiles = process.env.HR_AXIS_CHANGED_FILES

const migrationSensitivePatterns = [
  /^db\/schema\.sql$/,
  /^db\/migrations\/.+\.sql$/,
  /^backend\/nestjs\/scripts\/run-migrations\.ts$/,
  /^backend\/nestjs\/src\/shared\/database\/migration[^/]*\.ts$/,
  /^backend\/nestjs\/src\/shared\/database\/migrations\.controller\.ts$/,
  /^scripts\/migration-fresh-db-smoke\.mjs$/,
]

function normalizePath(path) {
  return path.trim().replaceAll('\\', '/')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function parseChangedFiles(text) {
  return unique(text.split(/[\r\n,]+/).map(normalizePath))
}

function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

function fetchGitHubRefs(...refs) {
  if (!process.env.GITHUB_ACTIONS) {
    return
  }

  for (const ref of refs.filter(Boolean)) {
    git(['fetch', '--no-tags', '--depth=1', 'origin', ref])
  }
}

function changedFilesFromGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) {
    return []
  }

  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'))
    const baseSha = event.pull_request?.base?.sha
    const headSha = event.pull_request?.head?.sha
    if (!baseSha || !headSha) {
      return []
    }

    fetchGitHubRefs(baseSha, headSha)
    return parseChangedFiles(git(['diff', '--name-only', `${baseSha}...${headSha}`]))
  } catch {
    return []
  }
}

function changedFilesFromGit() {
  const baseRef = process.env.GITHUB_BASE_REF
  fetchGitHubRefs(baseRef)

  const candidates = [
    ['diff', '--name-only'],
    ['diff', '--name-only', '--cached'],
    baseRef ? ['diff', '--name-only', `origin/${baseRef}...HEAD`] : null,
    ['diff', '--name-only', 'origin/main...HEAD'],
    ['diff', '--name-only', 'HEAD~1..HEAD'],
    ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
  ].filter(Boolean)

  for (const args of candidates) {
    const files = parseChangedFiles(git(args))
    if (files.length > 0) {
      return files
    }
  }

  return []
}

function changedFiles() {
  if (envChangedFiles) {
    return parseChangedFiles(envChangedFiles)
  }

  return unique([...changedFilesFromGitHubEvent(), ...changedFilesFromGit()])
}

function isMigrationSensitive(path) {
  return migrationSensitivePatterns.some((pattern) => pattern.test(path))
}

const sensitiveFiles = changedFiles().filter(isMigrationSensitive)

if (sensitiveFiles.length === 0) {
  console.log('[migration-change-warning] No DB schema or migration-sensitive changes detected.')
  process.exit(0)
}

console.warn('[migration-change-warning] DB schema or migration-sensitive changes detected:')
for (const file of sensitiveFiles) {
  console.warn(`- ${file}`)
}
console.warn(
  '[migration-change-warning] Before claiming release readiness, run `npm.cmd run smoke:migration:fresh-db` and record sanitized evidence, or document a Conditional Go with owner, date, and reason.',
)
