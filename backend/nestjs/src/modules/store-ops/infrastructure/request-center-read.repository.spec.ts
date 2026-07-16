import { RequestCenterReadRepository } from "./request-center-read.repository";

const requestRow = {
  request_id: "11111111-1111-4111-8111-111111111111",
  request_type: "target" as const,
  store_id: "22222222-2222-4222-8222-222222222222",
  store_name: "Store A",
  region_id: "33333333-3333-4333-8333-333333333333",
  region_name: "Marmara",
  region_manager_names: ["Region Manager", "Second Manager"],
  request_status: "pending_region_approval",
  created_at: "2026-07-08T09:00:00.000Z",
  reviewed_at: null,
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
          rows: [{
            total_count: "10000",
            open_count: "10001",
            done_count: "22",
            returned_count: "1",
            overdue_count: "3",
            available_periods: ["2026-07", "2026-06"],
          }],
        })
        .mockResolvedValueOnce({ rows: [requestRow] })
        .mockResolvedValueOnce({
          rows: [{
            request_id: requestRow.request_id,
            event_id: "event-1",
            event_type: "target_distribution_request.created",
            occurred_at: "2026-07-08T09:00:00.000Z",
            actor_display_name: "Store Manager",
            event_total: "21",
          }],
        }),
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
      items: [{
        ...requestRow,
        event_total: 21,
        events: [{
          request_id: requestRow.request_id,
          event_id: "event-1",
          event_type: "target_distribution_request.created",
          occurred_at: "2026-07-08T09:00:00.000Z",
          actor_display_name: "Store Manager",
          event_total: "21",
        }],
      }],
      total: 10000,
      summary: {
        open: 10001,
        done: 22,
        returned: 1,
        overdue: 3,
        periods: ["2026-07", "2026-06"],
      },
      limit: 15,
      offset: 30,
    });
    expect(databaseService.query).toHaveBeenCalledTimes(3);

    const countCall = databaseService.query.mock.calls[0];
    const pageCall = databaseService.query.mock.calls[1];
    const countSql = String(countCall[0]);
    const pageSql = String(pageCall[0]);
    const eventSql = String(databaseService.query.mock.calls[2][0]);

    expect(countSql).toContain("ops.target_distribution_request");
    expect(countSql).toContain("ops.seller_code_request");
    expect(countSql).toContain("ops.employee_offboarding_request");
    expect(countSql).toContain("UNION ALL");
    expect(countSql).toContain("region_id = ANY");
    expect(countSql).toContain("request_status NOT IN ('approved', 'rejected')");
    expect(countSql).toContain("updated_at >=");
    expect(countSql).toContain("AT TIME ZONE 'Europe/Istanbul'");
    expect(countSql).toContain("ARRAY_AGG");
    expect(countSql).toContain("scoped_rows");
    expect(countSql).toContain("timing_rows");
    expect(countSql).toContain("INTERVAL '2 days'");
    expect(countSql).toContain("INTERVAL '3 days'");
    expect(countSql).not.toContain("updated_at + INTERVAL");
    expect(countSql).toContain("search_text ILIKE");
    expect(pageSql).toContain(
      "ORDER BY rr.updated_at DESC, rr.request_type ASC, rr.request_id DESC",
    );
    expect(pageSql).toContain("LIMIT");
    expect(pageSql).toContain("OFFSET");
    expect(pageSql).toContain("created_at");
    expect(pageSql).toContain("reviewed_at");
    expect(pageSql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(pageSql).toContain("region_manager_names");
    expect(pageSql).toContain("ARRAY_AGG");
    expect(eventSql).toContain("audit.event_log");
    expect(eventSql).toContain("ROW_NUMBER() OVER");
    expect(eventSql).toContain("COUNT(*) OVER");
    expect(eventSql).toContain("event_type = ANY");
    expect(eventSql).not.toContain("metadata_json");
    expect(result.items[0]).toEqual(expect.objectContaining({
      events: [expect.objectContaining({ event_type: "target_distribution_request.created" })],
    }));
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
