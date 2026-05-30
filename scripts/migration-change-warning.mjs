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

function parseGitNameStatusFiles(text) {
  const files = []

  for (const line of text.split(/\r?\n/)) {
    const parts = line.split('\t').filter(Boolean)
    const status = parts[0] ?? ''

    if (status.startsWith('R') || status.startsWith('C')) {
      files.push(parts[1], parts[2])
      continue
    }

    files.push(parts[1])
  }

  return unique(files.filter(Boolean).map(normalizePath))
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

function readGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(eventPath, 'utf8'))
  } catch {
    return null
  }
}

async function changedFilesFromGitHubApi() {
  const event = readGitHubEvent()
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPOSITORY
  const pullNumber = event?.pull_request?.number

  if (!process.env.GITHUB_ACTIONS || !token || !repo || !pullNumber) {
    return []
  }

  const files = []
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'user-agent': 'hr-axis-migration-change-warning',
        },
      },
    )

    if (!response.ok) {
      return []
    }

    const pageFiles = await response.json()
    for (const file of pageFiles) {
      files.push(file.filename, file.previous_filename)
    }

    if (pageFiles.length < 100) {
      break
    }
  }

  return unique(files.filter(Boolean).map(normalizePath))
}

function changedFilesFromGitHubEvent() {
  const event = readGitHubEvent()
  const baseSha = event?.pull_request?.base?.sha
  const headSha = event?.pull_request?.head?.sha
  if (!baseSha || !headSha) {
    return []
  }

  fetchGitHubRefs(baseSha, headSha)
  const mergeBase = git(['merge-base', baseSha, headSha]).trim()
  if (!mergeBase) {
    return []
  }

  return parseGitNameStatusFiles(git(['diff', '--name-status', mergeBase, headSha]))
}

function changedFilesFromGit() {
  const baseRef = process.env.GITHUB_BASE_REF
  fetchGitHubRefs(baseRef)
  const baseRefMergeBase = baseRef
    ? git(['merge-base', `origin/${baseRef}`, 'HEAD']).trim()
    : ''
  const mainMergeBase = git(['merge-base', 'origin/main', 'HEAD']).trim()

  const candidates = [
    ['diff', '--name-status'],
    ['diff', '--name-status', '--cached'],
    baseRefMergeBase ? ['diff', '--name-status', baseRefMergeBase, 'HEAD'] : null,
    mainMergeBase ? ['diff', '--name-status', mainMergeBase, 'HEAD'] : null,
    ['diff', '--name-status', 'HEAD~1..HEAD'],
    ['diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD'],
  ].filter(Boolean)

  for (const args of candidates) {
    const files = parseGitNameStatusFiles(git(args))
    if (files.length > 0) {
      return files
    }
  }

  return []
}

async function changedFiles() {
  if (envChangedFiles) {
    return parseChangedFiles(envChangedFiles)
  }

  const apiFiles = await changedFilesFromGitHubApi()
  if (apiFiles.length > 0) {
    return apiFiles
  }

  return unique([...changedFilesFromGitHubEvent(), ...changedFilesFromGit()])
}

function isMigrationSensitive(path) {
  return migrationSensitivePatterns.some((pattern) => pattern.test(path))
}

const sensitiveFiles = (await changedFiles()).filter(isMigrationSensitive)

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
