import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'

type RequestManagerSource = {
  storeId: string
  regionManagerNames: string[]
}

export function resolveRequestManagerDirectory(
  directoryItems: RegionManagerDirectoryItem[],
  requests: RequestManagerSource[],
): RegionManagerDirectoryItem[] {
  if (directoryItems.length > 0) {
    return directoryItems
      .map((item) => ({ ...item, storeIds: [...item.storeIds] }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr'))
  }

  const resolved: RegionManagerDirectoryItem[] = []
  const byDisplayName = new Map<string, RegionManagerDirectoryItem>()

  for (const request of requests) {
    for (const displayName of request.regionManagerNames) {
      const existing = byDisplayName.get(displayName)
      if (existing) {
        if (!existing.storeIds.includes(request.storeId)) existing.storeIds.push(request.storeId)
        continue
      }

      const item = {
        userId: `request-manager:${encodeURIComponent(displayName)}`,
        displayName,
        storeIds: [request.storeId],
      }
      resolved.push(item)
      byDisplayName.set(displayName, item)
    }
  }

  return resolved.sort((left, right) => left.displayName.localeCompare(right.displayName, 'tr'))
}
