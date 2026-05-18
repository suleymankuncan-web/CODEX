import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { test } from 'node:test'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedFiles(prefix) {
  return git(['ls-files', '-z', prefix]).split('\0').filter(Boolean)
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(document, expected) {
  assert.match(document, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

const textBasenames = new Set(['Dockerfile', 'README', '.env.example', '.gitignore'])

function isTextFile(path) {
  return textExtensions.has(extname(path)) || textBasenames.has(basename(path))
}

const forbiddenFrontendPatterns = [
  {
    label: 'SUPABASE_SERVICE_ROLE key reference',
    pattern: /\bSUPABASE_SERVICE_ROLE(?:_KEY)?\b/i,
  },
  {
    label: 'Supabase service_role role reference',
    pattern: /\bservice_role\b/i,
  },
  {
    label: 'Supabase secret key material',
    pattern: /\bsb_secret_[A-Za-z0-9_-]+/i,
  },
  {
    label: 'backend database URL reference',
    pattern: /\bDATABASE_URL\b/,
  },
  {
    label: 'backend JWT secret reference',
    pattern: /\bJWT_SECRET\b/,
  },
]

const forbiddenFrontendSourcePatterns = [
  {
    label: 'direct Supabase REST endpoint',
    pattern: /https?:\/\/[^'"\s]+\.supabase\.co\/rest\/v1/i,
  },
  {
    label: 'VITE_SUPABASE_URL-based REST endpoint',
    pattern: /(?:VITE_SUPABASE_URL[\s\S]{0,200}rest\/v1|rest\/v1[\s\S]{0,200}VITE_SUPABASE_URL)/i,
  },
  {
    label: 'direct Supabase ops schema REST path',
    pattern: /\/rest\/v1\/ops(?:\.|%2[eE]|\/)/i,
  },
  {
    label: 'direct Supabase ops table query',
    pattern: /\.from\(\s*['"`]ops\./i,
  },
]

function findViteEnvViolations(content, path) {
  const violations = []

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || !match[1].startsWith('VITE_')) {
      continue
    }

    const [, name, rawValue] = match
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '')
    const allowedEmptyBearerToken = name === 'VITE_BEARER_TOKEN' && value === ''
    const allowedPublicTokenEndpoint = name.endsWith('_TOKEN_URL')

    if (/SECRET|PASSWORD|PRIVATE_KEY|CLIENT_SECRET|REFRESH_TOKEN|SERVICE_ROLE/i.test(name)) {
      violations.push(`${path}:${index + 1} exposes secret-like frontend env name ${name}`)
      continue
    }

    if (/TOKEN/i.test(name) && !allowedEmptyBearerToken && !allowedPublicTokenEndpoint) {
      violations.push(`${path}:${index + 1} exposes token-like frontend env name ${name}`)
      continue
    }

    if (/(?:sb_secret_|service_role|postgres(?:ql)?:\/\/|DATABASE_URL|JWT_SECRET)/i.test(value)) {
      violations.push(`${path}:${index + 1} gives ${name} a backend-only or secret-looking value`)
    }
  }

  return violations
}

function findFrontendBoundaryViolations(files) {
  const violations = []

  for (const file of files) {
    if (!isTextFile(file.path)) {
      continue
    }

    for (const rule of forbiddenFrontendPatterns) {
      if (rule.pattern.test(file.content)) {
        violations.push(`${file.path} contains ${rule.label}`)
      }
    }

    if (file.path.startsWith('admin-web/src/') && /@supabase\/supabase-js/.test(file.content)) {
      violations.push(`${file.path} imports @supabase/supabase-js inside the active frontend app`)
    }

    if (file.path.startsWith('admin-web/src/')) {
      for (const rule of forbiddenFrontendSourcePatterns) {
        if (rule.pattern.test(file.content)) {
          violations.push(`${file.path} contains ${rule.label}`)
        }
      }
    }

    if (file.path === 'admin-web/.env.example') {
      violations.push(...findViteEnvViolations(file.content, file.path))
    }
  }

  return violations
}

function trackedFrontendFiles() {
  return trackedFiles('admin-web')
    .filter(isTextFile)
    .map((path) => ({ path, content: readText(path) }))
}

const inventory = readText('docs/plans/environment-variable-inventory.md')
const readinessChecklist = readText('docs/plans/production-environment-readiness-checklist.md')

test('active frontend has no Supabase service-role or backend secret boundary violations', () => {
  assert.deepEqual(findFrontendBoundaryViolations(trackedFrontendFiles()), [])
})

test('guard rejects fake frontend service-role and direct Supabase client usage', () => {
  const violations = findFrontendBoundaryViolations([
    {
      path: 'admin-web/src/fake-supabase-client.ts',
      content: `
        import { createClient } from '@supabase/supabase-js'
        const serviceKey = 'SUPABASE_SERVICE_ROLE_KEY'
        createClient('https://example.supabase.co', serviceKey).from('ops.store').select('*')
      `,
    },
  ])

  assert.match(violations.join('\n'), /SUPABASE_SERVICE_ROLE/)
  assert.match(violations.join('\n'), /@supabase\/supabase-js/)
})

test('guard rejects fake frontend direct Supabase REST access to ops tables', () => {
  const violations = findFrontendBoundaryViolations([
    {
      path: 'admin-web/src/fake-supabase-rest.ts',
      content: `
        const url = import.meta.env.VITE_SUPABASE_URL
        fetch(\`${'${url}'}/rest/v1/ops.store?select=*\`)
        fetch('https://example.supabase.co/rest/v1/ops.personnel?select=*')
      `,
    },
  ])

  assert.match(violations.join('\n'), /VITE_SUPABASE_URL-based REST endpoint/)
  assert.match(violations.join('\n'), /direct Supabase ops schema REST path/)
})

test('guard rejects fake frontend VITE secret values', () => {
  const violations = findFrontendBoundaryViolations([
    {
      path: 'admin-web/.env.example',
      content: 'VITE_SUPABASE_SERVICE_ROLE_KEY=sb_secret_example\nVITE_BEARER_TOKEN=real-token',
    },
  ])

  assert.match(violations.join('\n'), /VITE_SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(violations.join('\n'), /VITE_BEARER_TOKEN/)
})

test('Supabase boundary rules are documented as production readiness requirements', () => {
  for (const text of [inventory, readinessChecklist]) {
    requireText(text, 'Supabase Boundary Guard')
    requireText(text, 'Direct Supabase client access to `ops.*` remains blocked')
    requireText(text, 'direct Supabase REST access')
    requireText(text, 'RLS')
    requireText(text, 'service_role')
  }
})
