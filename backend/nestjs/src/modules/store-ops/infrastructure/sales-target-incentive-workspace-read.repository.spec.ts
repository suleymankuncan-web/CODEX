import { SalesTargetIncentiveWorkspaceReadRepository } from "./sales-target-incentive-workspace-read.repository";

describe("SalesTargetIncentiveWorkspaceReadRepository", () => {
  it("keeps store metadata bounded to the already-authorized store ids", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await repository.listStoreMetadata({
      storeIds: ["00000000-0000-4000-8000-000000000201"],
      periodEnd: "2026-05-31",
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("store.store_id = ANY($1::uuid[])");
    expect(String(sql)).toContain("role.role_code = 'REGION_MANAGER'");
    expect(String(sql)).toContain("INNER JOIN ops.user_action_store_assignment manager_store");
    expect(String(sql)).toContain("manager_store.store_id = store.store_id");
    expect(String(sql)).toContain("user_account.is_active = TRUE");
    expect(String(sql)).not.toContain("role_assignment.region_id = store.region_id");
    expect(String(sql)).toContain("AT TIME ZONE 'Europe/Istanbul'");
    expect(String(sql)).toContain("INTERVAL '1 microsecond'");
    expect(params).toEqual([
      ["00000000-0000-4000-8000-000000000201"],
      "2026-05-31",
    ]);
  });

  it("reads immutable closed-period rate snapshots through the authorized stores", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await repository.listClosedRateSnapshots({
      periodKey: "2026-05",
      storeIds: ["00000000-0000-4000-8000-000000000201"],
    });

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("WITH scoped_store AS");
    expect(String(sql)).toContain("rpt.sales_target_incentive_rule_snapshot");
    expect(String(sql)).toContain("snapshot.company_id = scoped_store.company_id");
    expect(String(sql)).not.toContain("snapshot.region_id = scoped_store.region_id");
    expect(String(sql)).not.toContain("ops.sales_target_incentive_rule_version");
    expect(String(sql)).not.toContain("rule.effective_from");
    expect(params).toEqual([
      "2026-05",
      ["00000000-0000-4000-8000-000000000201"],
    ]);
  });

  it("loads open-period brackets only by the exact emitted rule and table versions", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await repository.listExactRateTables({
      ruleVersionCode: "sales-target-incentive-v1.0.0",
      rateTableVersions: ["manager-sales-target-v1.0.0", "personnel-sales-target-v1.0.0"],
      periodEnd: "2026-05-31",
    });

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("rule.rule_version_code = $1");
    expect(String(sql)).toContain("bracket.rate_table_version = ANY($2::text[])");
    expect(String(sql)).toContain("rule.effective_from <= $3::date");
    expect(String(sql)).not.toContain("status = 'active'");
    expect(params).toEqual([
      "sales-target-incentive-v1.0.0",
      ["manager-sales-target-v1.0.0", "personnel-sales-target-v1.0.0"],
      "2026-05-31",
    ]);
  });

  it("includes every correction audit status and scopes workflow rows by company and store", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await repository.listWorkflowAudit({
      periodKey: "2026-05",
      storeIds: ["00000000-0000-4000-8000-000000000201"],
    });

    expect(query).toHaveBeenCalledTimes(3);
    const correctionSql = String(query.mock.calls[1][0]);
    expect(correctionSql).toContain("correction.company_id = scoped_store.company_id");
    expect(correctionSql).not.toContain("correction.region_id = scoped_store.region_id");
    expect(correctionSql).toContain("correction.store_id = scoped_store.store_id");
    expect(correctionSql).not.toContain("correction_status <>");
    expect(correctionSql).not.toContain("correction_status !=");
    const packageSql = String(query.mock.calls[2][0]);
    expect(packageSql).toContain("ARRAY_AGG(DISTINCT package_store.store_id::text) AS store_ids");
    expect(packageSql).not.toContain("package_store.region_id = scoped_store.region_id");
  });

  it("looks up correction actors at the event timestamp without selecting username or email", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await repository.listCorrectionActors({
      events: [{
        correctionId: "00000000-0000-4000-8000-000000000951",
        actorUserId: "00000000-0000-4000-8000-000000000901",
        occurredAt: "2026-05-20T10:00:00.000Z",
      }],
    });

    const [sql] = query.mock.calls[0];
    const normalizedSql = String(sql).toLowerCase();
    expect(normalizedSql).toContain("unnest");
    expect(normalizedSql).toContain("role_assignment.start_at <= requested.occurred_at");
    expect(normalizedSql).not.toContain("username");
    expect(normalizedSql).not.toContain("email");
  });

  it("does not query metadata or actors for empty inputs", async () => {
    const query = jest.fn();
    const repository = new SalesTargetIncentiveWorkspaceReadRepository({ query } as never);

    await expect(repository.listStoreMetadata({ storeIds: [], periodEnd: "2026-05-31" })).resolves.toEqual([]);
    await expect(repository.listCorrectionActors({ events: [] })).resolves.toEqual([]);
    await expect(repository.listClosedRateSnapshots({ periodKey: "2026-05", storeIds: [] })).resolves.toEqual([]);
    await expect(repository.listWorkflowAudit({ periodKey: "2026-05", storeIds: [] })).resolves.toEqual({ reviews: [], corrections: [], packages: [] });
    expect(query).not.toHaveBeenCalled();
  });
});
