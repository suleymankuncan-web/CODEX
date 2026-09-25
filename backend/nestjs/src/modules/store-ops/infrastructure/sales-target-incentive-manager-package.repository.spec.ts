import { ConflictException } from "@nestjs/common";
import { SalesTargetIncentiveManagerPackageRepository } from "./sales-target-incentive-manager-package.repository";

const companyId = "00000000-0000-4000-8000-000000000001";
const managerId = "00000000-0000-4000-8000-000000000002";
const storeId = "00000000-0000-4000-8000-000000000003";
const packageId = "00000000-0000-4000-8000-000000000004";
const approverId = "00000000-0000-4000-8000-000000000005";

function repositoryWithQuery(query: jest.Mock) {
  const client = { query };
  const database = { withTransaction: jest.fn(async (run: (dbClient: { query: jest.Mock }) => Promise<unknown>) => run(client)) };
  return new SalesTargetIncentiveManagerPackageRepository(database as never);
}

describe("SalesTargetIncentiveManagerPackageRepository", () => {
  it("refuses submission when two active managers claim the same store", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT store.store_id::text AS store_id")) return { rows: [{ store_id: storeId }] };
      if (sql.includes("HAVING COUNT(DISTINCT account.user_id) > 1")) return { rows: [{ store_id: storeId }] };
      return { rows: [] };
    });
    const repository = repositoryWithQuery(query);

    await expect(repository.submit({
      companyId, periodKey: "2026-09", managerUserId: managerId,
      storeIds: [storeId], submissionNote: null,
    })).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO ops.sales_target_incentive_region_package"))).toBe(false);
  });

  it("blocks final approval after a manager's store assignment changes", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM ops.sales_target_incentive_region_package")) return { rows: [{
        company_id: companyId, manager_user_id: managerId,
        submitted_by_user_id: managerId, submitted_at: "2026-09-30T10:00:00.000Z",
        package_scope: "manager_assignment", package_status: "submitted",
      }] };
      if (sql.includes("Prim approval permission") || sql.includes("SELECT role_assignment.user_role_assignment_id")) return { rows: [{ user_role_assignment_id: "grant" }] };
      if (sql.includes("WITH package_stores AS")) return { rows: [{ stale: true }] };
      throw new Error(`Unexpected write or query: ${sql.slice(0, 80)}`);
    });
    const repository = repositoryWithQuery(query);

    await expect(repository.review({
      periodKey: "2026-09", packageId, submittedAt: "2026-09-30T10:00:00.000Z",
      actorUserId: approverId, companyIds: [companyId], decision: "admin_approved", reviewNote: null,
    })).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE ops.sales_target_incentive_region_package"))).toBe(false);
  });
});
