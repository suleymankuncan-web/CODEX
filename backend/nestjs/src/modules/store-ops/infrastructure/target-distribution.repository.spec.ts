import { TargetDistributionRepository } from "./target-distribution.repository";
import {
  createRepositoryQueryMock,
  findExecutedQueries,
  findExecutedQuery,
  getExecutedQuery,
} from "./repository-test-helpers";

function createRepository(rows: unknown[] = []) {
  const query = createRepositoryQueryMock(rows);
  const repository = new TargetDistributionRepository({ query } as never);

  return { query, repository };
}

describe("TargetDistributionRepository", () => {
  it("does not list all target requests when actor scope is empty", async () => {
    const { query, repository } = createRepository();

    await repository.listRequests({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      statuses: ["pending"],
    });

    const listQuery = getExecutedQuery(query, 1);
    expect(listQuery.sql).toContain("WHERE FALSE");
    expect(listQuery.params).toEqual([["pending"], 50, 0]);
  });

  it("uses the narrowest available actor scope before status filters", async () => {
    const { query, repository } = createRepository();

    await repository.listRequests({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: ["00000000-0000-0000-0000-000000000010"],
      storeIds: ["00000000-0000-0000-0000-000000000100"],
      statuses: ["pending"],
    });

    const listQuery = getExecutedQuery(query, 1);
    expect(listQuery.sql).toContain(
      "tdr.store_id = ANY($1::uuid[]) AND tdr.request_status = ANY($2::text[])",
    );
    expect(listQuery.params).toEqual([
      ["00000000-0000-0000-0000-000000000100"],
      ["pending"],
      50,
      0,
    ]);
  });

  it("applies request month, store, and pagination filters before listing target requests", async () => {
    const { query, repository } = createRepository([
      {
        target_distribution_request_id: "00000000-0000-0000-0000-000000000701",
        company_id: "00000000-0000-0000-0000-000000000001",
        region_id: "00000000-0000-0000-0000-000000000010",
        store_id: "00000000-0000-0000-0000-000000000100",
        store_name: "Marmara Park",
        request_month: "2026-05-01",
        target_label: "Mayis hedefi",
        total_target_value: "100000",
        allocation_count: 1,
        request_status: "approved",
        request_reason: null,
        allocation_json: [],
        submitted_by_user_id: "store-manager-user",
        approved_by_user_id: "region-manager-user",
        approved_at: "2026-05-02T09:00:00.000Z",
        approval_note: null,
        created_at: "2026-05-01T09:00:00.000Z",
        updated_at: "2026-05-02T09:00:00.000Z",
        total_count: "123",
      },
    ]);

    const result = await repository.listRequests({
      companyIds: [],
      regionIds: ["00000000-0000-0000-0000-000000000010"],
      storeIds: [],
      statuses: ["approved"],
      requestMonth: "2026-05-01",
      storeId: "00000000-0000-0000-0000-000000000100",
      limit: 200,
      offset: 400,
    });

    const countQuery = getExecutedQuery(query, 0);
    const listQuery = getExecutedQuery(query, 1);
    expect(countQuery.sql).toContain("SELECT COUNT(*)::text AS total_count");
    expect(listQuery.sql).toContain("tdr.region_id = ANY($1::uuid[])");
    expect(listQuery.sql).toContain("tdr.request_status = ANY($2::text[])");
    expect(listQuery.sql).toContain("tdr.request_month = $3::date");
    expect(listQuery.sql).toContain("tdr.store_id = $4::uuid");
    expect(countQuery.params).toEqual([
      ["00000000-0000-0000-0000-000000000010"],
      ["approved"],
      "2026-05-01",
      "00000000-0000-0000-0000-000000000100",
    ]);
    expect(listQuery.params).toEqual([
      ["00000000-0000-0000-0000-000000000010"],
      ["approved"],
      "2026-05-01",
      "00000000-0000-0000-0000-000000000100",
      200,
      400,
    ]);
    expect(result.total).toBe(123);
    expect(result.limit).toBe(200);
    expect(result.offset).toBe(400);
  });

  it("preserves the filtered total when a target request page is empty", async () => {
    const query = createRepositoryQueryMock()
      .mockResolvedValueOnce({ rows: [{ total_count: "7" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new TargetDistributionRepository({ query } as never);

    const result = await repository.listRequests({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestMonth: "2026-05-01",
      limit: 50,
      offset: 100,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(7);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100);
  });

  it("lists target coverage from active personnel and approved target references", async () => {
    const { query, repository } = createRepository();

    await repository.listTargetCoverage({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestMonth: "2026-03-01",
      storeId: "00000000-0000-0000-0000-000000000201",
    });

    const coverageQuery = getExecutedQuery(query);
    expect(coverageQuery.sql).toContain("FROM ops.employee_assignment_history eah");
    expect(coverageQuery.sql).toContain("eah.assignment_status = 'active'");
    expect(coverageQuery.sql).toContain("e.employment_status = 'active'");
    expect(coverageQuery.sql).toContain("LEFT JOIN ops.personnel_target_reference ptr");
    expect(coverageQuery.sql).toContain("ptr.period_start = $1::date");
    expect(coverageQuery.sql).toContain(
      "ptr.period_end = ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date",
    );
    expect(coverageQuery.sql).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(coverageQuery.sql).toContain("ptr.status = 'approved'");
    expect(coverageQuery.sql).toContain("WHEN ptr.personnel_target_reference_id IS NOT NULL");
    expect(coverageQuery.params).toEqual([
      "2026-03-01",
      ["00000000-0000-0000-0000-000000000001"],
      "00000000-0000-0000-0000-000000000201",
    ]);
  });

  it("classifies pending, conflict, stale, missing, and approved target coverage states", async () => {
    const { query, repository } = createRepository();

    await repository.listTargetCoverage({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestMonth: "2026-03-01",
    });

    const coverageQuery = getExecutedQuery(query);
    expect(coverageQuery.sql).toContain("pending_allocations AS");
    expect(coverageQuery.sql).toContain("jsonb_array_elements(tdr.allocation_json)");
    expect(coverageQuery.sql).toContain("tdr.request_status = 'pending_region_approval'");
    expect(coverageQuery.sql).toContain("stale_targets AS");
    expect(coverageQuery.sql).toContain("stale_targets.store_id <> ap.store_id");
    expect(coverageQuery.sql).toContain("WHEN ptr.personnel_target_reference_id IS NOT NULL");
    expect(coverageQuery.sql).toContain("AND pa.pending_request_id IS NOT NULL");
    expect(coverageQuery.sql).toContain("THEN 'pending_change_conflict'");
    expect(coverageQuery.sql).toContain("WHEN pa.pending_request_id IS NOT NULL");
    expect(coverageQuery.sql).toContain("THEN 'pending_region_approval'");
    expect(coverageQuery.sql).toContain("WHEN stale_targets.personnel_target_reference_id IS NOT NULL");
    expect(coverageQuery.sql).toContain("THEN 'stale_reference'");
    expect(coverageQuery.sql).toContain("ELSE 'missing'");
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
    const query = createRepositoryQueryMock()
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

    const targetReferenceCalls = findExecutedQueries(
      query,
      "INSERT INTO ops.personnel_target_reference",
    );
    expect(targetReferenceCalls).toHaveLength(2);
    expect(targetReferenceCalls[0]?.params).toEqual([
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
    expect(targetReferenceCalls[0]?.sql).toContain(
      "ON CONFLICT (employee_id, period_start, period_end, target_type)",
    );

    const auditCall = findExecutedQuery(query, "INSERT INTO audit.event_log");
    expect(auditCall).not.toBeNull();
    expect(auditCall?.params[0]).toBe("region-manager-user");
    expect(JSON.parse(auditCall?.params[5] as string)).toMatchObject({
      actorUserId: "region-manager-user",
      promotedTargetReferenceCount: 2,
    });
  });

  it("persists edited final allocations before promotion", async () => {
    const approvedAllocations = [
      {
        employeeId: "00000000-0000-0000-0000-000000000501",
        assigneeLabel: "Ada Kaya",
        targetValue: 100000,
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
      allocation_json: approvedAllocations,
      submitted_by_user_id: "store-manager-user",
      approved_by_user_id: "region-manager-user",
      approved_at: "2026-03-02T08:00:00.000Z",
      approval_note: "Duzenlendi",
      created_at: "2026-03-01T08:00:00.000Z",
      updated_at: "2026-03-02T08:00:00.000Z",
    };
    const query = createRepositoryQueryMock()
      .mockResolvedValueOnce({ rows: [requestRow] })
      .mockResolvedValue({ rows: [] });
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const repository = new TargetDistributionRepository({
      withTransaction,
    } as never);

    await repository.approveRequest({
      requestId: requestRow.target_distribution_request_id,
      approverUserId: "region-manager-user",
      approvalNote: "Duzenlendi",
      approvedTotalTargetValue: 175000,
      approvedAllocations,
    });

    const updateCall = getExecutedQuery(query, 0);
    expect(updateCall.sql).toContain("allocation_json");
    expect(updateCall.params).toContain(JSON.stringify(approvedAllocations));

    const targetReferenceCalls = findExecutedQueries(
      query,
      "INSERT INTO ops.personnel_target_reference",
    );
    expect(targetReferenceCalls).toHaveLength(2);
    expect(targetReferenceCalls[0]?.params[6]).toBe(approvedAllocations[0].targetValue);
    expect(targetReferenceCalls[1]?.params[6]).toBe(approvedAllocations[1].targetValue);

    const auditCall = findExecutedQuery(query, "INSERT INTO audit.event_log");
    expect(JSON.parse(auditCall?.params[5] as string)).toMatchObject({
      actorUserId: "region-manager-user",
      approvalMode: "adjusted",
      promotedTargetReferenceCount: 2,
      finalAllocationCount: 2,
    });
  });
});
