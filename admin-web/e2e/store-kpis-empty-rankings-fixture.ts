export function createEmptyRankingsFixture() {
  return {
    access: {
      canSeeGlobalDetails: false,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'summary',
    },
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: { regionManagers: [], regions: [], stores: [] },
    personnelLeaderboard: {
      currentEmployee: null,
      items: [],
      managedStorePersonnel: [],
      managedStorePersonnelMeta: { limit: 50, offset: 0, total: 0 },
      meta: { limit: 100, offset: 0, total: 0 },
    },
    reference: {
      personnel: { averageScore: null, metrics: [] },
      store: { averageScore: null, metrics: [] },
    },
    scopeSummary: { activePersonnelCount: 0, storeCount: 1 },
    regionManagerLeaderboard: {
      items: [],
      meta: { limit: 20, offset: 0, total: 0 },
      riskItems: [],
      riskMeta: { limit: 20, offset: 0, total: 0 },
      riskStoreCount: 0,
    },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: null,
      items: [],
      meta: { limit: 100, offset: 0, total: 0 },
    },
  }
}
