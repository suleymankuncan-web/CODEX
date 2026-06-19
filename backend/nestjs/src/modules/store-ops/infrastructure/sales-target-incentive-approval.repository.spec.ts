import {
  SalesTargetIncentiveApprovalRepository,
  type SalesTargetIncentiveApprovalStore,
} from "./sales-target-incentive-approval.repository";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const secondStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";
const actorUserId = "00000000-0000-4000-8000-000000000901";
const finalRowId = "00000000-0000-4000-8000-000000000701";
const packageId = "00000000-0000-4000-8000-000000000801";

const store: SalesTargetIncentiveApprovalStore = {
  companyId,
  regionId,
  storeId,
};

function createHarness() {
  const query = jest.fn();
  const withTransaction = jest.fn(async (callback) => callback({ query }));
  const databaseService = { query, withTransaction };
  const repository = new SalesTargetIncentiveApprovalRepository(
    databaseService as never,
  );

  return { query, withTransaction, repository };
}

describe("SalesTargetIncentiveApprovalRepository", () => {
  it("marks a store as reviewed under a store-period advisory lock", async () => {
    const { query, repository, withTransaction } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_store_review_id:
              "00000000-0000-4000-8000-000000000601",
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            period_key: "2026-05",
            review_status: "reviewed",
            reviewed_by_user_id: actorUserId,
            reviewed_at: "2026-06-01T09:00:00.000Z",
            updated_at: "2026-06-01T09:00:00.000Z",
          },
        ],
      });

    const result = await repository.markStoreReview({
      periodKey: "2026-05",
      store,
      actorUserId,
      reviewStatus: "reviewed",
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[0][1][0]).toContain(
      `sales-target-incentive-store-review:2026-05:${storeId}`,
    );
    expect(String(query.mock.calls[1][0])).toContain(
      "package_status IN ('submitted', 'admin_approved')",
    );
    expect(String(query.mock.calls[2][0])).toContain(
      "INSERT INTO ops.sales_target_incentive_store_review",
    );
    expect(String(query.mock.calls[2][0])).toContain(
      "ON CONFLICT (store_id, period_key) DO UPDATE",
    );
    expect(query.mock.calls[2][1]).toEqual(
      expect.arrayContaining([companyId, regionId, storeId, "2026-05", actorUserId]),
    );
    expect(result.review_status).toBe("reviewed");
  });

  it("keeps region manager draft corrections outside payable adjustments", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            final_row_id: finalRowId,
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            store_name: "Nisantasi",
            employee_id: employeeId,
            user_id: null,
            participant_type: "personnel",
            position_code: "SALES_ASSOCIATE",
            target_amount: "100000.0000",
            actual_sales_amount: "120000.0000",
            achievement_pct: "120.000000",
            applied_rate: "0.0165",
            payable_amount: "1980.00",
            final_amount: "1980.00",
            approved_adjustment_amount: "0.00",
            current_amount: "1980.00",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_correction_id:
              "00000000-0000-4000-8000-000000000611",
            region_package_id: null,
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            employee_id: employeeId,
            participant_type: "personnel",
            final_row_id: finalRowId,
            period_key: "2026-05",
            before_amount: "1980.00",
            final_amount: "2100.25",
            adjustment_amount: "120.25",
            reason_note: "BM kontrol duzeltmesi",
            correction_status: "draft",
            created_by_user_id: actorUserId,
            submitted_by_user_id: null,
            submitted_at: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            review_note: null,
            approved_adjustment_id: null,
            updated_at: "2026-06-01T09:00:00.000Z",
          },
        ],
      });

    const result = await repository.createOrReplaceDraftCorrection({
      periodKey: "2026-05",
      store,
      employeeId,
      participantType: "personnel",
      finalAmount: "2100.25",
      reasonNote: "BM kontrol duzeltmesi",
      actorUserId,
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("rpt.sales_target_incentive_final_row");
    expect(sql).toContain("WITH latest_final_snapshot");
    expect(sql).toContain("snapshot.close_cutoff_at DESC");
    expect(sql).toContain("INSERT INTO ops.sales_target_incentive_region_correction");
    expect(sql).not.toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(query.mock.calls[3][1]).toEqual(
      expect.arrayContaining([finalRowId, "2026-05", "1980.00", "2100.25"]),
    );
    expect(result.correction_status).toBe("draft");
  });

  it("lists closed final targets from the latest close snapshot per store period", async () => {
    const { query, repository } = createHarness();
    query.mockResolvedValueOnce({ rows: [] });

    await repository.listClosedFinalSnapshotTargets({
      periodKey: "2026-05",
      storeIds: [storeId, secondStoreId],
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("WITH latest_final_snapshot");
    expect(sql).toContain("SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)");
    expect(sql).toContain("snapshot.close_cutoff_at DESC");
    expect(sql).toContain(
      "latest_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id",
    );
  });

  it("submits a package with a submitted store-set snapshot and submitted corrections", async () => {
    const { query, repository, withTransaction } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ closed_store_count: "2" }] })
      .mockResolvedValueOnce({ rows: [{ reviewed_store_count: "2" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_package_id: packageId,
            company_id: companyId,
            region_id: regionId,
            period_key: "2026-05",
            package_status: "submitted",
            submitted_by_user_id: actorUserId,
            submitted_at: "2026-06-01T09:00:00.000Z",
            submission_note: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            review_note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.submitRegionPackage({
      companyId,
      regionId,
      periodKey: "2026-05",
      storeIds: [storeId, secondStoreId],
      actorUserId,
      submissionNote: null,
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(sql).toContain("rpt.sales_target_incentive_final_snapshot");
    expect(sql).toContain("review_status = 'reviewed'");
    expect(sql).toContain("INSERT INTO ops.sales_target_incentive_region_package");
    expect(sql).toContain("DELETE FROM ops.sales_target_incentive_region_package_store");
    expect(sql).toContain("INSERT INTO ops.sales_target_incentive_region_package_store");
    expect(sql).toContain("correction_status = 'submitted'");
    expect(sql).not.toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(result.package_status).toBe("submitted");
  });

  it("converts submitted corrections into approved payable adjustments only on admin approve", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_package_id: packageId,
            company_id: companyId,
            region_id: regionId,
            period_key: "2026-05",
            package_status: "submitted",
            submitted_by_user_id: actorUserId,
            submitted_at: "2026-06-01T09:00:00.000Z",
            submission_note: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            review_note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_package_id: packageId,
            company_id: companyId,
            region_id: regionId,
            period_key: "2026-05",
            package_status: "admin_approved",
            submitted_by_user_id: actorUserId,
            submitted_at: "2026-06-01T09:00:00.000Z",
            submission_note: null,
            reviewed_by_user_id: actorUserId,
            reviewed_at: "2026-06-01T10:00:00.000Z",
            review_note: null,
          },
        ],
      });

    const result = await repository.reviewRegionPackage({
      periodKey: "2026-05",
      regionId,
      actorUserId,
      packageStatus: "admin_approved",
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(sql).toContain("'region_manager_package'");
    expect(sql).toContain("correction_status = 'admin_approved'");
    expect(sql).toContain("UPDATE ops.sales_target_incentive_region_package");
    expect(result.package_status).toBe("admin_approved");
  });

  it("returns a package without creating payable adjustments", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_package_id: packageId,
            company_id: companyId,
            region_id: regionId,
            period_key: "2026-05",
            package_status: "submitted",
            submitted_by_user_id: actorUserId,
            submitted_at: "2026-06-01T09:00:00.000Z",
            submission_note: null,
            reviewed_by_user_id: null,
            reviewed_at: null,
            review_note: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            sales_target_incentive_region_package_id: packageId,
            company_id: companyId,
            region_id: regionId,
            period_key: "2026-05",
            package_status: "admin_returned",
            submitted_by_user_id: actorUserId,
            submitted_at: "2026-06-01T09:00:00.000Z",
            submission_note: null,
            reviewed_by_user_id: actorUserId,
            reviewed_at: "2026-06-01T10:00:00.000Z",
            review_note: "Not tekrar kontrol edilecek",
          },
        ],
      });

    const result = await repository.reviewRegionPackage({
      periodKey: "2026-05",
      regionId,
      actorUserId,
      packageStatus: "admin_returned",
      reviewNote: "Not tekrar kontrol edilecek",
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("correction_status = 'admin_returned'");
    expect(sql).not.toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(result.package_status).toBe("admin_returned");
  });
});
