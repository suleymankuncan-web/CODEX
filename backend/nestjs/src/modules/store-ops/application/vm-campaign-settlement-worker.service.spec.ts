import { VmCampaignSettlementWorkerService } from "./vm-campaign-settlement-worker.service";

describe("VmCampaignSettlementWorkerService", () => {
  afterEach(() => jest.useRealTimers());

  it("[AC-14] remains inert while settlement is disabled", () => {
    const settle = jest.fn();
    const worker = new VmCampaignSettlementWorkerService({
      vmCampaignDeadlineSettlementEnabled: false,
      vmCampaignSettlementPollSeconds: 60,
    } as never, { settle } as never);
    worker.onModuleInit();
    expect(settle).not.toHaveBeenCalled();
    worker.onModuleDestroy();
  });

  it("[AC-16] starts one bounded settlement tick when enabled", async () => {
    jest.useFakeTimers();
    const settle = jest.fn().mockResolvedValue({ opened: 0, missed: 0 });
    const worker = new VmCampaignSettlementWorkerService({
      vmCampaignDeadlineSettlementEnabled: true,
      vmCampaignSettlementPollSeconds: 60,
    } as never, { settle } as never);
    worker.onModuleInit();
    await Promise.resolve();
    expect(settle).toHaveBeenCalledWith(100);
    worker.onModuleDestroy();
  });
});
