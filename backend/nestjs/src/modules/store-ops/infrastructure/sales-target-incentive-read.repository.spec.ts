import { SalesTargetIncentiveReadRepository } from "./sales-target-incentive-read.repository";

function createRepository() {
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
    rowCount: 0,
    rows: [],
  }));
  const repository = new SalesTargetIncentiveReadRepository({ query } as never);

  return { query, repository };
}

describe("SalesTargetIncentiveReadRepository", () => {
  const scopeInput = {
    companyIds: ["00000000-0000-4000-8000-000000000001"],
    regionIds: [],
    storeIds: [],
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    assignmentAsOfDate: "2026-05-10",
  };

  it("binds store manager projection sources to approved store target and store NET_SALES period", async () => {
    const { query, repository } = createRepository();

    await repository.listStoreProjectionSources(scopeInput);

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("s.store_type = 'company'");
    expect(text).toContain("tdr.request_status = 'approved'");
    expect(text).toContain("tdr.request_month = $1::date");
    expect(text).toContain("kd.kpi_code = 'NET_SALES'");
    expect(text).toContain("ka.scope_type = 'store'");
    expect(text).toContain("ka.period_start = $1::date");
    expect(text).toContain("ka.period_end = $2::date");
    expect(text).toContain("eah.start_date <= $3::date");
    expect(text).toContain("eah.end_date >= $3::date");
    expect(text).toContain("ib.status IN ('completed', 'completed_with_errors')");
    expect(text).not.toContain("ib.started_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });

  it("binds personnel projection sources to approved personnel target and employee positive sales", async () => {
    const { query, repository } = createRepository();

    await repository.listPersonnelProjectionSources({
      ...scopeInput,
      storeIds: ["00000000-0000-4000-8000-000000000201"],
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("s.store_type = 'company'");
    expect(text).toContain("p.position_code IN");
    expect(text).toContain("'ASSISTANT_MANAGER'");
    expect(text).toContain("'SENIOR_SALES_CONSULTANT'");
    expect(text).toContain("'SALES_ASSOCIATE'");
    expect(text).toContain("'SHIFT_LEAD'");
    expect(text).not.toContain("'CASHIER'");
    expect(text).toContain("ptr.status = 'approved'");
    expect(text).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(text).toContain("kd.kpi_code = 'NET_SALES'");
    expect(text).toContain("ka.scope_type = 'employee'");
    expect(text).toContain("ka.employee_id = assignment.employee_id");
    expect(text).toContain("ka.store_id = assignment.store_id");
    expect(text).toContain("ka.period_start = $1::date");
    expect(text).toContain("ka.period_end = $2::date");
    expect(text).toContain("eah.start_date <= $3::date");
    expect(text).toContain("eah.end_date >= $3::date");
    expect(text).not.toContain("ib.started_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      ["00000000-0000-4000-8000-000000000201"],
    ]);
  });

  it("uses source sales window, not upload timestamp, to find close-blocking imports", async () => {
    const { query, repository } = createRepository();

    await repository.listCloseBlockingKpiImports({
      companyIds: scopeInput.companyIds,
      periodStart: scopeInput.periodStart,
      periodEnd: scopeInput.periodEnd,
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("ib.source_window_started_at IS NULL");
    expect(text).toContain("ib.source_window_ended_at IS NULL");
    expect(text).toContain("ib.source_window_started_at::date <= $2::date");
    expect(text).toContain("ib.source_window_ended_at::date >= $1::date");
    expect(text).toContain("ib.status IN ('pending', 'processing', 'queued', 'failed')");
    expect(text).not.toContain("ib.started_at");
    expect(text).not.toContain("ib.created_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      ["00000000-0000-4000-8000-000000000001"],
      "2026-06-01T02:00:00.000+03:00",
    ]);
  });
});
