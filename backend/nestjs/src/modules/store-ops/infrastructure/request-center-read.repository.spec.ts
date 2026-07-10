import { RequestCenterReadRepository } from "./request-center-read.repository";

const requestRow = {
  request_id: "11111111-1111-4111-8111-111111111111",
  request_type: "target" as const,
  store_id: "22222222-2222-4222-8222-222222222222",
  store_name: "Store A",
  request_status: "pending_region_approval",
  updated_at: "2026-07-10T09:00:00.000Z",
  target_label: "July target",
  request_month: "2026-07-01",
  allocation_count: 4,
  approval_mode: null,
  person_display_name: null,
  national_id_last4: null,
  external_employee_ref: null,
};

describe("RequestCenterReadRepository", () => {
  it("returns one bounded globally ordered page with an exact large total", async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ total_count: "10000", open_count: "10001", done_count: "22", returned_count: "1" }],
        })
        .mockResolvedValueOnce({ rows: [requestRow] }),
    };
    const repository = new RequestCenterReadRepository(databaseService as never);

    const result = await repository.listRequests({
      companyIds: [],
      regionIds: ["33333333-3333-4333-8333-333333333333"],
      storeIds: [],
      bucket: "open",
      type: "all",
      status: "pending",
      period: "2026-07",
      query: "July",
      limit: 15,
      offset: 30,
    });

    expect(result).toEqual({
      items: [requestRow],
      total: 10000,
      summary: { open: 10001, done: 22, returned: 1 },
      limit: 15,
      offset: 30,
    });
    expect(databaseService.query).toHaveBeenCalledTimes(2);

    const countCall = databaseService.query.mock.calls[0];
    const pageCall = databaseService.query.mock.calls[1];
    const countSql = String(countCall[0]);
    const pageSql = String(pageCall[0]);

    expect(countSql).toContain("ops.target_distribution_request");
    expect(countSql).toContain("ops.seller_code_request");
    expect(countSql).toContain("ops.employee_offboarding_request");
    expect(countSql).toContain("UNION ALL");
    expect(countSql).toContain("region_id = ANY");
    expect(countSql).toContain("request_status NOT IN ('approved', 'rejected')");
    expect(countSql).toContain("updated_at >=");
    expect(countSql).toContain("search_text ILIKE");
    expect(pageSql).toContain(
      "ORDER BY updated_at DESC, request_type ASC, request_id DESC",
    );
    expect(pageSql).toContain("LIMIT");
    expect(pageSql).toContain("OFFSET");
    expect(pageCall[1]).toEqual(expect.arrayContaining([15, 30]));
  });

  it("omits unrelated UNION branches for a single request type", async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total_count: "0" }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const repository = new RequestCenterReadRepository(databaseService as never);

    await repository.listRequests({
      companyIds: [],
      regionIds: [],
      storeIds: ["22222222-2222-4222-8222-222222222222"],
      bucket: "done",
      type: "target",
      status: "approved",
      limit: 15,
      offset: 0,
    });

    const sql = String(databaseService.query.mock.calls[0][0]);
    expect(sql).toContain("ops.target_distribution_request");
    expect(sql).not.toContain("ops.seller_code_request");
    expect(sql).not.toContain("ops.employee_offboarding_request");
    expect(sql).toContain("store_id = ANY");
  });

  it("fails closed when no authorized read scope exists", async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ total_count: "0" }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const repository = new RequestCenterReadRepository(databaseService as never);

    await repository.listRequests({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      bucket: "open",
      type: "all",
      status: "all",
      limit: 15,
      offset: 0,
    });

    expect(String(databaseService.query.mock.calls[0][0])).toContain("FALSE");
  });
});
