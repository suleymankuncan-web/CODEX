import { TargetWorkspaceReadRepository } from "./target-workspace-read.repository";

// Traceability: TGT-FR-001..004/007, NFR-006/007, AC-TGT-001/006, EC-002..009.

describe("TargetWorkspaceReadRepository", () => {
  it("pages from authoritative stores, not requests or personnel", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "37" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);

    const page = await repository.listStorePage({
      scope: { companyIds: ["00000000-0000-4000-8000-000000000001"], regionIds: [], storeIds: [] },
      periodStart: "2026-07-01", periodEnd: "2026-07-31", limit: 20, offset: 20,
    });

    expect(page).toEqual({ items: [], total: 37, limit: 20, offset: 20 });
    const countSql = String(query.mock.calls[0][0]);
    const pageSql = String(query.mock.calls[1][0]);
    expect(countSql).toContain("FROM ops.store store");
    expect(countSql).not.toContain("target_distribution_request");
    expect(pageSql).toContain("LEFT JOIN ops.region");
    expect(pageSql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(pageSql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(pageSql).toContain("manager_store.store_id = store.store_id");
    expect(pageSql).not.toContain("role_assignment.region_id = store.region_id");
    expect(pageSql).toContain("AT TIME ZONE 'Europe/Istanbul'");
    expect(pageSql).toContain("jsonb_typeof(latest_request.allocation_json) = 'array'");
    expect(pageSql).toContain("reference.period_end = (latest_request.request_month + INTERVAL '1 month' - INTERVAL '1 day')::date");
    expect(pageSql).toContain("reference.period_end = ($2::date + INTERVAL '1 month' - INTERVAL '1 day')::date");
    expect(pageSql).toContain("reference.target_type = 'monthly_sales_target'");
    expect(pageSql).toContain("ORDER BY company.company_name ASC NULLS LAST, region.region_name ASC NULLS LAST, store.store_name ASC, store.store_id ASC");
    expect(query.mock.calls[1][1]).toEqual([
      ["00000000-0000-4000-8000-000000000001"], "2026-07-01", "2026-07-31", 20, 20,
    ]);
  });

  it("intersects store, region and company dimensions when more than one is supplied", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ total_count: "0" }] }).mockResolvedValueOnce({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listStorePage({
      scope: { companyIds: ["company"], regionIds: ["region"], storeIds: ["store"] },
      periodStart: "2026-07-01", periodEnd: "2026-07-31", limit: 20, offset: 0,
    });
    const countSql = String(query.mock.calls[0][0]);
    expect(countSql).toContain("store.store_id = ANY($1::uuid[])");
    expect(countSql).toContain("store.region_id = ANY($2::uuid[])");
    expect(countSql).toContain("store.company_id = ANY($3::uuid[])");
    expect(countSql).toContain(" AND ");
    expect(query.mock.calls[1][1]).toEqual([["store"], ["region"], ["company"], "2026-07-01", "2026-07-31", 20, 0]);
  });

  it("returns targetable personnel with safe position labels at the selected period end", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listPersonnel({ storeIds: ["00000000-0000-4000-8000-000000000101"], periodEnd: "2026-07-31" });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("position.position_name");
    expect(sql).toContain("position.position_code NOT IN ('STORE_MANAGER', 'CASHIER')");
    expect(sql).toContain("assignment.start_date <= $2::date");
    expect(sql).toContain("assignment.end_date IS NULL OR assignment.end_date >= date_trunc('month', $2::date)::date");
    expect(sql).toContain("employee.hire_date <= $2::date");
    expect(sql).toContain("employee.termination_date IS NULL OR employee.termination_date >= date_trunc('month', $2::date)::date");
    expect(sql).not.toContain("assignment.assignment_status = 'active'");
    expect(sql).not.toContain("employee.employment_status = 'active'");
    expect(sql).toContain("Kayıt sahibi bilgisi yok");
    expect(sql).not.toMatch(/username|email|national_id/i);
  });

  it("reads latest lifecycle and active approved reference truth independently for a bounded year", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listMonthStatuses({
      storeIds: ["00000000-0000-4000-8000-000000000101"], yearStart: "2026-01-01", yearEnd: "2026-12-31",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("DISTINCT ON (request.store_id, request.request_month)");
    expect(sql).toContain("COUNT(DISTINCT reference.source_request_id)::int AS approved_source_count");
    expect(sql).toContain("source_request.request_status = 'approved'");
    expect(sql).toContain("reference.status = 'approved'");
    expect(sql).toContain("reference.target_type = 'monthly_sales_target'");
    expect(sql).toContain("reference.period_end = (reference.period_start + INTERVAL '1 month' - INTERVAL '1 day')::date");
    expect(sql).toContain("source_request.approval_evidence_json AS approved_source_evidence_json");
    expect(sql).toContain("request.request_month BETWEEN $2::date AND $3::date");
    expect(sql).toContain("ORDER BY request.store_id, request.request_month, request.updated_at DESC");
  });

  it("lists company and zero-store region metadata independently for company scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listHierarchy({
      scope: { companyIds: ["company"], regionIds: [], storeIds: [] }, periodEnd: "2026-07-31",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("FROM ops.company company");
    expect(sql).toContain("LEFT JOIN ops.region region ON region.company_id = company.company_id");
    expect(sql).toContain("TRUE AS assignment_exists");
    expect(sql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(sql).toContain("manager_assigned_store.region_id = region.region_id");
    expect(sql).not.toContain("role_assignment.region_id = region.region_id");
    expect(sql).toContain("LEFT JOIN ops.employee employee");
    expect(sql).toContain("company.company_id = ANY($1::uuid[])");
    expect(query.mock.calls[0][1]).toEqual([["company"], "2026-07-31", null]);
  });

  it("derives Region Manager hierarchy only from the fully intersected store scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listHierarchy({
      scope: { companyIds: ["company"], regionIds: ["region"], storeIds: ["store"] }, periodEnd: "2026-07-31",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("WITH hierarchy_scope AS");
    expect(sql).toContain("store.store_id = ANY($1::uuid[])");
    expect(sql).toContain("store.region_id = ANY($2::uuid[])");
    expect(sql).toContain("store.company_id = ANY($3::uuid[])");
    expect(query.mock.calls[0][1]).toEqual([["store"], ["region"], ["company"], "2026-07-31", null]);
  });

  it("binds the hierarchy manager label to the selected assigned profile", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await repository.listHierarchy({
      scope: { companyIds: ["company"], regionIds: [], storeIds: ["store"] },
      periodEnd: "2026-07-31",
      managerUserId: "manager",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("manager_store.user_id = $4::uuid");
    expect(query.mock.calls[0][1]).toEqual([["store"], ["company"], "2026-07-31", "manager"]);
  });

  it("summarizes the complete scoped store universe instead of the current page", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      total_stores: "37", pending_stores: "4", approved_stores: "20",
      adjusted_approved_stores: "2", returned_stores: "1", missing_stores: "10",
      total_target_value: "900000.0000",
    }] });
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await expect(repository.summarizeScope({
      scope: { companyIds: [], regionIds: [], storeIds: ["00000000-0000-4000-8000-000000000101"] },
      periodStart: "2026-07-01",
    })).resolves.toEqual({
      totalStores: 37, pendingStores: 4, approvedStores: 20,
      adjustedApprovedStores: 2, returnedStores: 1, missingStores: 10,
      totalTargetValue: "900000.0000",
    });
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("FROM ops.store store");
    expect(sql).toContain("INNER JOIN scoped_store");
    expect(sql).toContain("DISTINCT ON (request.store_id)");
    expect(sql).toContain("approval_evidence_json ->> 'approvalMode'");
    expect(sql).toContain("approval_evidence_json ?& ARRAY[");
    expect(sql).not.toMatch(/LIMIT|OFFSET/);
  });

  it("returns immediately for an empty store page", async () => {
    const query = jest.fn();
    const repository = new TargetWorkspaceReadRepository({ query } as never);
    await expect(repository.listPersonnel({ storeIds: [], periodEnd: "2026-07-31" })).resolves.toEqual([]);
    await expect(repository.listMonthStatuses({ storeIds: [], yearStart: "2026-01-01", yearEnd: "2026-12-31" })).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
