import { StoreOpsRepository } from "./store-ops.repository";

describe("StoreOpsRepository", () => {
  it("does not let a requested store filter bypass an empty actor scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new StoreOpsRepository({ query } as never);

    await repository.listStoresByScope({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      requestedStoreId: "00000000-0000-0000-0000-000000000100",
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE FALSE"), [
      "00000000-0000-0000-0000-000000000100",
    ]);
  });

  it("intersects requested company filters with the actor company scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new StoreOpsRepository({ query } as never);

    await repository.listStoresByScope({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [],
      requestedCompanyId: "00000000-0000-0000-0000-000000000002",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("s.company_id = ANY($1::uuid[]) AND s.company_id = $2"),
      [
        ["00000000-0000-0000-0000-000000000001"],
        "00000000-0000-0000-0000-000000000002",
      ],
    );
  });

  it("lists active targetable personnel without requiring a sales snapshot row", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new StoreOpsRepository({ query } as never);

    await repository.listStorePersonnelTargetingRows({
      storeId: "00000000-0000-0000-0000-000000000100",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("FROM ops.employee_assignment_history eah");
    expect(sql).toContain("ROW_NUMBER() OVER");
    expect(sql).toContain("eah.assignment_rank = 1");
    expect(sql).toContain("LEFT JOIN latest_period lp");
    expect(sql).toContain("LEFT JOIN ops.kpi_actual ka");
    expect(sql).toContain("INNER JOIN ops.position position");
    expect(sql).toContain("position.position_code NOT IN ('STORE_MANAGER', 'CASHIER')");
    expect(sql).toContain("eah.assignment_status = 'active'");
    expect(sql).toContain("eah.end_date IS NULL");
    expect(sql).toContain("eah.is_primary_assignment = TRUE");
    expect(sql).toContain("e.employment_status = 'active'");
  });

  it("projects shortage metadata with the headcount gap", async () => {
    const storeId = "00000000-0000-0000-0000-000000000100";
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          store_id: storeId,
          planned_headcount: "8.00",
          active_headcount: "7.00",
          headcount_gap: "1.00",
          planned_fte: "8.00",
          active_fte: "7.00",
          fte_gap: "1.00",
          shortage_started_on: "2026-06-15",
          shortage_days: 17,
        },
      ],
    });
    const repository = new StoreOpsRepository({ query } as never);

    await expect(repository.getStoreHeadcountGap({
      storeId,
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    })).resolves.toMatchObject({
      headcount_gap: "1.00",
      shortage_started_on: "2026-06-15",
      shortage_days: 17,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("shortage_source"),
      [storeId, "2026-07-01", "2026-07-31"],
    );
    expect(query.mock.calls[0][0]).toEqual(expect.stringContaining("shortage_started_on"));
    expect(query.mock.calls[0][0]).not.toEqual(expect.stringContaining("turnover_projection"));
    expect(query.mock.calls[0][0]).not.toEqual(expect.stringContaining("turnover_rate"));
    expect(query.mock.calls[0][0]).toEqual(expect.stringContaining("CURRENT_DATE"));
  });
});
