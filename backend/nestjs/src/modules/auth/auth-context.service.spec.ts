import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { AuthContextService } from "./auth-context.service";

describe("AuthContextService", () => {
  it("uses active DB role assignments as the canonical role and scope source when available", async () => {
    const service = new AuthContextService(
      { authMode: "mock" } as never,
      {
        getActiveRoleAssignments: jest.fn(async () => [
          {
            role_code: "INTEGRATION_ADMIN",
            scope_type: "company",
            company_id: "company-1",
            region_id: null,
            store_id: null,
          },
          {
            role_code: "REPORT_VIEWER",
            scope_type: "region",
            company_id: "company-1",
            region_id: "region-1",
            store_id: null,
          },
        ]),
      } as never as AuthAuthorizationRepository,
      {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["SUPER_ADMIN"],
          scope: {
            companyIds: ["fallback-company"],
            regionIds: [],
            storeIds: [],
          },
        })),
      } as never,
      { resolveUser: jest.fn() } as never,
    );

    const user = await service.resolveUser({
      headers: {
        "x-user-id": "user-1",
      },
    });

    expect(user).toEqual({
      userId: "user-1",
      roleCodes: ["INTEGRATION_ADMIN", "REPORT_VIEWER"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: [],
      },
    });
  });

  it("falls back to provider roles and scopes when no DB role assignments exist", async () => {
    const service = new AuthContextService(
      { authMode: "mock" } as never,
      {
        getActiveRoleAssignments: jest.fn(async () => []),
      } as never as AuthAuthorizationRepository,
      {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["SUPER_ADMIN"],
          scope: {
            companyIds: ["company-1"],
            regionIds: [],
            storeIds: [],
          },
        })),
      } as never,
      { resolveUser: jest.fn() } as never,
    );

    const user = await service.resolveUser({
      headers: {
        "x-user-id": "user-1",
      },
    });

    expect(user).toEqual({
      userId: "user-1",
      roleCodes: ["SUPER_ADMIN"],
      scope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
    });
  });
});
