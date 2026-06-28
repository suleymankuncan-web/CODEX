import {
  StoreActionPlanRepository,
  StoreActionPlanTransitionConflictError,
} from "./store-action-plan.repository";

const planRow = {
  store_action_plan_id: "00000000-0000-4000-8000-000000000701",
  company_id: "00000000-0000-4000-8000-000000000001",
  region_id: "00000000-0000-4000-8000-000000000010",
  store_id: "00000000-0000-4000-8000-000000000201",
  store_name: "Marmara Park",
  owner_user_id: "00000000-0000-4000-8000-000000000901",
  owner_display_name: "Mert Alcan",
  created_by_user_id: "00000000-0000-4000-8000-000000000901",
  source_type: "kpi_exception",
  source_id: "snapshot-1:store-1:kpi-1",
  source_deep_link: "/store/kpis?kpi=kpi-1",
  source_snapshot_run_id: "00000000-0000-4000-8000-000000000301",
  source_kpi_id: "00000000-0000-4000-8000-000000000401",
  title: "Net sales off track",
  summary: "Follow up on KPI exception",
  priority: "high",
  status: "open",
  due_on: "2026-06-01",
  resolution_note: null,
  closed_by_user_id: null,
  closed_at: null,
  cancel_reason: null,
  cancelled_by_user_id: null,
  cancelled_at: null,
  created_at: "2026-05-22T08:00:00.000Z",
  updated_at: "2026-05-22T08:00:00.000Z",
};

function createTransactionHarness() {
  const query = jest.fn();
  const withTransaction = jest.fn(async (callback) => callback({ query }));
  const repository = new StoreActionPlanRepository({ withTransaction, query } as never);

  return {
    query,
    withTransaction,
    repository,
  };
}

describe("StoreActionPlanRepository", () => {
  it("creates a plan and audit event in one transaction", async () => {
    const { query, withTransaction, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({ rows: [planRow] }).mockResolvedValueOnce({ rows: [] });

    const result = await repository.createPlan({
      companyId: planRow.company_id,
      regionId: planRow.region_id,
      storeId: planRow.store_id,
      ownerUserId: planRow.owner_user_id,
      createdByUserId: planRow.created_by_user_id,
      sourceType: "kpi_exception",
      sourceId: planRow.source_id,
      sourceDeepLink: planRow.source_deep_link,
      sourceSnapshotRunId: planRow.source_snapshot_run_id,
      sourceKpiId: planRow.source_kpi_id,
      title: planRow.title,
      summary: planRow.summary,
      priority: "high",
      dueOn: planRow.due_on,
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain("INSERT INTO ops.store_action_plan");
    expect(query.mock.calls[0][1]).toEqual([
      planRow.company_id,
      planRow.region_id,
      planRow.store_id,
      planRow.owner_user_id,
      planRow.created_by_user_id,
      "kpi_exception",
      planRow.source_id,
      planRow.source_deep_link,
      planRow.source_snapshot_run_id,
      planRow.source_kpi_id,
      planRow.title,
      planRow.summary,
      "high",
      planRow.due_on,
    ]);

    const auditCall = query.mock.calls[1];
    expect(String(auditCall[0])).toContain("INSERT INTO audit.event_log");
    expect(auditCall[1][1]).toBe("store_action_plan.created");
    expect(JSON.parse(auditCall[1][6] as string)).toMatchObject({
      actorUserId: planRow.created_by_user_id,
      sourceType: "kpi_exception",
      sourceId: planRow.source_id,
    });
    expect(result.actionPlanId).toBe(planRow.store_action_plan_id);
  });

  it("lists plans for assigned action stores with status and pagination filters", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({ rows: [{ total: "1" }] }).mockResolvedValueOnce({
      rows: [planRow],
    });

    const result = await repository.listPlans({
      storeIds: [planRow.store_id],
      status: "open",
      limit: 25,
      offset: 10,
    });

    expect(String(query.mock.calls[0][0])).toContain("COUNT(*)::int AS total");
    expect(String(query.mock.calls[0][0])).toContain("store_id = ANY($1::uuid[])");
    expect(String(query.mock.calls[0][0])).toContain("status = $2");
    expect(String(query.mock.calls[1][0])).toContain("INNER JOIN ops.store s");
    expect(String(query.mock.calls[1][0])).toContain("owner_display_name");
    expect(String(query.mock.calls[1][0])).toContain("ORDER BY p.due_on ASC, p.updated_at DESC");
    expect(query.mock.calls[1][1]).toEqual([[planRow.store_id], "open", 25, 10]);
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          actionPlanId: planRow.store_action_plan_id,
          storeName: "Marmara Park",
          ownerDisplayName: "Mert Alcan",
        }),
      ],
      total: 1,
    });
  });

  it("lists active plans for workflow inbox without completed terminal states", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({ rows: [planRow] });

    const result = await repository.listWorkflowInboxPlans({
      storeIds: [planRow.store_id],
      statuses: ["open", "in_progress", "blocked"],
      limit: 20,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("FROM ops.store_action_plan p");
    expect(sql).toContain("INNER JOIN ops.store s");
    expect(sql).toContain("p.store_id = ANY($1::uuid[])");
    expect(sql).toContain("p.status = ANY($2::text[])");
    expect(sql).toContain("ORDER BY p.due_on ASC, p.updated_at DESC");
    expect(query.mock.calls[0][1]).toEqual([
      [planRow.store_id],
      ["open", "in_progress", "blocked"],
      20,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        actionPlanId: planRow.store_action_plan_id,
        storeName: "Marmara Park",
        ownerDisplayName: "Mert Alcan",
      }),
    ]);
  });

  it("lists region-scoped checklist remediation plans for informational workflow inbox reads", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({
      rows: [
        {
          ...planRow,
          source_type: "checklist_remediation",
          status: "closed",
        },
      ],
    });

    const result = await repository.listWorkflowInboxPlans({
      regionIds: [planRow.region_id],
      statuses: ["open", "in_progress", "blocked", "closed"],
      sourceTypes: ["checklist_remediation"],
      limit: 20,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("p.region_id = ANY($1::uuid[])");
    expect(sql).toContain("p.status = ANY($2::text[])");
    expect(sql).toContain("p.source_type = ANY($3::text[])");
    expect(sql).toContain("ORDER BY p.due_on ASC, p.updated_at DESC");
    expect(query.mock.calls[0][1]).toEqual([
      [planRow.region_id],
      ["open", "in_progress", "blocked", "closed"],
      ["checklist_remediation"],
      20,
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        actionPlanId: planRow.store_action_plan_id,
        sourceType: "checklist_remediation",
        status: "closed",
      }),
    ]);
  });

  it("updates non-terminal status and records audit metadata", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({
      rows: [
        {
          ...planRow,
          status: "blocked",
          updated_at: "2026-05-22T09:00:00.000Z",
        },
      ],
    }).mockResolvedValueOnce({ rows: [] });

    await repository.updateStatus({
      actionPlanId: planRow.store_action_plan_id,
      actorUserId: planRow.owner_user_id,
      expectedStatus: "open",
      status: "blocked",
      note: "Waiting for stock confirmation",
    });

    expect(String(query.mock.calls[0][0])).toContain("UPDATE ops.store_action_plan");
    expect(String(query.mock.calls[0][0])).toContain("status = $2");
    expect(String(query.mock.calls[0][0])).toContain("AND status = $3");
    expect(query.mock.calls[0][1]).toEqual([
      planRow.store_action_plan_id,
      "blocked",
      "open",
    ]);
    expect(query.mock.calls[1][1][1]).toBe("store_action_plan.status_updated");
    expect(JSON.parse(query.mock.calls[1][1][6] as string)).toMatchObject({
      actorUserId: planRow.owner_user_id,
      status: "blocked",
      note: "Waiting for stock confirmation",
    });
  });

  it("closes a plan with resolution evidence and records a close audit event", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({
      rows: [
        {
          ...planRow,
          status: "closed",
          resolution_note: "Called the team and corrected the display plan",
          closed_by_user_id: planRow.owner_user_id,
          closed_at: "2026-05-22T09:00:00.000Z",
          updated_at: "2026-05-22T09:00:00.000Z",
        },
      ],
    }).mockResolvedValueOnce({ rows: [] });

    await repository.closePlan({
      actionPlanId: planRow.store_action_plan_id,
      actorUserId: planRow.owner_user_id,
      expectedStatus: "open",
      resolutionNote: "Called the team and corrected the display plan",
    });

    const updateSql = String(query.mock.calls[0][0]);
    expect(updateSql).toContain("resolution_note = $2");
    expect(updateSql).toContain("closed_by_user_id = $3");
    expect(updateSql).toContain("closed_at = now()");
    expect(updateSql).toContain("AND status = $4");
    expect(query.mock.calls[1][1][1]).toBe("store_action_plan.closed");
  });

  it("cancels a plan with cancel evidence and records a cancel audit event", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({
      rows: [
        {
          ...planRow,
          status: "cancelled",
          cancel_reason: "Duplicate field coaching item",
          cancelled_by_user_id: planRow.owner_user_id,
          cancelled_at: "2026-05-22T09:00:00.000Z",
          updated_at: "2026-05-22T09:00:00.000Z",
        },
      ],
    }).mockResolvedValueOnce({ rows: [] });

    await repository.cancelPlan({
      actionPlanId: planRow.store_action_plan_id,
      actorUserId: planRow.owner_user_id,
      expectedStatus: "open",
      cancelReason: "Duplicate field coaching item",
    });

    const updateSql = String(query.mock.calls[0][0]);
    expect(updateSql).toContain("cancel_reason = $2");
    expect(updateSql).toContain("cancelled_by_user_id = $3");
    expect(updateSql).toContain("cancelled_at = now()");
    expect(updateSql).toContain("AND status = $4");
    expect(query.mock.calls[1][1][1]).toBe("store_action_plan.cancelled");
  });

  it("raises a transition conflict and skips audit when the expected state no longer matches", async () => {
    const { query, repository } = createTransactionHarness();
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.updateStatus({
        actionPlanId: planRow.store_action_plan_id,
        actorUserId: planRow.owner_user_id,
        expectedStatus: "open",
        status: "blocked",
        note: "Waiting for stock confirmation",
      }),
    ).rejects.toBeInstanceOf(StoreActionPlanTransitionConflictError);

    expect(query).toHaveBeenCalledTimes(1);
  });
});
