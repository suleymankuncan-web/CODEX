import { ReportingStoreKpiReadService } from './reporting-store-kpi-read.service';

describe('Store detail monthly daily-component aggregation', () => {
  const month = { period_type: 'monthly', period_start: '2026-09-01', period_end: '2026-09-30', uses_daily_components: true };
  const scope = { companyIds: ['company'], regionIds: [], storeIds: ['store'], storeId: 'store' };
  function setup(period: typeof month | null = month) {
    const reporting = {
      getStoreNameById: jest.fn(async () => 'Store'),
      listStoreKpiPeriods: jest.fn(async () => [month]),
      getLatestStoreKpiPeriod: jest.fn(async () => period),
      getStorePerformanceRows: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [{ kpi_code: 'UPT', benchmark_value: '2' }]),
      getStoreScopeById: jest.fn(async () => null),
    };
    const ranking = {
      listRankingStoreKpiRows: jest.fn(async () => [
        { store_id: 'store', store_name: 'Store', kpi_code: 'UPT', actual_value: '2.5', target_value: null },
        { store_id: 'store', store_name: 'Store', kpi_code: 'TARGET_ACHIEVEMENT', actual_value: '120000', target_value: '1000000' },
        { store_id: 'another-store', store_name: 'Another', kpi_code: 'UPT', actual_value: '99', target_value: null },
      ]),
    };
    const service = new ReportingStoreKpiReadService(async () => ({ storeProfile: {
      profileCode: 'store', title: 'Store', summary: '', futureMetricRule: '', metrics: [
        { code: 'UPT', label: 'UPT', weightPercent: 60, ownerRole: 'STORE_MANAGER', scoreBehavior: 'warning_first', benchmarkSource: 'TURKEY_AVERAGE', direction: 'HIGHER_IS_BETTER', capRatio: 1, aliases: [] },
        { code: 'TARGET_ACHIEVEMENT', label: 'HG', weightPercent: 40, ownerRole: 'STORE_MANAGER', scoreBehavior: 'warning_first', benchmarkSource: 'TARGET', direction: 'HIGHER_IS_BETTER', capRatio: 1, aliases: [] },
      ],
    } }), {} as never, reporting as never, ranking as never);
    return { service, reporting, ranking };
  }

  it.each([undefined, '2026-09-01'])('aggregates daily facts for the full month, with requested start %s', async periodStart => {
    const { service, reporting, ranking } = setup();
    const result = await service.getStoreKpiHighlights({ ...scope, ...(periodStart ? { periodStart } : {}) });
    expect(reporting.getLatestStoreKpiPeriod).toHaveBeenCalledWith({ storeId: 'store', metricCodes: ['UPT', 'TARGET_ACHIEVEMENT'], periodType: 'monthly', periodStart });
    expect(ranking.listRankingStoreKpiRows).toHaveBeenCalledWith({ isRange: true, companyIds: ['company'], metricCodes: ['UPT', 'TARGET_ACHIEVEMENT'], periodType: 'daily', periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(reporting.getStorePerformanceRows).not.toHaveBeenCalled();
    expect(reporting.getStoreTurkeyBenchmarkValues).toHaveBeenCalledWith(expect.objectContaining({ isRange: true, periodStart: '2026-09-01', periodEnd: '2026-09-30' }));
    expect(result.source.periodType).toBe('monthly');
    expect(result.period).toEqual({ periodStart: '2026-09-01', periodEnd: '2026-09-30' });
    expect(result.metrics.find(metric => metric.code === 'UPT')?.actualValue).toBe(2.5);
    expect(result.metrics.find(metric => metric.code === 'TARGET_ACHIEVEMENT')?.achievementRate).toBe(0.12);
  });

  it('keeps monthly-only historical values on their existing path', async () => {
    const { service, reporting, ranking } = setup({ ...month, uses_daily_components: false });
    await service.getStoreKpiHighlights({ ...scope, periodType: 'monthly' });
    expect(ranking.listRankingStoreKpiRows).not.toHaveBeenCalled();
    expect(reporting.getStorePerformanceRows).toHaveBeenCalledWith(expect.objectContaining({ periodType: 'monthly', periodStart: '2026-09-01' }));
    expect(reporting.getStoreTurkeyBenchmarkValues).toHaveBeenCalledWith(expect.objectContaining({ isRange: false }));
  });

  it('does not substitute a different month when the requested month has no facts', async () => {
    const { service, ranking, reporting } = setup(null);
    const result = await service.getStoreKpiHighlights({ ...scope, periodType: 'monthly', periodStart: '2026-08-01' });
    expect(result.period).toBeNull();
    expect(result.partial.isPartial).toBe(true);
    expect(ranking.listRankingStoreKpiRows).not.toHaveBeenCalled();
    expect(reporting.getStorePerformanceRows).not.toHaveBeenCalled();
  });

  it('continues to use exactly the explicitly selected daily range', async () => {
    const { service, reporting, ranking } = setup();
    const result = await service.getStoreKpiHighlights({ ...scope, periodType: 'daily', periodStart: '2026-09-08', periodEnd: '2026-09-09' });
    expect(reporting.getLatestStoreKpiPeriod).not.toHaveBeenCalled();
    expect(ranking.listRankingStoreKpiRows).toHaveBeenCalledWith(expect.objectContaining({ isRange: true, periodStart: '2026-09-08', periodEnd: '2026-09-09' }));
    expect(result.source.periodType).toBe('daily');
  });

  it('rejects a store outside the caller scope before loading aggregate facts', async () => {
    const { service, ranking, reporting } = setup();
    await expect(service.getStoreKpiHighlights({ ...scope, storeId: 'outside' })).rejects.toThrow('outside current store scope');
    expect(reporting.getLatestStoreKpiPeriod).not.toHaveBeenCalled();
    expect(ranking.listRankingStoreKpiRows).not.toHaveBeenCalled();
  });
});
