import { TargetDistributionService } from "./target-distribution.service";

describe("TargetDistributionService", () => {
  it("summarizes approved target coverage for active personnel", async () => {
    const targetDistributionRepository = {
      listTargetCoverage: jest.fn(async () => [
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_name: "Marmara Park",
          employee_id: "00000000-0000-4000-8000-000000000501",
          first_name: "Ada",
          last_name: "Kaya",
          external_employee_ref: "FM8375",
          personnel_target_reference_id: "00000000-0000-4000-8000-000000000901",
          target_value: "100000",
          target_status: "approved",
        },
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_name: "Marmara Park",
          employee_id: "00000000-0000-4000-8000-000000000502",
          first_name: "Ece",
          last_name: "Demir",
          external_employee_ref: "FM8376",
          personnel_target_reference_id: null,
          target_value: null,
          target_status: "missing",
        },
      ]),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    const result = await service.getTargetCoverage({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: [],
        storeIds: [],
      },
      requestMonth: "2026-03-01",
    });

    expect(targetDistributionRepository.listTargetCoverage).toHaveBeenCalledWith({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestMonth: "2026-03-01",
      storeId: undefined,
    });
    expect(result.summary).toEqual({
      requestMonth: "2026-03-01",
      totalEmployees: 2,
      coveredEmployees: 1,
      missingEmployees: 1,
      coverageRate: 0.5,
    });
    expect(result.items).toEqual([
      {
        storeId: "00000000-0000-4000-8000-000000000201",
        storeName: "Marmara Park",
        employeeId: "00000000-0000-4000-8000-000000000501",
        displayName: "Ada Kaya",
        externalEmployeeRef: "FM8375",
        targetReferenceId: "00000000-0000-4000-8000-000000000901",
        targetValue: 100000,
        targetStatus: "approved",
      },
      {
        storeId: "00000000-0000-4000-8000-000000000201",
        storeName: "Marmara Park",
        employeeId: "00000000-0000-4000-8000-000000000502",
        displayName: "Ece Demir",
        externalEmployeeRef: "FM8376",
        targetReferenceId: null,
        targetValue: null,
        targetStatus: "missing",
      },
    ]);
  });
});
