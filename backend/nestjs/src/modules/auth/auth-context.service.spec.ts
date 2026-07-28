import { Logger } from "@nestjs/common";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { AuthContextService } from "./auth-context.service";
import { muteNestLogger } from "../../../test/jest/mute-nest-logger";

describe("AuthContextService", () => {
  function buildAuthorizationRepository(input: {
    roleAssignments?: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveRoleAssignments"]>
    >;
    actionStoreAssignments?: Array<{ store_id: string; store_type?: string | null }>;
    mappedProviderUser?: {
      user_id: string;
      employee_id: string | null;
      display_name?: string | null;
      username: string;
      email: string;
      is_active: boolean;
    } | null;
    roleAssignmentErrorMessage?: string;
    accountStatusErrorMessage?: string;
    throwOnAccountStatus?: boolean;
    throwOnRoleAssignments?: boolean;
  } = {}) {
    return {
      getUserAccountStatusById: jest.fn(async () => {
        if (input.throwOnAccountStatus) {
          throw new Error(
            input.accountStatusErrorMessage ??
              "connect ECONNREFUSED 127.0.0.1:5432",
          );
        }

        return { is_active: true };
      }),
      getUserAccountByProviderSubject: jest.fn(
        async () => input.mappedProviderUser ?? null,
      ),
      getActiveRoleAssignments: jest.fn(async () => {
        if (input.throwOnRoleAssignments) {
          throw new Error(
            input.roleAssignmentErrorMessage ?? "connect ECONNREFUSED 127.0.0.1:5432",
          );
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
      roleScopes: {
        INTEGRATION_ADMIN: {
          companyIds: ["company-1"],
          regionIds: [],
          storeIds: [],
        },
        REPORT_VIEWER: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: [],
        },
      },
      actionScope: {
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("partitions explicit permissions by the active role assignment scope", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [{
          role_code: "VM_REFERENCE_PUBLISHER",
          role_scope_type: "company",
          scope_type: "company",
          company_id: "company-1",
          region_id: null,
          store_id: null,
          permission_codes: ["VM_REFERENCE_PUBLISHER"],
        }],
      }),
      { resolveUser: jest.fn(async () => ({ userId: "user-1", roleCodes: [], scope: {} })) } as never,
      { resolveUser: jest.fn() } as never,
    );

    const user = await service.resolveUser({ headers: { "x-user-id": "user-1" } });

    expect(user?.permissionScopes).toEqual({
      VM_REFERENCE_PUBLISHER: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
    });
  });

  it("does not escalate store-scoped permissions into company scope", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [{
          role_code: "VISUAL_MERCHANDISER", scope_type: "store",
          role_scope_type: "store",
          company_id: "company-1", region_id: "region-1", store_id: "store-1",
          permission_codes: ["VM_REFERENCE_PUBLISHER"],
        }],
      }),
      { resolveUser: jest.fn(async () => ({ userId: "user-1", roleCodes: [], scope: {} })) } as never,
      { resolveUser: jest.fn() } as never,
    );
    const user = await service.resolveUser({ headers: { "x-user-id": "user-1" } });
    expect(user?.permissionScopes?.VM_REFERENCE_PUBLISHER).toEqual({
      companyIds: [], regionIds: [], storeIds: ["store-1"],
    });
  });

  it("ignores explicit permission grants on malformed role/assignment scope pairs", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({ roleAssignments: [{
        role_code: "VM_REFERENCE_PUBLISHER", role_scope_type: "company", scope_type: "store",
        company_id: "company-1", region_id: "region-1", store_id: "store-1",
        permission_codes: ["VM_REFERENCE_PUBLISHER"],
      }] }),
      { resolveUser: jest.fn(async () => ({ userId: "user-1", roleCodes: [], scope: {} })) } as never,
      { resolveUser: jest.fn() } as never,
    );
    const user = await service.resolveUser({ headers: { "x-user-id": "user-1" } });
    expect(user?.permissionScopes).toBeUndefined();
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
      roleScopes: {
        REGION_MANAGER: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: [],
        },
        STORE_MANAGER: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: ["store-1"],
        },
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
      roleScopes: {
        REGION_MANAGER: {
          companyIds: ["company-1"],
          regionIds: ["region-1"],
          storeIds: [],
        },
      },
      actionScope: {
        assignedStoreIds: ["store-1", "store-2"],
      },
      assignedStoreIds: ["store-1", "store-2"],
    });
  });

  it("exposes assigned store types for shell-level company store eligibility", async () => {
    const service = new AuthContextService(
      { authMode: "mock", allowMockAuth: true } as never,
      buildAuthorizationRepository({
        roleAssignments: [
          {
            role_code: "STORE_MANAGER",
            scope_type: "store",
            company_id: "company-1",
            region_id: "region-1",
            store_id: "store-1",
            store_type: "company",
          },
        ],
        actionStoreAssignments: [
          { store_id: "store-1", store_type: "company" },
          { store_id: "store-2", store_type: "franchise" },
        ],
      }),
      {
        resolveUser: jest.fn(async () => ({
          userId: "user-1",
          roleCodes: ["STORE_MANAGER"],
          readScope: {
            companyIds: [],
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

    expect(user?.actionScope.assignedStoreTypes).toEqual(["company", "franchise"]);
    expect(user?.assignedStoreTypes).toEqual(["company", "franchise"]);
  });

  it("maps JWT subject to internal user account before DB role lookup", async () => {
    const repository = buildAuthorizationRepository({
      mappedProviderUser: {
        user_id: "90000000-0000-4000-8000-000000000010",
        employee_id: "70000000-0000-4000-8000-000000000010",
        display_name: "Mert Kaya",
        username: "store.manager",
        email: "store.manager@example.com",
        is_active: true,
      },
      roleAssignments: [
        {
          role_code: "STORE_MANAGER",
          scope_type: "store",
          company_id: null,
          region_id: null,
          store_id: "10000000-0000-4000-8000-000000000021",
        },
      ],
      actionStoreAssignments: [
        { store_id: "10000000-0000-4000-8000-000000000021" },
      ],
    });

    const service = new AuthContextService(
      { authMode: "jwt", allowMockAuth: false, isProduction: false } as never,
      repository,
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
          roleCodes: [],
          readScope: { companyIds: [], regionIds: [], storeIds: [] },
          actionScope: { assignedStoreIds: [] },
        })),
      } as never,
    );

    const user = await service.resolveUser({
      headers: { authorization: "Bearer token" },
    });

    expect(repository.getUserAccountByProviderSubject).toHaveBeenCalledWith({
      authProvider: "oidc",
      providerSubject: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
    });
    expect(repository.getActiveRoleAssignments).toHaveBeenCalledWith(
      "90000000-0000-4000-8000-000000000010",
    );
    expect(user?.userId).toBe("90000000-0000-4000-8000-000000000010");
    expect(user?.employeeId).toBe("70000000-0000-4000-8000-000000000010");
    expect(user?.displayName).toBe("Mert Kaya");
    expect(user?.username).toBe("store.manager");
    expect(user?.email).toBe("store.manager@example.com");
    expect(user?.roleCodes).toEqual(["STORE_MANAGER"]);
  });

  it("uses configured auth provider key when mapping Clerk JWT subjects", async () => {
    const repository = buildAuthorizationRepository({
      mappedProviderUser: {
        user_id: "90000000-0000-4000-8000-000000000011",
        employee_id: "70000000-0000-4000-8000-000000000011",
        username: "hr.admin",
        email: "hr.admin@example.com",
        is_active: true,
      },
      roleAssignments: [
        {
          role_code: "HR_ADMIN",
          scope_type: "company",
          company_id: "00000000-0000-0000-0000-000000000001",
          region_id: null,
          store_id: null,
        },
      ],
    });

    const service = new AuthContextService(
      {
        authMode: "jwt",
        authProviderKey: "clerk",
        allowMockAuth: false,
        isProduction: false,
      } as never,
      repository,
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "user_31clerkSubject",
          roleCodes: [],
          readScope: { companyIds: [], regionIds: [], storeIds: [] },
          actionScope: { assignedStoreIds: [] },
        })),
      } as never,
    );

    const user = await service.resolveUser({
      headers: { authorization: "Bearer clerk-token" },
    });

    expect(repository.getUserAccountByProviderSubject).toHaveBeenCalledWith({
      authProvider: "clerk",
      providerSubject: "user_31clerkSubject",
    });
    expect(repository.getActiveRoleAssignments).toHaveBeenCalledWith(
      "90000000-0000-4000-8000-000000000011",
    );
    expect(user?.userId).toBe("90000000-0000-4000-8000-000000000011");
    expect(user?.employeeId).toBe("70000000-0000-4000-8000-000000000011");
    expect(user?.roleCodes).toEqual(["HR_ADMIN"]);
  });

  it("rejects inactive mapped JWT user accounts without provider fallback", async () => {
    const service = new AuthContextService(
      { authMode: "jwt", allowMockAuth: false, isProduction: false } as never,
      buildAuthorizationRepository({
        mappedProviderUser: {
          user_id: "90000000-0000-4000-8000-000000000010",
          employee_id: "70000000-0000-4000-8000-000000000010",
          username: "store.manager",
          email: "store.manager@example.com",
          is_active: false,
        },
      }),
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22",
          roleCodes: ["STORE_MANAGER"],
          readScope: {
            companyIds: [],
            regionIds: [],
            storeIds: ["10000000-0000-4000-8000-000000000021"],
          },
          actionScope: {
            assignedStoreIds: ["10000000-0000-4000-8000-000000000021"],
          },
        })),
      } as never,
    );

    await expect(
      service.resolveUser({
        headers: { authorization: "Bearer token" },
      }),
    ).rejects.toThrow("User account is inactive");
  });

  it("requires a mapped app user account for production JWT sessions", async () => {
    const service = new AuthContextService(
      {
        authMode: "jwt",
        authProviderKey: "clerk",
        allowMockAuth: false,
        isProduction: true,
      } as never,
      buildAuthorizationRepository({ mappedProviderUser: null }),
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "user_unmappedClerkSubject",
          roleCodes: ["INTEGRATION_ADMIN"],
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
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
        headers: { authorization: "Bearer token" },
      }),
    ).rejects.toThrow("User account is not mapped");
  });

  it("requires active DB role assignments for production JWT sessions", async () => {
    const service = new AuthContextService(
      {
        authMode: "jwt",
        authProviderKey: "clerk",
        allowMockAuth: false,
        isProduction: true,
      } as never,
      buildAuthorizationRepository({
        mappedProviderUser: {
          user_id: "90000000-0000-4000-8000-000000000012",
          employee_id: "70000000-0000-4000-8000-000000000012",
          username: "integration.admin",
          email: "integration.admin@example.com",
          is_active: true,
        },
      }),
      { resolveUser: jest.fn() } as never,
      {
        resolveUser: jest.fn(async () => ({
          userId: "user_claimOnly",
          roleCodes: ["INTEGRATION_ADMIN"],
          readScope: {
            companyIds: ["00000000-0000-0000-0000-000000000001"],
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
        headers: { authorization: "Bearer token" },
      }),
    ).rejects.toThrow("User account has no active role assignments");
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
    const restoreLogger = muteNestLogger(["warn"]);
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

    try {
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
    } finally {
      restoreLogger();
    }
  });

  it("fails closed in production when DB authorization lookup throws", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const service = new AuthContextService(
      { authMode: "jwt", allowMockAuth: false, isProduction: true } as never,
      buildAuthorizationRepository({
        mappedProviderUser: {
          user_id: "90000000-0000-4000-8000-000000000013",
          employee_id: null,
          username: "prod.user",
          email: "prod.user@example.com",
          is_active: true,
        },
        roleAssignmentErrorMessage: "db failed token=abc123",
        throwOnRoleAssignments: true,
      }),
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

    try {
      await expect(
        service.resolveUser({
          headers: {
            authorization: "Bearer token",
          },
        }),
      ).rejects.toThrow("Authorization context is unavailable");
      const renderedLogs = errorSpy.mock.calls.flat().map(String).join("\n");
      expect(renderedLogs).toContain("authorization lookup failed for provider user");
      expect(renderedLogs).toContain("token=[redacted]");
      expect(renderedLogs).not.toContain("abc123");
      expect(renderedLogs).not.toContain("prod-user-1");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("fails closed when a production cookie-session account lookup throws", async () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const repository = buildAuthorizationRepository({
      accountStatusErrorMessage: "db failed password=secret-value",
      throwOnAccountStatus: true,
    });
    const jwtAuthProvider = {
      resolveUser: jest.fn(async () => null),
    };
    const service = new AuthContextService(
      {
        authMode: "jwt",
        allowMockAuth: false,
        browserSessionCookieEnabled: true,
        browserSessionCookieName: "hr_axis_browser_session",
        isProduction: true,
      } as never,
      repository,
      { resolveUser: jest.fn() } as never,
      jwtAuthProvider as never,
      {
        verifySession: jest.fn(() => ({
          user: {
            userId: "90000000-0000-4000-8000-000000000099",
            roleCodes: ["REPORT_VIEWER"],
            readScope: {
              companyIds: ["00000000-0000-0000-0000-000000000001"],
              regionIds: [],
              storeIds: [],
            },
            actionScope: { assignedStoreIds: [] },
          },
        })),
      } as never,
    );

    try {
      await expect(
        service.resolveUser({
          headers: { cookie: "hr_axis_browser_session=signed-value" },
        }),
      ).rejects.toThrow("Authorization context is unavailable");
      expect(repository.getUserAccountByProviderSubject).not.toHaveBeenCalled();
      const renderedLogs = errorSpy.mock.calls.flat().map(String).join("\n");
      expect(renderedLogs).toContain("password=[redacted]");
      expect(renderedLogs).not.toContain("secret-value");
    } finally {
      errorSpy.mockRestore();
    }
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
