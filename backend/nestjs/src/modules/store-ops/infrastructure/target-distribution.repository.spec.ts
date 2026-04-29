import { TargetDistributionRepository } from "./target-distribution.repository";

describe("TargetDistributionRepository", () => {
  it("does not list all target requests when actor scope is empty", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetDistributionRepository({ query } as never);

    await repository.listRequests({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      statuses: ["pending"],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE FALSE"), [
      ["pending"],
      50,
      0,
    ]);
  });

  it("uses the narrowest available actor scope before status filters", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetDistributionRepository({ query } as never);

    await repository.listRequests({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: ["00000000-0000-0000-0000-000000000010"],
      storeIds: ["00000000-0000-0000-0000-000000000100"],
      statuses: ["pending"],
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("tdr.store_id = ANY($1::uuid[]) AND tdr.request_status = ANY($2::text[])"),
      [
        ["00000000-0000-0000-0000-000000000100"],
        ["pending"],
        50,
        0,
      ],
    );
  });

  it("promotes approved allocations into personnel target references", async () => {
    const allocations = [
      {
        employeeId: "00000000-0000-0000-0000-000000000501",
        assigneeLabel: "Ada Kaya",
        targetValue: 100000,
        note: "Mart hedefi",
      },
      {
        employeeId: "00000000-0000-0000-0000-000000000502",
        assigneeLabel: "Ece Demir",
        targetValue: 75000,
      },
    ];
    const requestRow = {
      target_distribution_request_id: "00000000-0000-0000-0000-000000000701",
      company_id: "00000000-0000-0000-0000-000000000001",
      region_id: "00000000-0000-0000-0000-000000000010",
      store_id: "00000000-0000-0000-0000-000000000201",
      request_month: "2026-03-01",
      target_label: "Aylik personel hedef dagitimi",
      total_target_value: "175000",
      allocation_count: 2,
      request_status: "approved",
      request_reason: null,
      allocation_json: allocations,
      submitted_by_user_id: "store-manager-user",
      approved_by_user_id: "region-manager-user",
      approved_at: "2026-03-02T08:00:00.000Z",
      approval_note: "Uygun",
      created_at: "2026-03-01T08:00:00.000Z",
      updated_at: "2026-03-02T08:00:00.000Z",
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [requestRow] })
      .mockResolvedValue({ rows: [] });
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const repository = new TargetDistributionRepository({
      withTransaction,
    } as never);

    await repository.approveRequest({
      requestId: requestRow.target_distribution_request_id,
      approverUserId: "region-manager-user",
      approvalNote: "Uygun",
    });

    const targetReferenceCalls = query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO ops.personnel_target_reference"),
    );
    expect(targetReferenceCalls).toHaveLength(2);
    expect(targetReferenceCalls[0][1]).toEqual([
      requestRow.target_distribution_request_id,
      requestRow.company_id,
      requestRow.region_id,
      requestRow.store_id,
      allocations[0].employeeId,
      requestRow.request_month,
      allocations[0].targetValue,
      "region-manager-user",
      requestRow.approved_at,
    ]);
    expect(String(targetReferenceCalls[0][0])).toContain(
      "ON CONFLICT (employee_id, period_start, period_end, target_type)",
    );

    const auditCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO audit.event_log"),
    );
    expect(auditCall).toBeDefined();
    expect(JSON.parse(auditCall?.[1][4] as string)).toMatchObject({
      actorUserId: "region-manager-user",
      promotedTargetReferenceCount: 2,
    });
  });
});
