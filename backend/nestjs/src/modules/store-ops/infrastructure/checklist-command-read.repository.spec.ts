import { ChecklistCommandReadRepository } from "./checklist-command-read.repository";

describe("ChecklistCommandReadRepository", () => {
  it("returns one bounded company-scoped region aggregate without region N+1 queries", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [{
        period_key: "2026-07",
        total_count: 1,
        metrics_json: {
          totalStores: 40,
          missingVisitStores: 7,
          storesWithOpenActions: 5,
          openActionCount: 8,
          completedCoverageStores: 33,
        },
        items_json: [{
          managerUserId: "manager-1",
          regionId: "region-1",
          regionName: "Marmara",
          regionManagers: [],
          metrics: {
            totalStores: 40,
            missingVisitStores: 7,
            storesWithOpenActions: 5,
            openActionCount: 8,
            blockedActionCount: 1,
            completedCoverageStores: 33,
          },
          visitAverageScore: 86,
          scoreSampleCount: 66,
          lastOperationalAt: "2026-07-12T09:00:00.000Z",
        }],
      }],
    });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    const result = await repository.listRegions({
      companyIds: ["company-1"],
      period: "2026-07",
      query: "  Süleyman_% ",
      signal: "missing_visit",
      sort: "missing_desc",
      limit: 20,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(sql).toContain("INNER JOIN ops.user_action_store_assignment manager_store");
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).toContain("manager_store.user_id = ma.manager_user_id");
    expect(sql).toContain("INNER JOIN scoped_stores ss ON ss.store_id = manager_store.store_id");
    expect(sql).toContain("ura.company_id = ANY($1::uuid[])");
    expect(sql).toContain("company.status = 'active'");
    expect(sql).toContain("r.status = 'active'");
    expect(sql).toContain("r.company_id = s.company_id");
    expect(sql).toContain("LEFT JOIN store_signals signal");
    expect(sql).toContain("COUNT(signal.store_id)::int AS total_stores");
    expect(sql).toContain("manager_user_id ASC");
    expect(sql).toContain("completed_type_count < 2");
    expect(sql).toContain("GROUP BY manager.manager_user_id");
    expect(sql).toContain("latest_completed AS");
    expect(sql).toContain("active_checklists AS");
    expect(sql).toContain("manager_user_id::text ILIKE '%' || $6::text || '%' ESCAPE '\\'");
    expect(sql).toContain("region_name ILIKE '%' || $6::text || '%' ESCAPE '\\'");
    expect(sql).not.toContain("ci.total_score IS NOT NULL");
    expect(sql).not.toContain("ua.email");
    expect(query.mock.calls[0][1]).toEqual([
      ["company-1"], "2026-07", "missing_visit", 20, 0, "Süleyman\\_\\%",
    ]);
    expect(result.metrics.totalStores).toBe(40);
    expect(result.items[0]?.metrics.totalStores).toBe(40);
  });

  it("derives manager region identity only from active direct scoped stores", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [{
        period_key: "2026-07",
        total_count: 1,
        metrics_json: {
          totalStores: 1,
          missingVisitStores: 1,
          storesWithOpenActions: 0,
          openActionCount: 0,
          completedCoverageStores: 0,
        },
        items_json: [{
          managerUserId: "manager-live",
          regionId: "region-from-store",
          regionName: "Live manager",
          regionManagers: [{ displayName: "Live manager" }],
          metrics: {
            totalStores: 1,
            missingVisitStores: 1,
            storesWithOpenActions: 0,
            openActionCount: 0,
            blockedActionCount: 0,
            completedCoverageStores: 0,
          },
          visitAverageScore: null,
          scoreSampleCount: 0,
          lastOperationalAt: null,
        }],
      }],
    });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    const result = await repository.listRegions({
      companyIds: ["company-1"],
      period: "2026-07",
      signal: "all",
      sort: "manager_asc",
      limit: 20,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(result.total).toBe(1);
    expect(result.items[0]?.regionId).toBe("region-from-store");
    expect(sql).toContain("INNER JOIN scoped_stores ss ON ss.store_id = manager_store.store_id");
    expect(sql).toContain("MIN(manager.region_id::text)::uuid AS region_id");
    expect(sql).not.toContain("LEFT JOIN ops.user_action_store_assignment manager_store");
    expect(sql).not.toContain("COALESCE(MIN(manager.region_id::text)::uuid, manager.manager_user_id)");
    expect(sql).not.toContain("ura.region_id");
  });

  it("returns one scoped aggregate page and derives last visit only from completed checklists", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          period_key: "2026-07",
          total_count: 1,
          metrics_json: {
            totalStores: 1,
            needsVisit: 0,
            active: 0,
            pending: 0,
            completed: 1,
          },
          items_json: [
            {
              storeId: "store-1",
              storeCode: "ST-001",
              storeName: "Marmara Park",
              regionId: "region-1",
              regionName: "Marmara",
              regionManagers: [{ displayName: "Süleyman Öztürk" }],
              bmScore: 92,
              vmScore: 86,
              bmCompletedAt: "2026-07-10T09:00:00.000Z",
              vmCompletedAt: "2026-07-09T09:00:00.000Z",
              lastCompletedVisitAt: "2026-07-10T09:00:00.000Z",
              elapsedDaysSinceLastVisit: 4,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: "completed",
              reasonCodes: ["completed_period"],
              lastOperationalAt: "2026-07-10T09:00:00.000Z",
            },
          ],
        },
      ],
    });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    const result = await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      executionTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "store_asc",
      limit: 30,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("scoped_stores");
    expect(sql).toContain("company.status = 'active'");
    expect(sql).toContain("r.status = 'active'");
    expect(sql).toContain("r.company_id = s.company_id");
    expect(sql).toContain("ci.status = 'completed'");
    expect(sql).toContain("ci.completed_at IS NOT NULL");
    expect(sql).not.toContain("planned_at");
    expect(sql).not.toContain("acknowledgement_note");
    expect(sql).not.toContain("resolution_note");
    expect(sql).not.toContain("ua.email");
    expect(query.mock.calls[0][1]).toEqual([
      [],
      ["region-1"],
      [],
      ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      "2026-07",
      null,
      null,
      "all",
      30,
      0,
      "all",
      ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      null,
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lastCompletedVisitAt).toBe("2026-07-10T09:00:00.000Z");
  });

  it("keeps null-score completions in coverage while excluding them from score samples", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.listRegions({
      companyIds: ["company-1"],
      period: "2026-07",
      signal: "completed_coverage",
      sort: "score_desc",
      limit: 20,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("COUNT(*)::int AS completed_type_count");
    expect(sql).toContain("COUNT(total_score)::int AS score_sample_count");
    expect(sql).toContain("SUM(total_score)::numeric AS score_sum");
    expect(sql).not.toContain("ci.total_score IS NOT NULL");
  });

  it("orders status pages deterministically without changing the read scope", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      executionTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "status_asc",
      limit: 30,
      offset: 0,
    });

    expect(String(query.mock.calls[0][0])).toContain(
      "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END ASC",
    );
  });

  it("orders command pages by elapsed visit time with nulls last for longest first", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
      executionTemplateTypes: ["BM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "elapsed_desc",
      limit: 30,
      offset: 0,
    });

    expect(String(query.mock.calls[0][0])).toContain(
      "elapsed_days_since_last_visit DESC NULLS LAST, store_name ASC, store_id ASC",
    );
  });

  it("orders BM scores from low to high while keeping missing scores last", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
      executionTemplateTypes: ["BM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "bm_score_asc",
      limit: 30,
      offset: 0,
    });

    expect(String(query.mock.calls[0][0])).toContain(
      "bm_score ASC NULLS LAST, store_name ASC, store_id ASC",
    );
  });

  it("filters independent coverage signals without changing mutually exclusive status", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.list({
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      executionTemplateTypes: ["BM_STORE_VISIT"],
      period: "2026-07",
      status: "active",
      signal: "missing_visit",
      sort: "store_asc",
      limit: 30,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("command_status = $8::text");
    expect(sql).toContain("execution_completed_type_count < cardinality($12::text[])");
    expect(sql).not.toContain("ci.total_score IS NOT NULL");
    expect(sql).toContain("execution_pending_acknowledgement_count");
    expect(sql).toContain("'completed', (SELECT COUNT(*)::int FROM command_base WHERE execution_completed_type_count >= cardinality($12::text[]))");
    expect(sql).toContain("pc.bm_completed_at IS NULL");
    expect(sql).toContain("pc.vm_completed_at IS NULL");
    expect(query.mock.calls[0][1][11]).toEqual(["BM_STORE_VISIT"]);
    expect(query.mock.calls[0][1][10]).toBe("missing_visit");
  });
});
