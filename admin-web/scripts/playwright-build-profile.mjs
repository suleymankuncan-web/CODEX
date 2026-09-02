export const PLAYWRIGHT_BUILD_PROFILE = 'playwright-e2e'

function isPlaywrightBuildProfile(environment) {
  return environment?.VITE_PLAYWRIGHT_BUILD_PROFILE === PLAYWRIGHT_BUILD_PROFILE
}

export function resolveModulePreload(environment) {
  return isPlaywrightBuildProfile(environment) ? false : undefined
}

export function createPlaywrightManualChunks(environment) {
  if (!isPlaywrightBuildProfile(environment)) return undefined

  const moduleInfoCache = new Map()
  const staticEntryPathCache = new Map()

  function getCachedModuleInfo(moduleId, getModuleInfo) {
    if (moduleInfoCache.has(moduleId)) return moduleInfoCache.get(moduleId)

    const info = getModuleInfo(moduleId) ?? null
    moduleInfoCache.set(moduleId, info)
    return info
  }

  function hasStaticEntryPath(moduleId, getModuleInfo) {
    if (staticEntryPathCache.has(moduleId)) return staticEntryPathCache.get(moduleId)

    const modules = new Set()
    const pending = [moduleId]
    while (pending.length > 0) {
      const current = pending.pop()
      if (current === undefined || modules.has(current)) continue

      modules.add(current)
      const info = getCachedModuleInfo(current, getModuleInfo)
      for (const importer of info?.importers ?? []) {
        if (typeof importer === 'string' && !modules.has(importer)) pending.push(importer)
      }
    }

    const reachableFromEntry = new Set()
    for (const id of modules) {
      if (getCachedModuleInfo(id, getModuleInfo)?.isEntry) reachableFromEntry.add(id)
    }

    let changed = true
    while (changed) {
      changed = false
      for (const id of modules) {
        if (reachableFromEntry.has(id)) continue

        const importers = getCachedModuleInfo(id, getModuleInfo)?.importers ?? []
        if (importers.some((importer) => reachableFromEntry.has(importer))) {
          reachableFromEntry.add(id)
          changed = true
        }
      }
    }

    for (const id of modules) staticEntryPathCache.set(id, reachableFromEntry.has(id))
    return staticEntryPathCache.get(moduleId) ?? false
  }

  return (moduleId, { getModuleInfo }) => {
    const info = getCachedModuleInfo(moduleId, getModuleInfo)
    if (!info || info.isEntry) return undefined

    // Walking importers deliberately ignores dynamicImporters: lazy roots and
    // their static descendants stay in their own route chunks unless another
    // static path reaches an entry.
    return hasStaticEntryPath(moduleId, getModuleInfo) ? 'e2e-static' : undefined
  }
}
