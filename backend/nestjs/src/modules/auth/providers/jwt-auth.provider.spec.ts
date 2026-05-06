import { createServer, Server } from "http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { JwtAuthProvider } from "./jwt-auth.provider";

describe("JwtAuthProvider", () => {
  let jwksServer: Server | null = null;

  afterEach(async () => {
    if (jwksServer) {
      await new Promise<void>((resolve, reject) => {
        jwksServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      jwksServer = null;
    }
  });

  it("verifies HS256 tokens with shared secret configuration", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
    } as never);

    const token = await new SignJWT({
      roles: ["REPORT_VIEWER"],
      company_ids: ["company-1"],
      region_ids: ["region-1"],
      store_ids: ["store-1"],
      employee_id: "employee-1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("store-ops-auth")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-1",
      employeeId: "employee-1",
      roleCodes: ["REPORT_VIEWER"],
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
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("parses separate read scope and assigned action stores from JWT claims", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
    } as never);

    const token = await new SignJWT({
      roles: ["REGION_MANAGER"],
      read_company_ids: ["company-1"],
      read_region_ids: ["region-1"],
      read_store_ids: ["store-1", "store-2"],
      assigned_store_ids: ["store-1"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("store-ops-auth")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-1",
      employeeId: undefined,
      roleCodes: ["REGION_MANAGER"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1", "store-2"],
      },
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1", "store-2"],
      },
      actionScope: {
        assignedStoreIds: ["store-1"],
      },
      assignedStoreIds: ["store-1"],
    });
  });

  it("verifies RS256 tokens with JWKS configuration", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwksServer = createServer((request, response) => {
      if (request.url !== "/.well-known/jwks.json") {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          keys: [{ ...jwk, use: "sig", alg: "RS256", kid: "kid-1" }],
        }),
      );
    });

    const address = await new Promise<{ port: number }>((resolve, reject) => {
      jwksServer?.listen(0, "127.0.0.1", () => {
        const serverAddress = jwksServer?.address();
        if (!serverAddress || typeof serverAddress === "string") {
          reject(new Error("failed to bind JWKS server"));
          return;
        }

        resolve({ port: serverAddress.port });
      });
    });

    const provider = new JwtAuthProvider({
      jwtSecret: "unused-secret",
      jwtIssuer: "https://issuer.example.com",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
    } as never);

    const token = await new SignJWT({
      roles: ["SNAPSHOT_OPERATOR"],
      company_ids: "company-2,company-3",
    })
      .setProtectedHeader({ alg: "RS256", kid: "kid-1" })
      .setSubject("user-2")
      .setIssuer("https://issuer.example.com")
      .setAudience("store-ops-api")
      .sign(privateKey);

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-2",
      employeeId: undefined,
      roleCodes: ["SNAPSHOT_OPERATOR"],
      scope: {
        companyIds: ["company-2", "company-3"],
        regionIds: [],
        storeIds: [],
      },
      readScope: {
        companyIds: ["company-2", "company-3"],
        regionIds: [],
        storeIds: [],
      },
      actionScope: {
        assignedStoreIds: [],
      },
      assignedStoreIds: [],
    });
  });

  it("resolves Clerk-style JWKS tokens without inferring HR Axis roles or scopes", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwksServer = createServer((request, response) => {
      if (request.url !== "/.well-known/jwks.json") {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          keys: [{ ...jwk, use: "sig", alg: "RS256", kid: "clerk-kid-1" }],
        }),
      );
    });

    const address = await new Promise<{ port: number }>((resolve, reject) => {
      jwksServer?.listen(0, "127.0.0.1", () => {
        const serverAddress = jwksServer?.address();
        if (!serverAddress || typeof serverAddress === "string") {
          reject(new Error("failed to bind JWKS server"));
          return;
        }

        resolve({ port: serverAddress.port });
      });
    });

    const provider = new JwtAuthProvider({
      jwtSecret: "unused-secret",
      jwtIssuer: "https://clerk.hr-axis.test",
      jwtAudience: "hr-axis-api",
      jwtJwksUrl: `http://127.0.0.1:${address.port}/.well-known/jwks.json`,
      authClientId: undefined,
    } as never);

    const token = await new SignJWT({
      azp: "https://staging.hr-axis.com",
      email: "hr.admin@example.com",
    })
      .setProtectedHeader({ alg: "RS256", kid: "clerk-kid-1" })
      .setSubject("user_31clerkSubject")
      .setIssuer("https://clerk.hr-axis.test")
      .setAudience("hr-axis-api")
      .sign(privateKey);

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user_31clerkSubject",
      employeeId: undefined,
      roleCodes: [],
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

  it("accepts keycloak-style audience and role claims", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "http://localhost:8080/realms/store-ops",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      authClientId: "store-ops-admin-web",
    } as never);

    const token = await new SignJWT({
      realm_access: {
        roles: ["STORE_MANAGER"],
      },
      resource_access: {
        "store-ops-admin-web": {
          roles: ["REPORT_VIEWER"],
        },
      },
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-3")
      .setIssuer("http://localhost:8080/realms/store-ops")
      .setAudience("account")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-3",
      employeeId: undefined,
      roleCodes: ["STORE_MANAGER", "REPORT_VIEWER"],
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

  it("filters provider default roles from keycloak role claims", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "http://localhost:8080/realms/store-ops",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      authClientId: "store-ops-admin-web",
    } as never);

    const token = await new SignJWT({
      roles: [
        "offline_access",
        "STORE_MANAGER",
        "uma_authorization",
        "default-roles-store-ops",
      ],
      realm_access: {
        roles: ["default-roles-store-ops", "STORE_MANAGER"],
      },
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-3")
      .setIssuer("http://localhost:8080/realms/store-ops")
      .setAudience("account")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user?.roleCodes).toEqual(["STORE_MANAGER"]);
  });

  it("uses explicit role and scope claims from local Keycloak tokens", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "http://localhost:8080/realms/store-ops",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      authClientId: "store-ops-admin-web",
    } as never);

    const token = await new SignJWT({
      preferred_username: "admin.operator",
      roles: ["SUPER_ADMIN", "REPORT_VIEWER", "INTEGRATION_ADMIN", "SNAPSHOT_OPERATOR"],
      read_company_ids: ["company-1"],
      read_region_ids: ["region-1"],
      read_store_ids: ["store-1", "store-2"],
      assigned_store_ids: ["store-1"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-local-admin")
      .setIssuer("http://localhost:8080/realms/store-ops")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-local-admin",
      employeeId: undefined,
      roleCodes: ["SUPER_ADMIN", "REPORT_VIEWER", "INTEGRATION_ADMIN", "SNAPSHOT_OPERATOR"],
      scope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1", "store-2"],
      },
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1", "store-2"],
      },
      actionScope: {
        assignedStoreIds: ["store-1"],
      },
      assignedStoreIds: ["store-1"],
    });
  });

  it("does not promote legacy store_ids read scope into action scope", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "http://localhost:8080/realms/store-ops",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      authClientId: "store-ops-admin-web",
    } as never);

    const token = await new SignJWT({
      roles: ["STORE_MANAGER"],
      store_ids: ["store-1"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-local-store-manager")
      .setIssuer("http://localhost:8080/realms/store-ops")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user?.readScope.storeIds).toEqual(["store-1"]);
    expect(user?.actionScope.assignedStoreIds).toEqual([]);
    expect(user?.assignedStoreIds).toEqual([]);
  });

  it("does not infer roles or scopes from local Keycloak demo usernames", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "http://localhost:8080/realms/store-ops",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      authClientId: "store-ops-admin-web",
    } as never);

    const token = await new SignJWT({
      preferred_username: "store.manager",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-local-store-manager")
      .setIssuer("http://localhost:8080/realms/store-ops")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    const user = await provider.resolveUser({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(user).toEqual({
      userId: "user-local-store-manager",
      employeeId: undefined,
      roleCodes: [],
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

  it("rejects production JWTs without an audience claim", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      isProduction: true,
    } as never);

    const token = await new SignJWT({
      roles: ["REPORT_VIEWER"],
      read_company_ids: ["company-1"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("store-ops-auth")
      .sign(new TextEncoder().encode("top-secret"));

    await expect(
      provider.resolveUser({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).rejects.toThrow("Invalid JWT");
  });

  it("rejects production JWTs without a subject claim", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
      isProduction: true,
    } as never);

    const token = await new SignJWT({
      roles: ["REPORT_VIEWER"],
      read_company_ids: ["company-1"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("store-ops-auth")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    await expect(
      provider.resolveUser({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).rejects.toThrow("JWT subject claim is required");
  });

  it("rejects JWT tokens with invalid issuer", async () => {
    const provider = new JwtAuthProvider({
      jwtSecret: "top-secret",
      jwtIssuer: "store-ops-auth",
      jwtAudience: "store-ops-api",
      jwtJwksUrl: undefined,
    } as never);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("another-issuer")
      .setAudience("store-ops-api")
      .sign(new TextEncoder().encode("top-secret"));

    await expect(
      provider.resolveUser({
        headers: {
          authorization: `Bearer ${token}`,
        },
      }),
    ).rejects.toThrow("Invalid JWT");
  });
});
