import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { AuthContextService } from "./auth-context.service";

describe("AuthContextService", () => {
  function buildAuthorizationRepository(input: {
    roleAssignments?: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveRoleAssignments"]>
    >;
    actionStoreAssignments?: Array<{ store_id: string }>;
    throwOnRoleAssignments?: boolean;
  } = {}) {
    return {
      getActiveRoleAssignments: jest.fn(async () => {
        if (input.throwOnRoleAssignments) {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        }

        return input.roleAssignments ?? [];
      }),
      getActiveActionStoreAssignments: jest.fn(
        async () => input.actionStoreAssignments ?? [],
      ),
    } as never as AuthAuthorizationRepository;
  }

  it("uses active DB role assignments as the canonical role and scope source when available", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [
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
        ],
      }),
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
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: [],
      },
      actionScope: {
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("keeps DB read scope separate from assigned action stores", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [
          {
            role_code: "REGION_MANAGER",
            scope_type: "region",
            company_id: "company-1",
            region_id: "region-1",
            store_id: null,
          },
          {
            role_code: "STORE_MANAGER",
            scope_type: "store",
            company_id: "company-1",
            region_id: "region-1",
            store_id: "store-1",
          },
        ],
      }),
      {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["REPORT_VIEWER"],
          scope: {
            companyIds: ["fallback-company"],
            regionIds: [],
            storeIds: [],
          },
          readScope: {
            companyIds: ["fallback-company"],
            regionIds: [],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
          assignedStoreIds: [],
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
      roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      actionScope: {
        assignedStoreIds: ["store-1"],
      },
      assignedStoreIds: ["store-1"],
    });
  });

  it("adds persistent action store assignments without narrowing region read scope", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [
          {
            role_code: "REGION_MANAGER",
            scope_type: "region",
            company_id: "company-1",
            region_id: "region-1",
            store_id: null,
          },
        ],
        actionStoreAssignments: [{ store_id: "store-1" }, { store_id: "store-2" }],
      }),
      {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["REPORT_VIEWER"],
          readScope: {
            companyIds: ["fallback-company"],
            regionIds: [],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
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
      roleCodes: ["REGION_MANAGER"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: [],
      },
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: [],
      },
      actionScope: {
        assignedStoreIds: ["store-1", "store-2"],
      },
      assignedStoreIds: ["store-1", "store-2"],
    });
  });

  it("falls back to provider roles and scopes when no DB role assignments exist", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository(),
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
      readScope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
      actionScope: {
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("falls back to provider roles and scopes outside production when DB lookup throws", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({ throwOnRoleAssignments: true }),
      {
        resolveUser: jest.fn(async () => ({
          userId: "4e0cb8bc-8a19-4e1a-b812-3f5ab9d7d111",
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: [],
            regionIds: [],
            storeIds: [],
          },
        })),
      } as never,
      { resolveUser: jest.fn() } as never,
    );

    const user = await service.resolveUser({
      headers: {
        "x-user-id": "4e0cb8bc-8a19-4e1a-b812-3f5ab9d7d111",
      },
    });

    expect(user).toEqual({
      userId: "4e0cb8bc-8a19-4e1a-b812-3f5ab9d7d111",
      roleCodes: ["STORE_MANAGER"],
      scope: {
        companyIds: [],
        regionIds: [],
        storeIds: [],
      },
      readScope: {
        companyIds: [],
        regionIds: [],
        storeIds: [],
      },
      actionScope: {
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("fails closed in production when DB authorization lookup throws", async () => {
    const service = new AuthContextService(
      { authMode: "jwt", allowMockAuth: false, isProduction: true } as never,
      buildAuthorizationRepository({ throwOnRoleAssignments: true }),
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "prod-user-1",
          roleCodes: ["SUPER_ADMIN"],
          readScope: {
            companyIds: ["company-1"],
            regionIds: [],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
        })),
      } as never,
    );

    await expect(
      service.resolveUser({
        headers: {
          authorization: "Bearer token",
        },
      }),
    ).rejects.toThrow("Authorization context is unavailable");
  });

  it("rejects mock auth when it is explicitly disabled", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: false } as never,
      buildAuthorizationRepository(),
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

    await expect(
      service.resolveUser({
        headers: {
          "x-user-id": "user-1",
        },
      }),
    ).rejects.toThrow("Mock auth is disabled");
  });
});
