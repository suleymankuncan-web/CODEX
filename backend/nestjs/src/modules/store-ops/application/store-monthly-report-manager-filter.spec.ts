import { StoreMonthlyReportPackageService } from './store-monthly-report-package.service';

describe('monthly report manager selection', () => {
  function createService() {
    const report = { getStoreMonthlyReportPackageRows: jest.fn(async () => []) };
    const directory = { listRegionManagerDirectory: jest.fn(async () => [
      { id: 'manager-1', label: 'Aynı Ad', storeIds: ['company-store', 'franchise-store', 'operator-store'] },
      { id: 'manager-2', label: 'Aynı Ad', storeIds: [] },
    ]) };
    return { report, directory, service: new StoreMonthlyReportPackageService(report as never, undefined, directory as never) };
  }
  const input = { period: '2026-06', today: '2026-06-14', companyIds: ['company-1'], regionIds: [], storeIds: [], requestedRegionManagerUserId: 'manager-1' };

  it('uses the selected user ID and intersects its direct stores with the original scope', async () => {
    const { service, report, directory } = createService();
    await service.getSummary(input);
    expect(directory.listRegionManagerDirectory).toHaveBeenCalledWith({ companyIds: ['company-1'] });
    expect(report.getStoreMonthlyReportPackageRows).toHaveBeenCalledWith(expect.objectContaining({ companyIds: ['company-1'], selectedStoreIds: ['company-store', 'franchise-store', 'operator-store'] }));
  });

  it.each(['manager-2', 'outside-manager'])('keeps %s empty instead of reverting to all stores', async requestedRegionManagerUserId => {
    const { service, report } = createService();
    await service.getSummary({ ...input, requestedRegionManagerUserId });
    expect(report.getStoreMonthlyReportPackageRows).toHaveBeenCalledWith(expect.objectContaining({ selectedStoreIds: [] }));
  });

  it('never calls the unbounded directory when company scope is empty', async () => {
    const { service, report, directory } = createService();
    await service.getSummary({ ...input, companyIds: [] });
    expect(directory.listRegionManagerDirectory).not.toHaveBeenCalled();
    expect(report.getStoreMonthlyReportPackageRows).toHaveBeenCalledWith(expect.objectContaining({ selectedStoreIds: [] }));
  });

  it('applies the identical manager selection before generating the workbook', async () => {
    const { service, report } = createService();
    await service.buildWorkbook(input);
    expect(report.getStoreMonthlyReportPackageRows).toHaveBeenCalledWith(expect.objectContaining({ companyIds: ['company-1'], selectedStoreIds: ['company-store', 'franchise-store', 'operator-store'] }));
  });
});
