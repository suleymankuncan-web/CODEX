import { TargetDistributionService } from "./target-distribution.service";

describe("TargetDistributionService", () => {
  it("keeps store manager request lists limited to assigned stores even when company scope is present", async () => {
    const targetDistributionRepository = {
      listRequests: jest.fn(async () => ({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      })),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    await service.listRequests({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actorActionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actorRoleCodes: ["STORE_MANAGER"],
      statuses: ["pending_region_approval"],
      requestMonth: "2026-03-01",
      storeId: "00000000-0000-4000-8000-000000000201",
      limit: 200,
      offset: 0,
    });

    expect(targetDistributionRepository.listRequests).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["00000000-0000-4000-8000-000000000201"],
      statuses: ["pending_region_approval"],
      requestMonth: "2026-03-01",
      storeId: "00000000-0000-4000-8000-000000000201",
      limit: 200,
      offset: 0,
    });
  });

  it("keeps store manager target coverage limited to assigned stores even when company scope is present", async () => {
    const targetDistributionRepository = {
      listTargetCoverage: jest.fn(async () => []),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    await service.getTargetCoverage({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actorActionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actorRoleCodes: ["STORE_MANAGER"],
      requestMonth: "2026-03-01",
    });

    expect(targetDistributionRepository.listTargetCoverage).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["00000000-0000-4000-8000-000000000201"],
      requestMonth: "2026-03-01",
      storeId: undefined,
    });
  });

  it("rejects allocations for employees that are not active in the requested store", async () => {
    const targetDistributionRepository = {
      createRequest: jest.fn(),
    };
    const storeOpsRepository = {
      listStorePersonnelTargetingRows: jest.fn(async () => [
        {
          employee_id: "00000000-0000-4000-8000-000000000501",
          first_name: "Ada",
          last_name: "Kaya",
          external_employee_ref: "FM8375",
          period_start: null,
          period_end: null,
          net_sales_value: null,
        },
      ]),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      storeOpsRepository as never,
    );

    await expect(
      service.createRequest({
        actorUserId: "user-1",
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
          regionIds: ["00000000-0000-4000-8000-000000000010"],
          storeIds: ["00000000-0000-4000-8000-000000000201"],
        },
        actorActionScope: {
          assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
        },
        storeId: "00000000-0000-4000-8000-000000000201",
        requestMonth: "2026-03-01",
        targetLabel: "Net Sales",
        totalTargetValue: 175000,
        allocations: [
          {
            employeeId: "00000000-0000-4000-8000-000000000501",
            assigneeLabel: "Ada Kaya",
            targetValue: 100000,
          },
          {
            employeeId: "00000000-0000-4000-8000-000000000999",
            assigneeLabel: "Outside Store",
            targetValue: 75000,
          },
        ],
      }),
    ).rejects.toThrow("Target allocation contains employees outside the requested store");

    expect(storeOpsRepository.listStorePersonnelTargetingRows).toHaveBeenCalledWith({
      storeId: "00000000-0000-4000-8000-000000000201",
    });
    expect(targetDistributionRepository.createRequest).not.toHaveBeenCalled();
  });

  it("uses the requested store's canonical company and region when creating requests", async () => {
    const targetDistributionRepository = {
      createRequest: jest.fn(async () => ({
        request_id: "00000000-0000-4000-8000-000000000701",
      })),
    };
    const storeOpsRepository = {
      listStorePersonnelTargetingRows: jest.fn(async () => [
        {
          employee_id: "00000000-0000-4000-8000-000000000501",
          first_name: "Ada",
          last_name: "Kaya",
          external_employee_ref: "FM8375",
          period_start: null,
          period_end: null,
          net_sales_value: null,
        },
      ]),
      listStoresByScope: jest.fn(async () => [
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_code: "MPK",
          store_name: "Marmara Park",
          region_id: "00000000-0000-4000-8000-000000000010",
          company_id: "00000000-0000-4000-8000-000000000001",
          status: "active",
        },
      ]),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      storeOpsRepository as never,
    );

    await service.createRequest({
      actorUserId: "user-1",
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000099"],
        regionIds: ["00000000-0000-4000-8000-000000000098"],
        storeIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actorActionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
      storeId: "00000000-0000-4000-8000-000000000201",
      requestMonth: "2026-03-01",
      targetLabel: "Net Sales",
      totalTargetValue: 100000,
      requestReason: "Pilot target update",
      allocations: [
        {
          employeeId: "00000000-0000-4000-8000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
      ],
    });

    expect(storeOpsRepository.listStoresByScope).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["00000000-0000-4000-8000-000000000201"],
      requestedStoreId: "00000000-0000-4000-8000-000000000201",
    });
    expect(targetDistributionRepository.createRequest).toHaveBeenCalledWith({
      companyId: "00000000-0000-4000-8000-000000000001",
      regionId: "00000000-0000-4000-8000-000000000010",
      storeId: "00000000-0000-4000-8000-000000000201",
      requestMonth: "2026-03-01",
      targetLabel: "Net Sales",
      totalTargetValue: 100000,
      requestReason: "Pilot target update",
      allocations: [
        {
          employeeId: "00000000-0000-4000-8000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
      ],
      submittedByUserId: "user-1",
    });
  });

  it("approves with edited allocations when every employee belongs to the request store", async () => {
    const targetDistributionRepository = {
      getRequestScope: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000201",
      })),
      approveRequest: jest.fn(async () => ({
        requestId: "00000000-0000-4000-8000-000000000701",
      })),
    };
    const storeOpsRepository = {
      listStorePersonnelTargetingRows: jest.fn(async () => [
        {
          employee_id: "00000000-0000-4000-8000-000000000501",
          first_name: "Ada",
          last_name: "Kaya",
          external_employee_ref: "FM8375",
          period_start: null,
          period_end: null,
          net_sales_value: null,
        },
        {
          employee_id: "00000000-0000-4000-8000-000000000502",
          first_name: "Ece",
          last_name: "Demir",
          external_employee_ref: "FM8376",
          period_start: null,
          period_end: null,
          net_sales_value: null,
        },
      ]),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      storeOpsRepository as never,
    );

    await service.approveRequest({
      actorUserId: "region-user",
      actorActionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
      requestId: "00000000-0000-4000-8000-000000000701",
      approvalNote: "Bolge hedefi dengeledi",
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        {
          employeeId: "00000000-0000-4000-8000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
        {
          employeeId: "00000000-0000-4000-8000-000000000502",
          assigneeLabel: "Ece Demir",
          targetValue: 75000,
        },
      ],
    });

    expect(storeOpsRepository.listStorePersonnelTargetingRows).toHaveBeenCalledWith({
      storeId: "00000000-0000-4000-8000-000000000201",
    });
    expect(targetDistributionRepository.approveRequest).toHaveBeenCalledWith({
      requestId: "00000000-0000-4000-8000-000000000701",
      approverUserId: "region-user",
      approvalNote: "Bolge hedefi dengeledi",
      approvedTotalTargetValue: 175000,
      approvedAllocations: [
        {
          employeeId: "00000000-0000-4000-8000-000000000501",
          assigneeLabel: "Ada Kaya",
          targetValue: 100000,
        },
        {
          employeeId: "00000000-0000-4000-8000-000000000502",
          assigneeLabel: "Ece Demir",
          targetValue: 75000,
        },
      ],
    });
  });

  it("rejects edited approve payloads when allocation total does not match the approved target total", async () => {
    const targetDistributionRepository = {
      getRequestScope: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000201",
      })),
      approveRequest: jest.fn(),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    await expect(
      service.approveRequest({
        actorUserId: "region-user",
        actorActionScope: {
          assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
        },
        requestId: "00000000-0000-4000-8000-000000000701",
        approvalNote: "Bolge hedefi dengeledi",
        approvedTotalTargetValue: 175000,
        approvedAllocations: [
          {
            employeeId: "00000000-0000-4000-8000-000000000501",
            assigneeLabel: "Ada Kaya",
            targetValue: 100000,
          },
        ],
      }),
    ).rejects.toThrow("Approved allocation total must match the approved target total");

    expect(targetDistributionRepository.approveRequest).not.toHaveBeenCalled();
  });

  it("rejects partial edited approve payloads before persisting", async () => {
    const targetDistributionRepository = {
      getRequestScope: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000201",
      })),
      approveRequest: jest.fn(),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    await expect(
      service.approveRequest({
        actorUserId: "region-user",
        actorActionScope: {
          assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
        },
        requestId: "00000000-0000-4000-8000-000000000701",
        approvalNote: "Bolge hedefi dengeledi",
        approvedTotalTargetValue: 175000,
      }),
    ).rejects.toThrow(
      "Approved target total and final allocations must be submitted together",
    );

    expect(targetDistributionRepository.approveRequest).not.toHaveBeenCalled();
  });

  it("requires a note when approving edited target allocations", async () => {
    const targetDistributionRepository = {
      getRequestScope: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000201",
      })),
      approveRequest: jest.fn(),
    };
    const service = new TargetDistributionService(
      targetDistributionRepository as never,
      {} as never,
    );

    await expect(
      service.approveRequest({
        actorUserId: "region-user",
        actorActionScope: {
          assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
        },
        requestId: "00000000-0000-4000-8000-000000000701",
        approvedTotalTargetValue: 100000,
        approvedAllocations: [
          {
            employeeId: "00000000-0000-4000-8000-000000000501",
            assigneeLabel: "Ada Kaya",
            targetValue: 100000,
          },
        ],
      }),
    ).rejects.toThrow("Approval note is required when target allocations are edited");

    expect(targetDistributionRepository.approveRequest).not.toHaveBeenCalled();
  });

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
          pending_request_id: null,
          pending_target_value: null,
          stale_target_reference_id: null,
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
          pending_request_id: null,
          pending_target_value: null,
          stale_target_reference_id: null,
          target_status: "missing",
        },
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_name: "Marmara Park",
          employee_id: "00000000-0000-4000-8000-000000000503",
          first_name: "Mert",
          last_name: "Kaya",
          external_employee_ref: "FM8377",
          personnel_target_reference_id: null,
          target_value: null,
          pending_request_id: "00000000-0000-4000-8000-000000000701",
          pending_target_value: "125000",
          stale_target_reference_id: null,
          target_status: "pending_region_approval",
        },
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_name: "Marmara Park",
          employee_id: "00000000-0000-4000-8000-000000000504",
          first_name: "Deniz",
          last_name: "Arslan",
          external_employee_ref: "FM8378",
          personnel_target_reference_id: "00000000-0000-4000-8000-000000000902",
          target_value: "90000",
          pending_request_id: "00000000-0000-4000-8000-000000000702",
          pending_target_value: "100000",
          stale_target_reference_id: null,
          target_status: "pending_change_conflict",
        },
        {
          store_id: "00000000-0000-4000-8000-000000000201",
          store_name: "Marmara Park",
          employee_id: "00000000-0000-4000-8000-000000000505",
          first_name: "Selin",
          last_name: "Yurt",
          external_employee_ref: "FM8379",
          personnel_target_reference_id: null,
          target_value: null,
          pending_request_id: null,
          pending_target_value: null,
          stale_target_reference_id: "00000000-0000-4000-8000-000000000903",
          target_status: "stale_reference",
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
      actorRoleCodes: ["REPORT_VIEWER"],
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
      totalEmployees: 5,
      coveredEmployees: 2,
      missingEmployees: 1,
      pendingEmployees: 1,
      conflictEmployees: 1,
      staleEmployees: 1,
      uncoveredEmployees: 3,
      coverageRate: 0.4,
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
        pendingRequestId: null,
        pendingTargetValue: null,
        staleTargetReferenceId: null,
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
        pendingRequestId: null,
        pendingTargetValue: null,
        staleTargetReferenceId: null,
        targetStatus: "missing",
      },
      {
        storeId: "00000000-0000-4000-8000-000000000201",
        storeName: "Marmara Park",
        employeeId: "00000000-0000-4000-8000-000000000503",
        displayName: "Mert Kaya",
        externalEmployeeRef: "FM8377",
        targetReferenceId: null,
        targetValue: null,
        pendingRequestId: "00000000-0000-4000-8000-000000000701",
        pendingTargetValue: 125000,
        staleTargetReferenceId: null,
        targetStatus: "pending_region_approval",
      },
      {
        storeId: "00000000-0000-4000-8000-000000000201",
        storeName: "Marmara Park",
        employeeId: "00000000-0000-4000-8000-000000000504",
        displayName: "Deniz Arslan",
        externalEmployeeRef: "FM8378",
        targetReferenceId: "00000000-0000-4000-8000-000000000902",
        targetValue: 90000,
        pendingRequestId: "00000000-0000-4000-8000-000000000702",
        pendingTargetValue: 100000,
        staleTargetReferenceId: null,
        targetStatus: "pending_change_conflict",
      },
      {
        storeId: "00000000-0000-4000-8000-000000000201",
        storeName: "Marmara Park",
        employeeId: "00000000-0000-4000-8000-000000000505",
        displayName: "Selin Yurt",
        externalEmployeeRef: "FM8379",
        targetReferenceId: null,
        targetValue: null,
        pendingRequestId: null,
        pendingTargetValue: null,
        staleTargetReferenceId: "00000000-0000-4000-8000-000000000903",
        targetStatus: "stale_reference",
      },
    ]);
  });
});
