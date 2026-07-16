import type { TargetWorkspaceResponse } from '../api'
import type {
  TargetCommandCompany,
  TargetCommandSortState,
  TargetCommandStatusFilter,
  TargetCommandStore,
  TargetCommandWorkspace,
} from './types'

const statusOrder: Record<TargetCommandStore['status'], number> = {
  pending: 0,
  revision_conflict: 1,
  stale_reference: 2,
  returned: 3,
  missing: 4,
  adjusted_approved: 5,
  approved: 6,
  unknown: 7,
}

export function mergeTargetWorkspacePages(pages: TargetWorkspaceResponse[]): TargetCommandWorkspace {
  const first = pages[0]?.data
  if (!first) throw new Error('Targets workspace has no page')

  const companies = new Map<string, TargetCommandCompany>()
  for (const page of pages) {
    for (const sourceCompany of page.data.companies) {
      const company = companies.get(sourceCompany.companyId) ?? {
        ...sourceCompany,
        regions: [],
      }
      for (const sourceRegion of sourceCompany.regions) {
        const region = company.regions.find((item) => item.regionId === sourceRegion.regionId)
        if (region) {
          const known = new Set(region.stores.map((store) => store.storeId))
          region.stores.push(...sourceRegion.stores.filter((store) => !known.has(store.storeId)))
        } else {
          company.regions.push({ ...sourceRegion, stores: [...sourceRegion.stores] })
        }
      }
      companies.set(company.companyId, company)
    }
  }

  return {
    ...first,
    sections: {
      hierarchy: { status: pages.some((page) => page.data.sections.hierarchy.status === 'unavailable') ? 'unavailable' : 'available' },
      summary: { status: pages.some((page) => page.data.sections.summary.status === 'unavailable') ? 'unavailable' : 'available' },
      personnel: { status: pages.some((page) => page.data.sections.personnel.status === 'unavailable') ? 'unavailable' : 'available' },
      monthStatuses: { status: pages.some((page) => page.data.sections.monthStatuses.status === 'unavailable') ? 'unavailable' : 'available' },
    },
    pagination: {
      ...first.pagination,
      offset: 0,
      limit: pages.reduce((sum, page) => sum + page.data.companies
        .flatMap((company) => company.regions)
        .flatMap((region) => region.stores).length, 0),
      hasMore: pages.at(-1)?.data.pagination.hasMore ?? false,
    },
    warnings: [...new Set(pages.flatMap((page) => page.data.warnings))],
    companies: [...companies.values()],
  }
}

export function flattenTargetStores(workspace: TargetCommandWorkspace) {
  return workspace.companies.flatMap((company) => company.regions.flatMap((region) =>
    region.stores.map((store) => ({ company, region, store })),
  ))
}

export function buildTargetMetrics(workspace: TargetCommandWorkspace) {
  const stores = flattenTargetStores(workspace).map((item) => item.store)
  const summary = workspace.summary
  return {
    storeCount: summary?.totalStores ?? stores.length,
    approvedCount: summary ? summary.approvedStores + summary.adjustedApprovedStores : stores.filter((store) => store.status === 'approved' || store.status === 'adjusted_approved').length,
    pendingCount: summary?.pendingStores ?? stores.filter((store) => store.status === 'pending').length,
    missingCount: summary?.missingStores ?? stores.filter((store) => store.status === 'missing').length,
    regionCount: workspace.companies.reduce((sum, company) => sum + company.regions.length, 0),
  }
}

export function filterTargetWorkspace(
  workspace: TargetCommandWorkspace,
  input: { search: string; status: TargetCommandStatusFilter },
): TargetCommandWorkspace {
  const query = input.search.trim().toLocaleLowerCase('tr-TR')
  return {
    ...workspace,
    companies: workspace.companies.map((company) => ({
      ...company,
      regions: company.regions.map((region) => ({
        ...region,
        stores: region.stores.filter((store) => {
          const statusMatches = input.status === 'all'
            || (input.status === 'approved_all' && (store.status === 'approved' || store.status === 'adjusted_approved'))
            || store.status === input.status
          const people = [...store.personnel.map((person) => `${person.displayName} ${person.positionLabel ?? ''}`), ...(store.request?.allocations.map((allocation) => allocation.displayName) ?? [])].join(' ')
          const haystack = `${store.storeName} ${store.storeCode} ${region.regionName ?? ''} ${region.regionManager.displayName ?? ''} ${people}`
            .toLocaleLowerCase('tr-TR')
          return statusMatches && (!query || haystack.includes(query))
        }),
      })).filter((region) => region.stores.length > 0),
    })).filter((company) => company.regions.length > 0),
  }
}

export function sortTargetStores(stores: TargetCommandStore[], sort: TargetCommandSortState) {
  const multiplier = sort.direction === 'ascending' ? 1 : -1
  return [...stores].sort((left, right) => {
    const leftValue = targetSortValue(left, sort.key)
    const rightValue = targetSortValue(right, sort.key)
    const compared = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), 'tr-TR')
    return (compared || left.storeId.localeCompare(right.storeId)) * multiplier
  })
}

function targetSortValue(store: TargetCommandStore, key: TargetCommandSortState['key']) {
  if (key === 'store') return store.storeName
  if (key === 'target') return Number(store.request?.totalTargetValue ?? -1)
  if (key === 'distributed') return store.request?.allocations.reduce((sum, row) => sum + Number(row.targetValue), 0) ?? -1
  if (key === 'personnel') return store.personnel.length
  return statusOrder[store.status]
}
