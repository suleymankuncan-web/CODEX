import { ConflictException } from "@nestjs/common";
import { WorkforceRequestRepository } from "./workforce-request.repository";
import type { EmployeeOffboardingRequestRow } from "./workforce-offboarding-read.repository";

const request = {
  offboarding_request_id: "request-1", employee_id: "employee-1", store_id: "store-1",
  company_id: "company-1", region_id: "region-1", request_status: "pending_hr_approval",
  requested_termination_date: "2026-09-10", termination_reason: "resignation",
  request_revision: "2026-09-09 10:00:00.123456+00",
} as EmployeeOffboardingRequestRow;

function setup(current: Partial<EmployeeOffboardingRequestRow> | null) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FOR UPDATE")) return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
    if (sql.includes("UPDATE ops.employee_offboarding_request")) return { rows: [request], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const access = { deactivateUserAccessInTransaction: jest.fn() };
  const repository = new WorkforceRequestRepository({
    withTransaction: async (work: (client: unknown) => unknown) => work({ query }),
  } as never, access as never);
  return { query, access, repository };
}
function run(repository: WorkforceRequestRepository, action: string, expected = request) {
  const input = { request: expected, actorUserId: "hr-1", reviewNote: "Reviewed" };
  if (action === "approve") return repository.approveOffboardingRequest(input);
  if (action === "reject") return repository.rejectOffboardingRequest(input);
  return repository.resubmitOffboardingRequest({
    ...input, companyId: "company-1", regionId: "region-1", storeId: "store-1",
    employeeId: "employee-1", terminationDate: "2026-09-11", terminationReason: "resignation",
    requestReason: "Corrected date",
  });
}

describe("Offboarding transitions under a row lock", () => {
  it.each([
    ["approve", "approved"], ["approve", "rejected"], ["reject", "approved"],
    ["reject", "rejected"], ["resubmit", "pending_hr_approval"], ["resubmit", "approved"],
  ])("rejects stale %s after %s before any business writes", async (action, status) => {
    const { repository, query, access } = setup({ ...request, request_status: status });
    await expect(run(repository, action)).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(access.deactivateUserAccessInTransaction).not.toHaveBeenCalled();
  });

  it.each(["approve", "reject", "resubmit"])("rejects %s of a new revision even when status matches", async (action) => {
    const expected = { ...request, request_status: action === "resubmit" ? "rejected" : request.request_status };
    const { repository, query } = setup({ ...expected, request_revision: "2026-09-09 10:00:00.123457+00" });
    await expect(run(repository, action, expected)).rejects.toBeInstanceOf(ConflictException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects a deleted request and a snapshot without a revision", async () => {
    await expect(run(setup(null).repository, "approve")).rejects.toBeInstanceOf(ConflictException);
    await expect(run(setup(request).repository, "approve", { ...request, request_revision: undefined }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it.each(["approve", "reject", "resubmit"])("allows a current %s and audits it after locking", async (action) => {
    const expected = { ...request, request_status: action === "resubmit" ? "rejected" : request.request_status };
    const { repository, query } = setup(expected);
    await run(repository, action, expected);
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO audit.event_log"))).toHaveLength(1);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE ops.employee\n"))).toBe(action === "approve");
  });
});
