import { SalesTargetIncentiveCalculatorService } from "./sales-target-incentive-calculator.service";
import { SalesTargetIncentiveReadModelService } from "./sales-target-incentive-read-model.service";

const storeSource = {
  company_id: "company-1",
  region_id: "region-1",
  store_id: "store-1",
  store_name: "Marmara Park",
  store_type: "company",
  store_target_request_id: "target-request-1",
  store_target_amount: "1000000.0000",
  store_net_sales_amount: "1150000.0000",
  store_net_sales_source_batch_id: "batch-store-1",
  store_net_sales_source_payload_hash: "hash-store-1",
  store_net_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
  manager_employee_id: "manager-1",
  manager_first_name: "Ada",
  manager_last_name: "Yilmaz",
  manager_position_code: "STORE_MANAGER",
};

const personnelSource = {
  company_id: "company-1",
  region_id: "region-1",
  store_id: "store-1",
  store_name: "Marmara Park",
  store_type: "company",
  store_target_request_id: "target-request-1",
  store_target_amount: "1000000.0000",
  store_net_sales_amount: "1150000.0000",
  store_net_sales_source_batch_id: "batch-store-1",
  personnel_target_reference_id: "target-ref-1",
  personnel_target_amount: "200000.0000",
  personnel_positive_sales_amount: "240000.0000",
  personnel_sales_source_batch_id: "batch-personnel-1",
  personnel_sales_source_payload_hash: "hash-personnel-1",
  personnel_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
  employee_id: "employee-1",
  first_name: "Ali",
  last_name: "Can",
  external_employee_ref: "FM123",
  position_code: "SALES_ASSOCIATE",
};

function createService(input?: {
  storeRows?: unknown[];
  personnelRows?: unknown[];
  closeBlockingImports?: unknown[];
}) {
  const repository = {
    listStoreProjectionSources: jest.fn(async () => input?.storeRows ?? [storeSource]),
    listPersonnelProjectionSources: jest.fn(async () => input?.personnelRows ?? [personnelSource]),
    listCloseBlockingKpiImports: jest.fn(
      async () => input?.closeBlockingImports ?? [],
    ),
  };
  const service = new SalesTargetIncentiveReadModelService(
    repository as never,
    new SalesTargetIncentiveCalculatorService(),
  );

  return { repository, service };
}

describe("SalesTargetIncentiveReadModelService", () => {
  it("builds manager and personnel projections from approved target and sales sources", async () => {
    const { repository, service } = createService();

    const result = await service.buildCurrentProjection({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignmentAsOfDate: "2026-05-10",
    });

    expect(repository.listStoreProjectionSources).toHaveBeenCalledWith({
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      allowGlobalScope: false,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      assignmentAsOfDate: "2026-05-10",
    });
    expect(result.stores[0].manager?.calculation).toEqual(
      expect.objectContaining({
        status: "projected",
        rateTableVersion: "manager-sales-target-v1.0.0",
        achievementPct: "115.0000",
        rate: "0.0100",
        payableAmount: "11500.00",
      }),
    );
    expect(result.stores[0].personnel[0].calculation).toEqual(
      expect.objectContaining({
        status: "projected",
        rateTableVersion: "personnel-sales-target-v1.0.0",
        storeGatePassed: true,
        achievementPct: "120.0000",
        rate: "0.0165",
        payableAmount: "3960.00",
      }),
    );
  });

  it("keeps missing sales source states explicit instead of inventing zero amounts", async () => {
    const { service } = createService({
      storeRows: [
        {
          ...storeSource,
          store_net_sales_amount: null,
          store_net_sales_source_batch_id: null,
        },
      ],
      personnelRows: [
        {
          ...personnelSource,
          store_net_sales_amount: null,
          personnel_positive_sales_amount: null,
          personnel_sales_source_batch_id: null,
        },
      ],
    });

    const result = await service.buildCurrentProjection({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
    });

    expect(result.stores[0].manager?.calculation).toEqual(
      expect.objectContaining({
        status: "no_source",
        blockedReason: "missing_store_sales_source",
        payableAmount: null,
      }),
    );
    expect(result.stores[0].personnel[0].calculation).toEqual(
      expect.objectContaining({
        status: "no_source",
        blockedReason: "missing_store_sales_source",
        payableAmount: null,
      }),
    );
  });

  it("filters non-company stores and cashier rows before projection construction", async () => {
    const { service } = createService({
      storeRows: [
        { ...storeSource, store_id: "store-company", store_type: "company" },
        { ...storeSource, store_id: "store-franchise", store_type: "franchise" },
      ],
      personnelRows: [
        { ...personnelSource, store_id: "store-company", position_code: "CASHIER" },
        { ...personnelSource, store_id: "store-company", position_code: "SALES_ASSOCIATE" },
        { ...personnelSource, store_id: "store-franchise", store_type: "franchise" },
      ],
    });

    const result = await service.buildCurrentProjection({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
    });

    expect(result.stores.map((store) => store.storeId)).toEqual(["store-company"]);
    expect(result.stores[0].personnel).toHaveLength(1);
    expect(result.stores[0].personnel[0].positionCode).toBe("SALES_ASSOCIATE");
  });

  it("marks close readiness blocked when source-period imports are still unresolved", async () => {
    const { repository, service } = createService({
      closeBlockingImports: [
        {
          import_batch_id: "batch-1",
          status: "processing",
          source_window_started_at: "2026-05-01T00:00:00.000Z",
          source_window_ended_at: "2026-05-31T23:59:59.999Z",
        },
      ],
    });

    const result = await service.getCloseReadiness({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      nowIso: "2026-06-01T02:05:00.000+03:00",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(repository.listCloseBlockingKpiImports).toHaveBeenCalledWith({
      companyIds: ["company-1"],
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked_by_imports",
        canClose: false,
      }),
    );
    expect(result.blockingImports).toHaveLength(1);
  });

  it("blocks close readiness when projection calculations are incomplete", async () => {
    const { service } = createService({
      storeRows: [{ ...storeSource, store_target_amount: null }],
      personnelRows: [],
    });

    const result = await service.getCloseReadiness({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      nowIso: "2026-06-01T02:05:00.000+03:00",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked_by_calculation",
        canClose: false,
      }),
    );
  });

  it("blocks close readiness when a scoped store has no participants but missing store inputs", async () => {
    const { service } = createService({
      storeRows: [
        {
          ...storeSource,
          store_target_request_id: null,
          store_target_amount: null,
          store_net_sales_amount: null,
          store_net_sales_source_batch_id: null,
          manager_employee_id: null,
          manager_first_name: null,
          manager_last_name: null,
          manager_position_code: null,
        },
      ],
      personnelRows: [],
    });

    const result = await service.getCloseReadiness({
      periodKey: "2026-05",
      companyIds: ["company-1"],
      nowIso: "2026-06-01T02:05:00.000+03:00",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked_by_calculation",
        canClose: false,
      }),
    );
  });
});
