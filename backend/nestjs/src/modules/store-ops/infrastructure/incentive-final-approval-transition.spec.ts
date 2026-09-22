import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
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
describe("final approval locked transition", () => {
  it.each([
    ["wrong company", { ...input.finalApproval, companyIds: ["other"] }, ForbiddenException],
    ["stale package", { ...input.finalApproval, regionPackageId: "old" }, ConflictException],
    ["resubmitted version", { ...input.finalApproval, submittedAt: "2026-09-01T11:00:00Z" }, ConflictException],
  ])("rejects %s before any writes", async (_name, finalApproval, error) => {
    const { repo, query } = harness();
    await expect(repo.reviewRegionPackage({ ...input, finalApproval })).rejects.toThrow(error);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[1][0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1][0]).toContain("package_status = 'submitted'");
  });
  it("rejects the same person submitting and final approving", async () => {
    const { repo } = harness({ ...row, submitted_by_user_id: "viewer" });
    await expect(repo.reviewRegionPackage(input)).rejects.toThrow(ForbiddenException);
  });
  it("rejects missing, not submitted and already approved packages", async () => {
    const { repo } = harness(null);
    await expect(repo.reviewRegionPackage(input)).rejects.toThrow(NotFoundException);
  });
  it("rejects a grant revoked while waiting for the package lock", async () => {
    const { repo, query } = harness();
    await expect(repo.reviewRegionPackage(input)).rejects.toThrow(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][0]).toContain("FOR SHARE OF ura");
  });
  it("preserves snapshot/correction guards and audits the final approval", async () => {
    const { repo, query } = harness();
    query.mockResolvedValueOnce({ rows: [{ user_role_assignment_id: "grant" }] }).mockResolvedValueOnce({ rows: [{ stale_store_count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ stale_snapshot_count: "0", already_current_count: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, package_status: "admin_approved" }] });
    await expect(repo.reviewRegionPackage(input)).resolves.toMatchObject({ package_status: "admin_approved" });
    expect(query.mock.calls.at(-1)?.[0]).toContain("INSERT INTO audit.event_log");
    expect(query.mock.calls.at(-1)?.[1]?.[5]).toBe("incentive_package.final_approved");
  });
  it("returns the existing package with the note and a distinct audit event", async () => {
    const { repo, query } = harness();
    query.mockResolvedValueOnce({ rows: [{ user_role_assignment_id: "grant" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...row, package_status: "admin_returned", review_note: "Düzeltme gerekli" }] });
    await expect(repo.reviewRegionPackage({ ...input, packageStatus: "admin_returned", reviewNote: "Düzeltme gerekli" })).resolves.toMatchObject({ package_status: "admin_returned" });
    expect(query.mock.calls[3]?.[0]).toContain("correction_status = 'admin_returned'");
    expect(query.mock.calls[3]?.[1]).toEqual(["viewer", "Düzeltme gerekli", "package"]);
    expect(query.mock.calls.at(-1)?.[1]?.[5]).toBe("incentive_package.final_returned");
  });
  it.each([
    ["wrong company", { ...input.finalApproval, companyIds: ["other"] }, ForbiddenException],
    ["stale package", { ...input.finalApproval, regionPackageId: "old" }, ConflictException],
    ["resubmitted version", { ...input.finalApproval, submittedAt: "2026-09-01T11:00:00Z" }, ConflictException],
  ])("return rejects %s before changing corrections", async (_name, finalApproval, error) => {
    const { repo, query } = harness();
    await expect(repo.reviewRegionPackage({ ...input, packageStatus: "admin_returned", reviewNote: "Düzeltme", finalApproval })).rejects.toThrow(error);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("a return also rechecks a revoked approval grant", async () => {
    const { repo, query } = harness();
    await expect(repo.reviewRegionPackage({ ...input, packageStatus: "admin_returned", reviewNote: "Düzeltme" })).rejects.toThrow(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
