import { fetchJson } from '@/lib/api'
import type { components } from '@/generated/openapi-types'

type RegionManagerDirectoryResponse = components['schemas']['RegionManagerDirectoryResponse']
export type RegionManagerDirectoryItem = RegionManagerDirectoryResponse['items'][number]

export function getRegionManagerDirectory(): Promise<RegionManagerDirectoryResponse> {
  return fetchJson('/org/region-managers')
}
