import { buildAuthenticatedUser } from "../authenticated-user";
import { AuthContextService } from "../auth-context.service";

describe("managed recovery fresh account authority", () => {
  const user = buildAuthenticatedUser({ userId: "80000000-0000-0000-0000-000000000001",
    employeeId: "old-employee", username: "old-name", email: "old-email", roleCodes: ["SUPER_ADMIN"] });
  const setup = () => {
    const account = { is_active: true, employee_id: null, display_name: null, username: "current-name", email: "current-email" };
    const verify = jest.fn(async () => undefined);
    const getUserAccountStatusById = jest.fn(async () => account);
    const repository = { getUserAccountStatusById,
      getActiveRoleAssignments: async () => [{ role_code: "REPORT_VIEWER", scope_type: "company", company_id: "company-one" }],
      getActiveActionStoreAssignments: async () => [] };
    const service = new AuthContextService({ authMode: "jwt", browserSessionCookieEnabled: true,
      browserSessionCookieName: "session", corsAllowedOrigins: ["https://synthetic.invalid"] } as never,
    repository as never, {} as never, { resolveUser: async () => null } as never,
    { verifySession: () => ({ user, envelope: { v: 2 } }) } as never, { verify } as never);
    return { service, verify, getUserAccountStatusById };
  };
  it("uses current profile and roles and clears an unlinked employee instead of retaining signed stale metadata", async () => {
    const { service } = setup();
    const current = await service.resolveUser({ headers: { cookie: "session=signed" } });
    expect(current).toMatchObject({ username: "current-name", email: "current-email", roleCodes: ["REPORT_VIEWER"],
      readScope: { companyIds: ["company-one"] } });
    expect(current).not.toHaveProperty("employeeId");
    expect(current).not.toHaveProperty("displayName");
  });
  it("rejects an untrusted recovery Origin before contacting the provider", async () => {
    const { service, verify, getUserAccountStatusById } = setup();
    await expect(service.resolveUser({ originalUrl: "/api/auth/browser-session/csrf",
      headers: { cookie: "session=signed", origin: "https://evil.invalid" } })).rejects.toThrow("metadata is invalid");
    expect(verify).not.toHaveBeenCalled(); expect(getUserAccountStatusById).not.toHaveBeenCalled();
  });
  it("forces provider validation for an exact-origin recovery even without Fetch Metadata", async () => {
    const { service, verify } = setup();
    await service.resolveUser({ originalUrl: "/api/auth/browser-session/csrf",
      headers: { cookie: "session=signed", origin: "https://synthetic.invalid" } });
    expect(verify).toHaveBeenCalledWith({ v: 2 }, true);
  });
});
