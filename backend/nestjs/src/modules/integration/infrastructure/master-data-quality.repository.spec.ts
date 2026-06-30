import { MasterDataQualityRepository } from "./master-data-quality.repository";

describe("MasterDataQualityRepository", () => {
  function createRepository(queryResult: unknown) {
    const query = jest.fn().mockResolvedValue(queryResult);
    const repository = new MasterDataQualityRepository({ query } as never);

    return { query, repository };
  }

  it("builds a bounded backend projection for store, personnel, assignment, and import issues", async () => {
    const { query, repository } = createRepository({
      rows: [
        {
          issue_id: "import_batch_blocked:batch-1",
          issue_code: "import_batch_blocked",
          severity: "warning",
          entity_type: "import",
          entity_id: "batch-1",
          entity_label: "Power BI",
          secondary_label: "kpi",
          problem_label: "Import needs review",
          recommended_action: "Review rows",
          affected_modules: ["Ice Aktarim"],
          last_seen_at: "2026-06-30T10:00:00.000Z",
          source: "import",
          total_count: "8",
          critical_count: "2",
          warning_count: "5",
          info_count: "1",
          store_count: "2",
          personnel_count: "4",
          assignment_count: "1",
          import_count: "1",
        },
      ],
    });

    const result = await repository.listIssues({
      actorCompanyIds: ["company-1"],
      q: "power",
      entityType: "import",
      severity: "warning",
      issueCode: "import_batch_blocked",
      limit: 50,
      offset: 10,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("store_missing_region_assignment");
    expect(sql).toContain("store_missing_store_manager");
    expect(sql).toContain("personnel_missing_store_assignment");
    expect(sql).toContain("personnel_duplicate_seller_code");
    expect(sql).toContain("inactive_store_has_active_personnel");
    expect(sql).toContain("import_batch_blocked");
    expect(sql).toContain("COUNT(*) FILTER (WHERE severity = 'critical')");
    expect(sql).toContain("LIMIT $6");
    expect(sql).toContain("OFFSET $7");
    expect(query.mock.calls[0][1]).toEqual([
      ["company-1"],
      "%power%",
      "import",
      "warning",
      "import_batch_blocked",
      50,
      10,
    ]);
    expect(result).toEqual({
      rows: expect.any(Array),
      total: 8,
      summary: {
        severity: { critical: 2, warning: 5, info: 1 },
        entityType: { store: 2, personnel: 4, assignment: 1, import: 1 },
      },
    });
  });

  it("filters audit events outside the resolved-event CTE so aliases are queryable", async () => {
    const { query, repository } = createRepository({
      rows: [
        {
          event_id: "event-1",
          event_type: "personnel_master_data.updated",
          entity_type: "personnel",
          entity_id: "employee-1",
          entity_label: "Ada Lovelace",
          actor_label: "Admin User",
          occurred_at: "2026-06-30T10:00:00.000Z",
          metadata_json: {},
          total_count: "1",
        },
      ],
    });

    const result = await repository.listAudit({
      actorCompanyIds: ["company-1"],
      entityType: "personnel",
      entityId: "00000000-0000-4000-8000-000000000111",
      limit: 30,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("WITH events AS");
    expect(sql).toContain("FROM events");
    expect(sql).toContain("WHERE events.event_type IN");
    expect(sql).toContain("events.entity_type = $2");
    expect(sql).toContain("events.entity_id = $3::uuid");
    expect(query.mock.calls[0][1]).toEqual([
      ["company-1"],
      "personnel",
      "00000000-0000-4000-8000-000000000111",
      30,
      0,
    ]);
    expect(result.total).toBe(1);
  });
});
