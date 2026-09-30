import { ConflictException, NotFoundException } from "@nestjs/common";
import { SalesTargetIncentiveApprovalRepository } from "./sales-target-incentive-approval.repository";
const submittedAt = "2026-09-01T12:00:00.000Z";
const row = { sales_target_incentive_region_package_id: "package", company_id: "company", region_id: "region", submitted_by_user_id: "manager", submitted_at: submittedAt };
const input = { periodKey: "2026-09", regionId: "region", actorUserId: "viewer", packageStatus: "admin_approved" as const,
  finalApproval: { companyIds: ["company"], regionPackageId: "package", submittedAt } };
function harness(packageRow: typeof row | null = row) {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: packageRow ? [packageRow] : [] });
  const repo = new SalesTargetIncentiveApprovalRepository({ withTransaction: async (callback: (client: { query: typeof query }) => Promise<unknown>) => callback({ query }) } as never);
  return { query, repo };
}
describe("retired final approval locked transition", () => {
  for (const packageStatus of ["admin_approved", "admin_returned"] as const) {
    it.each([
      ["valid legacy grant", input.finalApproval],
      ["wrong company", { ...input.finalApproval, companyIds: ["other"] }],
      ["stale package", { ...input.finalApproval, regionPackageId: "old" }],
      ["resubmitted version", { ...input.finalApproval, submittedAt: "2026-09-01T11:00:00Z" }],
      ["self submitter", input.finalApproval],
    ])(`cannot ${packageStatus} a pending new-contract package through %s`, async (scenario, proof) => {
      const { repo, query } = harness(scenario === "self submitter" ? { ...row, submitted_by_user_id: "viewer" } : row);
      await expect(repo.reviewRegionPackage({ ...input, packageStatus, finalApproval: proof, reviewNote: "Synthetic return" })).rejects.toThrow(ConflictException);
      expect(query).toHaveBeenCalledTimes(3);
      expect(query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
      expect(query.mock.calls[1][0]).toContain("FOR UPDATE");
      expect(query.mock.calls[1][0]).toContain("package_status = 'submitted'");
      expect(query.mock.calls[2][0]).toContain("ops.incentive_legacy_approval");
      expect(query.mock.calls.some(([sql]) => /\b(UPDATE|INSERT|DELETE)\b/.test(sql.replace("FOR UPDATE", "")))).toBe(false);
    });
    it(`keeps missing and already approved packages immutable for ${packageStatus}`, async () => {
      const { repo, query } = harness(null);
      await expect(repo.reviewRegionPackage({ ...input, packageStatus, reviewNote: "Synthetic return" })).rejects.toThrow(NotFoundException);
      expect(query).toHaveBeenCalledTimes(2);
    });
  }
});
