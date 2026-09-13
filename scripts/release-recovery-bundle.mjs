import { mkdirSync, readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { sha256 } from './release-stage-proof.mjs'

export const MAX_BUNDLE_BYTES = 32 * 1024 * 1024
const outputRoots = { 'backend-release': 'backend/nestjs/dist', 'frontend-static': 'admin-web/dist' }

export function collectBuildFiles(root, family) {
  const prefix = outputRoots[family]
  if (!prefix) return []
  const files = []
  function walk(path) {
    for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
      const child = path + '/' + entry.name
      if (entry.isSymbolicLink()) throw new Error('Linked output cannot be exported')
      if (entry.isDirectory()) walk(child)
      else if (entry.isFile()) {
        const data = readFileSync(join(root, child))
        files.push({ path: child, bytes: data.length, sha256: sha256(data), data: data.toString('base64') })
      } else throw new Error('Non-file output cannot be exported')
    }
  }
  walk(prefix)
  if (!files.length) throw new Error('Build export is empty')
  return files
}

export function validateBundle(bundle, family) {
  if (bundle?.version !== 2 || bundle.family !== family || !bundle.record || !bundle.provenance ||
      !Array.isArray(bundle.files)) throw new Error('Invalid recovery bundle')
  const names = new Set()
  let total = 0
  for (const file of bundle.files) {
    const prefix = outputRoots[family]
    if (!prefix || typeof file.path !== 'string' || !file.path.startsWith(prefix + '/') ||
        /[\\:\0]/.test(file.path) || file.path.split('/').some((part) => !part || part === '.' || part === '..') ||
        names.has(file.path)) throw new Error('Unsafe recovery output path')
    names.add(file.path)
    if (typeof file.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data) ||
        file.data.length > MAX_BUNDLE_BYTES * 1.4 || !Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error('Invalid recovery output encoding')
    const data = Buffer.from(file.data, 'base64')
    total += data.length
    if (total > MAX_BUNDLE_BYTES || data.length !== file.bytes || sha256(data) !== file.sha256) throw new Error('Recovery output digest mismatch')
  }
  if (outputRoots[family] && !bundle.files.length) throw new Error('Missing recovery build output')
  if (family === 'frontend-e2e' && bundle.files.length) throw new Error('E2E bundle cannot contain build output')
  return true
}

export function installBuildFiles(root, bundle) {
  validateBundle(bundle, bundle.family)
  for (const file of bundle.files) {
    const target = resolve(root, file.path)
    const rel = relative(resolve(root), target)
    if (rel.startsWith('..') || rel === '') throw new Error('Recovery output escaped workspace')
    let cursor = root
    for (const part of file.path.split('/').slice(0, -1)) {
      cursor = join(cursor, part)
      try { if (lstatSync(cursor).isSymbolicLink()) throw new Error('Recovery output ancestor is linked') }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    try { if (lstatSync(target).isSymbolicLink()) throw new Error('Recovery output is linked') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, Buffer.from(file.data, 'base64'))
  }
}
