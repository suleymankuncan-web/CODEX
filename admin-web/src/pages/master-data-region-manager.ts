import type { StoreMasterItem } from '../features/integrations/api'

export type RegionManagerOption = {
  userId: string
  displayName: string
  email: string
  regionId: string
  regionName: string
}

function isTechnicalIdentity(value: string) {
  return /^(?:onprem\.|user_|[0-9a-f]{8}-[0-9a-f-]{27,})/i.test(value)
}

export function resolveStoreRegionManager(item: StoreMasterItem, managers: RegionManagerOption[]) {
  const manager = managers.find((candidate) => candidate.userId === item.regionManagerUserId)
    ?? managers.find((candidate) => candidate.regionId === item.regionId)
  const apiName = item.regionManagerName?.trim() ?? ''
  const displayName = manager?.displayName.trim()
    || (!isTechnicalIdentity(apiName) ? apiName : '')

  return {
    assigned: Boolean(displayName),
    displayName: displayName || 'Bölge müdürü atanmamış',
    email: manager?.email ?? null,
  }
}
