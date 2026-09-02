export const PLAYWRIGHT_BUILD_PROFILE: 'playwright-e2e'

export interface PlaywrightModuleInfo {
  isEntry: boolean
  importers: readonly string[]
}

export interface PlaywrightManualChunksMeta {
  getModuleInfo(moduleId: string): PlaywrightModuleInfo | null
}

export type PlaywrightManualChunks = (
  moduleId: string,
  meta: PlaywrightManualChunksMeta,
) => string | undefined

export function resolveModulePreload(
  environment?: Record<string, string | undefined>,
): false | undefined

export function createPlaywrightManualChunks(
  environment?: Record<string, string | undefined>,
): PlaywrightManualChunks | undefined
