import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const commandCatalog = {
  diffCheck: 'git diff --check',
  scriptTests: 'npm.cmd run test:scripts',
  frontendLint: 'npm.cmd --prefix admin-web run lint',
  frontendBuild: 'npm.cmd --prefix admin-web run build',
  backendBuild: 'npm.cmd --prefix backend/nestjs run build',
  backendRelease: 'npm.cmd --prefix backend/nestjs run check:release',
  frontendRelease: 'npm.cmd --prefix admin-web run check:release',
  rootRelease: 'npm.cmd run check:release',
  openApiGenerate: 'npm.cmd --prefix backend/nestjs run openapi:generate',
  frontendApiCheck: 'npm.cmd --prefix admin-web run api:check',
}

const rules = [
  {
    name: 'docs/process',
    test: (file) =>
      file.startsWith('docs/') ||
      file.startsWith('.codex/') ||
      ['AGENTS.md', 'CONTRIBUTING.md', 'discipline.md', 'sokrates.md', 'current-state.md'].includes(file),
    commands: ['diffCheck'],
    reason: 'documentation or process file changed',
  },
  {
    name: 'script guard',
    test: (file) => file.startsWith('scripts/') || file === 'package.json',
    commands: ['diffCheck', 'scriptTests'],
    reason: 'repo script or root command surface changed',
  },
  {
    name: 'frontend app',
    test: (file) => file.startsWith('admin-web/src/') || file.startsWith('admin-web/e2e/'),
    commands: ['frontendLint', 'frontendBuild'],
    reason: 'admin-web runtime or e2e surface changed',
  },
  {
    name: 'frontend package/config',
    test: (file) =>
      file.startsWith('admin-web/') &&
      !file.startsWith('admin-web/src/') &&
      !file.startsWith('admin-web/e2e/'),
    commands: ['frontendLint', 'frontendBuild', 'frontendRelease'],
    reason: 'admin-web package, config, or tooling changed',
    fullRelease: true,
  },
  {
    name: 'backend app',
    test: (file) => file.startsWith('backend/nestjs/src/'),
    commands: ['backendBuild'],
    reason: 'backend application source changed',
  },
  {
    name: 'backend package/config',
    test: (file) =>
      file.startsWith('backend/nestjs/') && !file.startsWith('backend/nestjs/src/'),
    commands: ['backendBuild', 'backendRelease'],
    reason: 'backend package, config, script, or tooling changed',
    fullRelease: true,
  },
  {
    name: 'api contract',
    test: (file) =>
      file.startsWith('docs/api/') ||
      /(^|\/)(controller|dto|openapi|api)(\.|-)/i.test(file) ||
      /\.(controller|dto)\./i.test(file),
    commands: ['openApiGenerate', 'frontendApiCheck'],
    reason: 'API contract or generated API surface can drift',
    fullRelease: true,
  },
  {
    name: 'store UI',
    test: (file) => file.startsWith('admin-web/src/') && /\/store|store-/i.test(file),
    commands: ['frontendLint', 'frontendBuild'],
    targeted: ['targeted Store Playwright route/spec for touched route'],
    routes: ['/store/*'],
    reason: 'Store frontend route or component changed',
  },
  {
    name: 'admin UI',
    test: (file) => {
      const appPath = file.replace(/^admin-web\//, '')
      return file.startsWith('admin-web/src/') && /(^|\/)admin(\/|-)/i.test(appPath)
    },
    commands: ['frontendLint', 'frontendBuild'],
    targeted: ['targeted Admin Playwright route/spec for touched route'],
    routes: ['/admin/*'],
    reason: 'Admin frontend route or component changed',
  },
  {
    name: 'auth/scope sensitive',
    test: (file) => /auth|permission|scope|clerk|jwt/i.test(file),
    commands: ['rootRelease'],
    targeted: ['targeted auth/scope positive and negative tests'],
    reason: 'auth, permission, or scope semantics can drift',
    fullRelease: true,
  },
  {
    name: 'DB/migration sensitive',
    test: (file) =>
      file === 'db/schema.sql' ||
      file.startsWith('db/migrations/') ||
      /migration|database\.module|migration-fresh-db-smoke/i.test(file),
    commands: ['rootRelease'],
    targeted: ['npm.cmd run smoke:migration:fresh-db or documented Conditional Go'],
    reason: 'DB schema or migration-sensitive path changed',
    fullRelease: true,
  },
  {
    name: 'scoring/ranking/snapshot sensitive',
    test: (file) => isBackendOrContractPath(file) && /scoring|ranking|snapshot|kpi|target/i.test(file),
    commands: ['rootRelease'],
    targeted: ['targeted scoring/ranking/snapshot contract tests'],
    reason: 'scoring, ranking, KPI, target, or snapshot behavior can drift',
    fullRelease: true,
  },
  {
    name: 'queue/import sensitive',
    test: (file) => isBackendOrContractPath(file) && /bullmq|queue|worker|import|materializ/i.test(file),
    commands: ['rootRelease'],
    targeted: ['targeted import lifecycle or worker smoke/tests'],
    reason: 'queue, worker, import, or materialization lifecycle can drift',
    fullRelease: true,
  },
]

function normalizePath(path) {
  return path.trim().replaceAll('\\', '/').replace(/\/+/g, '/')
}

function isBackendOrContractPath(file) {
  return (
    file.startsWith('backend/nestjs/src/') ||
    file.startsWith('docs/api/') ||
    file.startsWith('scripts/') ||
    file.startsWith('db/')
  )
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

export function parseChangedFiles(text) {
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

export function selectAffectedVerification(files) {
  const normalizedFiles = unique(files.map(normalizePath))
  const matchedRules = []
  const commandKeys = ['diffCheck']
  const targeted = []
  const routes = []
  const reasons = []

  for (const rule of rules) {
    const matches = normalizedFiles.filter(rule.test)
    if (matches.length === 0) {
      continue
    }

    matchedRules.push({ name: rule.name, files: matches, reason: rule.reason })
    commandKeys.push(...(rule.commands ?? []))
    targeted.push(...(rule.targeted ?? []))
    routes.push(...(rule.routes ?? []))
    reasons.push(`${rule.name}: ${rule.reason}`)
  }

  const fullReleaseRequired = matchedRules.some(({ name }) =>
    rules.find((rule) => rule.name === name)?.fullRelease,
  )

  if (fullReleaseRequired) {
    commandKeys.push('rootRelease')
  }

  const unableToInferAffectedRoutesOrServices =
    normalizedFiles.length > 0 && routes.length === 0

  if (normalizedFiles.length === 0) {
    reasons.push('no changed files were detected; selector cannot infer affected routes/services')
  }

  if (unableToInferAffectedRoutesOrServices) {
    reasons.push(
      'changed files matched verification rules, but no affected route/service family was inferred; write the affected scope manually in the PR',
    )
  }

  return {
    advisory: true,
    replacesReleaseGate: false,
    files: normalizedFiles,
    matchedRules,
    commands: unique(commandKeys).map((key) => commandCatalog[key]),
    targeted: unique(targeted),
    affectedRoutesOrServices: unique(routes),
    unableToInferAffectedRoutesOrServices,
    fullReleaseRequired,
    fullReleaseReason: fullReleaseRequired
      ? 'at least one sensitive or release-class rule matched'
      : 'no release-class rule matched; reviewer may still require a broader gate',
    notes: [
      'This selector is advisory. discipline.md and release-blocking review remain authoritative.',
      ...reasons,
    ],
  }
}

function changedFilesFromGit() {
  const mainMergeBase = git(['merge-base', 'origin/main', 'HEAD']).trim()
  const candidates = [
    ['diff', '--name-status'],
    ['diff', '--name-status', '--cached'],
    mainMergeBase ? ['diff', '--name-status', mainMergeBase, 'HEAD'] : null,
    ['diff-tree', '--no-commit-id', '--name-status', '-r', 'HEAD'],
  ].filter(Boolean)

  const files = []
  for (const args of candidates) {
    files.push(...parseGitNameStatusFiles(git(args)))
  }

  return unique(files)
}

function printSelection(selection) {
  console.log('[affected-verification] Advisory verification selection')
  console.log(`Files: ${selection.files.length === 0 ? '(none detected)' : selection.files.join(', ')}`)
  console.log(`Full release required: ${selection.fullReleaseRequired ? 'yes' : 'no'}`)
  console.log(`Reason: ${selection.fullReleaseReason}`)
  console.log('Commands:')
  for (const command of selection.commands) {
    console.log(`- ${command}`)
  }
  if (selection.targeted.length > 0) {
    console.log('Targeted checks:')
    for (const check of selection.targeted) {
      console.log(`- ${check}`)
    }
  }
  if (selection.affectedRoutesOrServices.length > 0) {
    console.log('Affected routes/services:')
    for (const route of selection.affectedRoutesOrServices) {
      console.log(`- ${route}`)
    }
  }
  console.log('Notes:')
  for (const note of selection.notes) {
    console.log(`- ${note}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.env.HR_AXIS_CHANGED_FILES
    ? parseChangedFiles(process.env.HR_AXIS_CHANGED_FILES)
    : process.argv.slice(2).length > 0
      ? process.argv.slice(2).map(normalizePath)
      : changedFilesFromGit()

  printSelection(selectAffectedVerification(files))
}
