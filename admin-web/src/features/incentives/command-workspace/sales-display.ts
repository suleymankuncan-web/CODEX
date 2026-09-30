import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

export function netAchievement(net: string | null | undefined, target: string | null) {
  return net !== null && net !== undefined && Number.isFinite(Number(net)) && Number(target) > 0
    ? (Number(net) / Number(target) * 100).toFixed(2) : null
}

export function storeSalesDisplay(store: IncentiveStore, workspace: IncentiveWorkspace) {
  const daily = workspace.salesTracking?.status === 'complete' && Boolean(workspace.salesTracking.lastLoadedDate)
  const net = store.trackedNetAmount ?? (daily ? store.dailyActualNetSales : store.storeActualNetSales)
  return {
    sale: store.trackedSaleAmount, returns: store.trackedReturnAmount, net,
    achievement: netAchievement(net, store.storeTarget),
  }
}

export function personnelSalesDisplay(row: IncentiveRow, managerStoreNet?: string | null) {
  // Managers use store net sales. The recorded financial calculation remains separate.
  const net = row.participantType === 'store_manager' ? row.dailyActualNetSales ?? managerStoreNet : row.trackedNetAmount
  return {
    sale: row.trackedSaleAmount, returns: row.trackedReturnAmount, net,
    achievement: netAchievement(net, row.target),
    incentiveAchievement: row.achievementPct ?? netAchievement(row.actual, row.target),
  }
}
