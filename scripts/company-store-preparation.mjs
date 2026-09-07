import { constants, openSync, closeSync, fstatSync, readSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareCompanyStores } from './company-store-preparation-model.mjs'

const repoRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
const maxBytes = 4 * 1024 * 1024
const fail = () => { throw new Error('preparation_io_rejected') }

function outsideRepo(path) {
  const rel = relative(repoRoot, path)
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) fail()
}

export function runPreparation(args) {
  const options = new Map()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    if (!['--input', '--evaluation-date', '--private-report'].includes(flag) ||
      options.has(flag) || !args[index + 1] || args[index + 1].startsWith('--')) fail()
    options.set(flag, args[index + 1])
  }
  if (!options.has('--input') || !options.has('--evaluation-date')) fail()
  const inputPath = resolve(options.get('--input'))
  outsideRepo(realpathSync(inputPath))
  const inputFd = openSync(inputPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  let input
  try {
    const stat = fstatSync(inputFd)
    if (!stat.isFile() || stat.size > maxBytes || (stat.mode & 0o077) !== 0) fail()
    const buffer = Buffer.alloc(maxBytes + 1)
    let bytes = 0
    while (bytes < buffer.length) {
      const read = readSync(inputFd, buffer, bytes, buffer.length - bytes, null)
      if (read === 0) break
      bytes += read
    }
    if (bytes > maxBytes) fail()
    input = JSON.parse(buffer.subarray(0, bytes).toString('utf8'))
  } finally { closeSync(inputFd) }
  const result = prepareCompanyStores(input, options.get('--evaluation-date'))
  if (options.has('--private-report')) {
    const path = resolve(options.get('--private-report'))
    const parent = realpathSync(dirname(path))
    outsideRepo(parent)
    if ((statSync(parent).mode & 0o077) !== 0) fail()
    // Exclusive creation refuses overwrite and symlink targets; output stays private.
    const fd = openSync(join(parent, basename(path)), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    try { writeFileSync(fd, JSON.stringify(result.privateReport, null, 2) + '\n') }
    finally { closeSync(fd) }
  }
  return result.summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const summary = runPreparation(process.argv.slice(2))
    console.log(JSON.stringify(summary))
    // No exit status from this command may be used as live activation approval.
    process.exitCode = summary.mappingState === 'prepared' ? 0 : 2
  } catch {
    console.error(JSON.stringify({ event: 'company_store_preparation_failed', reason: 'invalid_or_unreadable_input' }))
    process.exitCode = 1
  }
}
