import { spawnSync } from 'node:child_process'

// Test fixtures only: cache successful lexical conversions, never command results
// or filesystem/security observations. Relative paths depend on cwd and bypass it.
export function createShellPath({ cygpath, run = spawnSync } = {}) {
  const cache = new Map()
  return (pathname) => {
    if (!cygpath) return pathname
    const cacheable = /^[a-z]:[\\/]/i.test(pathname)
    if (cacheable && cache.has(pathname)) return cache.get(pathname)
    const result = run(cygpath, ['-u', pathname], { encoding: 'utf8', windowsHide: true })
    if (result.error || result.status !== 0 || !result.stdout?.trim()) return pathname
    const converted = result.stdout.trim()
    if (cacheable) cache.set(pathname, converted)
    return converted
  }
}
