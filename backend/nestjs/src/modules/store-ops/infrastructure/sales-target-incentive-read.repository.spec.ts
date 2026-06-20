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
    expect(text).toContain(
      "COALESCE(store_target.total_target_value, imported_store_target.target_value)::text AS store_target_amount",
    );
    expect(text).toContain("FROM ops.kpi_target kt");
    expect(text).toContain("kd.kpi_code = 'TARGET_ACHIEVEMENT'");
    expect(text).toContain("kt.scope_type = 'store'");
    expect(text).toContain("kt.period_type = 'monthly'");
    expect(text).toContain("kt.period_start = $1::date");
    expect(text).toContain("kt.period_end = $2::date");
    expect(text).toContain("kd.kpi_code = 'NET_SALES'");
    expect(text).toContain("ka.scope_type = 'store'");
    expect(text).toContain("ka.period_type = 'monthly'");
    expect(text).toContain("ka.period_start = $1::date");
    expect(text).toContain("ka.period_end = $2::date");
    expect(text).toContain("eah.start_date <= $3::date");
    expect(text).toContain("eah.end_date >= $3::date");
    expect(text).not.toContain("eah.assignment_status = 'active'");
    expect(text).toContain("INNER JOIN stg.import_batch ib");
    expect(text).toContain("ib.import_batch_id::text AS import_batch_id");
    expect(text).toContain("ka.source_batch_id IS NOT NULL");
    expect(text).not.toContain("ka.source_batch_id IS NULL");
    expect(text).not.toContain("ib.status IN ('completed', 'completed_with_errors')");
    expect(text).not.toContain("ib.company_ids && ARRAY[s.company_id]::uuid[]");
    expect(text).not.toContain("ib.started_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });

  it("lists latest available incentive periods from scoped target and sales sources", async () => {
    const { query, repository } = createRepository();

    await repository.listAvailablePeriodKeys({
      companyIds: scopeInput.companyIds,
      regionIds: [],
      storeIds: [],
      allowGlobalScope: false,
      limit: 1,
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("s.store_type = 'company'");
    expect(text).toContain("INNER JOIN ops.target_distribution_request tdr");
    expect(text).toContain("tdr.request_status = 'approved'");
    expect(text).toContain("FALSE AS has_sales");
    expect(text).toContain("INNER JOIN ops.kpi_target kt");
    expect(text).toContain("kt.scope_type = 'store'");
    expect(text).toContain("kt.period_type = 'monthly'");
    expect(text).toContain("kd_target.kpi_code = 'TARGET_ACHIEVEMENT'");
    expect(text).toContain("INNER JOIN ops.kpi_actual ka");
    expect(text).toContain("kd.kpi_code = 'NET_SALES'");
    expect(text).toContain("ka.scope_type IN ('store', 'employee')");
    expect(text).toContain("ka.period_type = 'monthly'");
    expect(text).toContain("TRUE AS has_sales");
    expect(text).not.toContain("ib.status IN ('completed', 'completed_with_errors')");
    expect(text).not.toContain("ib.company_ids && ARRAY[s.company_id]::uuid[]");
    expect(text).toContain("to_char(period_start, 'YYYY-MM') AS period_key");
    expect(text).toContain("GROUP BY period_start");
    expect(text).toContain("ORDER BY bool_or(has_sales) DESC, period_start DESC");
    expect(text).toContain("LIMIT $2");
    expect(params).toEqual([scopeInput.companyIds, 1]);
  });

  it("filters store projection sales sources at the close cutoff", async () => {
    const { query, repository } = createRepository();

    await repository.listStoreProjectionSources({
      ...scopeInput,
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("manager_user.user_id::text AS manager_user_id");
    expect(text).toContain("manager.assignment_id::text AS manager_assignment_id");
    expect(text).toContain("manager.start_date::text AS manager_assignment_started_on");
    expect(text).toContain("COALESCE(ib.finished_at, ib.started_at) <= $4::timestamptz");
    expect(text).toContain("s.company_id = ANY($5::uuid[])");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      "2026-06-01T02:00:00.000+03:00",
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
    expect(text).toContain("s.store_id = ANY($4::uuid[])");
    expect(text).toContain("s.company_id = ANY($5::uuid[])");
    expect(text).toContain("p.position_code IN");
    expect(text).toContain("'ASSISTANT_MANAGER'");
    expect(text).toContain("'SENIOR_SALES_CONSULTANT'");
    expect(text).toContain("'SALES_ASSOCIATE'");
    expect(text).toContain("'SHIFT_LEAD'");
    expect(text).not.toContain("'CASHIER'");
    expect(text).toContain("ptr.status = 'approved'");
    expect(text).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(text).toContain(
      "ptr.source_request_id = store_target.target_distribution_request_id",
    );
    expect(text).toContain(
      "COALESCE(store_target.total_target_value, imported_store_target.target_value)::text AS store_target_amount",
    );
    expect(text).toContain("FROM ops.kpi_target kt");
    expect(text).toContain("kd.kpi_code = 'TARGET_ACHIEVEMENT'");
    expect(text).toContain("kt.scope_type = 'store'");
    expect(text).toContain("kt.period_type = 'monthly'");
    expect(text).toContain("kt.period_start = $1::date");
    expect(text).toContain("kt.period_end = $2::date");
    expect(text).toContain("kd.kpi_code = 'NET_SALES'");
    expect(text).toContain("ka.scope_type = 'employee'");
    expect(text).toContain("ka.employee_id = assignment.employee_id");
    expect(text).toContain("ka.store_id = assignment.store_id");
    expect(text).toContain("FROM stg.kpi_raw kr");
    expect(text).toContain(
      "employee_map.internal_id = assignment.employee_id",
    );
    expect(text).toContain("store_map.internal_id = assignment.store_id");
    expect(text).toContain("kr.payload_json ->> 'scopeType' = 'employee'");
    expect(text).toContain(
      "kr.payload_json -> 'sourceRow' ->> 'sourceKind' = 'personnel_gross_sales'",
    );
    expect(text.match(/ka\.period_type = 'monthly'/g)).toHaveLength(2);
    expect(text).toContain("ka.period_start = $1::date");
    expect(text).toContain("ka.period_end = $2::date");
    expect(text).toContain("eah.start_date <= $3::date");
    expect(text).toContain("eah.end_date >= $3::date");
    expect(text).not.toContain("eah.assignment_status = 'active'");
    expect(text).toContain("INNER JOIN stg.import_batch ib");
    expect(text.match(/ib\.import_batch_id::text AS import_batch_id/g)).toHaveLength(2);
    expect(text.match(/ka\.source_batch_id IS NOT NULL/g)).toHaveLength(2);
    expect(text).not.toContain("ka.source_batch_id IS NULL");
    expect(text).not.toContain("ib.status IN ('completed', 'completed_with_errors')");
    expect(text).not.toContain("ib.company_ids && ARRAY[s.company_id]::uuid[]");
    expect(text).not.toContain("ib.started_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      ["00000000-0000-4000-8000-000000000201"],
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });

  it("filters personnel projection sales sources at the close cutoff", async () => {
    const { query, repository } = createRepository();

    await repository.listPersonnelProjectionSources({
      ...scopeInput,
      storeIds: ["00000000-0000-4000-8000-000000000201"],
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("personnel_user.user_id::text AS user_id");
    expect(text).toContain("assignment.assignment_id::text AS assignment_id");
    expect(text).toContain("assignment.start_date::text AS assignment_started_on");
    expect(text.match(/COALESCE\(ib\.finished_at, ib\.started_at\) <= \$4::timestamptz/g)).toHaveLength(2);
    expect(text).toContain("s.store_id = ANY($5::uuid[])");
    expect(text).toContain("s.company_id = ANY($6::uuid[])");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      "2026-05-10",
      "2026-06-01T02:00:00.000+03:00",
      ["00000000-0000-4000-8000-000000000201"],
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });

  it("uses source sales window and close cutoff to find close-blocking imports", async () => {
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
    expect(text).toContain("COALESCE(ib.finished_at, ib.started_at) <= $4::timestamptz");
    expect(text).toContain("ib.status IN ('pending', 'processing', 'queued')");
    expect(text).toContain("ib.status = 'failed'");
    expect(text).not.toContain("ib.finished_at > $4::timestamptz");
    expect(text).not.toContain("ib.status IN ('completed', 'completed_with_errors')");
    expect(text).not.toContain("ib.created_at");
    expect(params).toEqual([
      "2026-05-01",
      "2026-05-31",
      ["00000000-0000-4000-8000-000000000001"],
      "2026-06-01T02:00:00.000+03:00",
    ]);
  });

  it("does not close-block failed KPI imports when only employee references are unresolved", async () => {
    const { query, repository } = createRepository();

    await repository.listCloseBlockingKpiImports({
      companyIds: scopeInput.companyIds,
      periodStart: scopeInput.periodStart,
      periodEnd: scopeInput.periodEnd,
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
    });

    const [sql] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("stg.kpi_raw employee_unresolved_raw");
    expect(text).toContain("stg.kpi_raw close_blocking_raw");
    expect(text.match(/employee reference could not be resolved/g)).toHaveLength(2);
    expect(text).toContain("COALESCE(close_blocking_raw.normalized_status, 'pending') <> 'processed'");
    expect(text).toContain("COALESCE(employee_unresolved_raw.validation_error, '') ILIKE");
    expect(text).toContain("COALESCE(close_blocking_raw.validation_error, '') ILIKE");
    expect(text).toContain("NOT (");
  });

  it("finds pending company-store target revisions that block incentive close", async () => {
    const { query, repository } = createRepository();

    await repository.listCloseBlockingTargetRevisions({
      companyIds: scopeInput.companyIds,
      periodStart: scopeInput.periodStart,
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("FROM ops.target_distribution_request tdr");
    expect(text).toContain("INNER JOIN ops.store s");
    expect(text).toContain("s.store_type = 'company'");
    expect(text).toContain("tdr.request_status = 'pending_region_approval'");
    expect(text).toContain("tdr.request_month = $1::date");
    expect(text).toContain("tdr.company_id = ANY($2::uuid[])");
    expect(params).toEqual([
      "2026-05-01",
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });
});
