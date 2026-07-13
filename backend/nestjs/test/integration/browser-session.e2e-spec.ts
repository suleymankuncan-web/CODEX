import * as request from "supertest";
import { SignJWT } from "jose";
import { createIntegrationApp } from "./test-app";

const APP_USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const REGION_ID = "33333333-3333-4333-8333-333333333333";
const STORE_ID = "44444444-4444-4444-8444-444444444444";

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

async function createJwt(subject = "provider-subject-1") {
  return new SignJWT({
    roles: ["REPORT_VIEWER"],
    company_ids: ["provider-company"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer("store-ops-auth")
    .setAudience("store-ops-api")
    .sign(new TextEncoder().encode("jwt-test-secret"));
}

function createDatabaseService(
  accountState: {
    actionStoresActive?: boolean;
    active: boolean;
    exists: boolean;
    roleCodes?: string[];
    roleStoreId?: string | null;
    rolesActive?: boolean;
  } = {
    active: true,
    exists: true,
    rolesActive: true,
  },
) {
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("FROM ops.user_account") && sql.includes("WHERE user_id")) {
      expect(params).toEqual([APP_USER_ID]);
      if (!accountState.exists) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [{ is_active: accountState.active }],
      };
    }

    if (sql.includes("FROM ops.user_account ua") && sql.includes("provider_subject")) {
      if (!accountState.exists) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [
          {
            email: "pilot@example.com",
            employee_id: "employee-1",
            is_active: accountState.active,
            user_id: APP_USER_ID,
            username: "pilot",
          },
        ],
      };
    }

    if (sql.includes("FROM ops.user_account ua") && sql.includes("user_role_assignment")) {
      expect(params).toEqual([APP_USER_ID]);
      if (
        !accountState.active ||
        !accountState.exists ||
        accountState.rolesActive === false
      ) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: accountState.roleCodes?.length ?? 1,
        rows: (accountState.roleCodes ?? ["REPORT_VIEWER"]).map(
          (roleCode) => ({
            company_id: COMPANY_ID,
            region_id: REGION_ID,
            role_code: roleCode,
            scope_type: "store",
            store_id:
              accountState.roleStoreId === undefined
                ? STORE_ID
                : accountState.roleStoreId,
          }),
        ),
      };
    }

    if (
      sql.includes("FROM ops.user_account ua") &&
      sql.includes("user_action_store_assignment")
    ) {
      expect(params).toEqual([APP_USER_ID]);
      if (
        !accountState.active ||
        !accountState.exists ||
        accountState.actionStoresActive === false
      ) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [{ store_id: STORE_ID }],
      };
    }

    return { rowCount: 0, rows: [] };
  });

  return { query };
}

describe("browser session integration", () => {
  const originalEnv = {
    AUTH_MODE: process.env.AUTH_MODE,
    BROWSER_SESSION_COOKIE_ENABLED: process.env.BROWSER_SESSION_COOKIE_ENABLED,
    BROWSER_SESSION_SECRET: process.env.BROWSER_SESSION_SECRET,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_JWKS_URL: process.env.JWT_JWKS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.AUTH_MODE = "jwt";
    process.env.BROWSER_SESSION_COOKIE_ENABLED = "true";
    process.env.BROWSER_SESSION_SECRET = "0123456789abcdef0123456789ABCDEF";
    process.env.JWT_AUDIENCE = "store-ops-api";
    process.env.JWT_ISSUER = "store-ops-auth";
    process.env.JWT_SECRET = "jwt-test-secret";
    delete process.env.JWT_JWKS_URL;
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      restoreEnv(key, value);
    }
  });

  it("creates, reads, protects, and clears browser sessions without changing app scope", async () => {
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const setCookie = createResponse.headers["set-cookie"] as unknown as string[];
      const appCookie = setCookie.find((cookie) =>
        cookie.startsWith("hr_axis_browser_session="),
      );
      const cookieHeader = appCookie?.split(";")[0] ?? "";

      expect(appCookie).toBeDefined();
      expect(appCookie).toContain("HttpOnly");
      expect(appCookie).toContain("SameSite=Lax");
      expect(appCookie).not.toContain("Domain=");
      expect(createResponse.body.csrfToken).toEqual(expect.any(String));
      expect(createResponse.body.session.user).toMatchObject({
        userId: APP_USER_ID,
        employeeId: "employee-1",
        roleCodes: ["REPORT_VIEWER"],
        readScope: {
          companyIds: [COMPANY_ID],
          regionIds: [REGION_ID],
          storeIds: [STORE_ID],
        },
        actionScope: {
          assignedStoreIds: [STORE_ID],
        },
      });

      const sessionResponse = await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", cookieHeader)
        .expect(200);
      expect(sessionResponse.body.user).toMatchObject(createResponse.body.session.user);

      const csrfFailure = await request(app.getHttpServer())
        .post("/api/integrations/import-batches")
        .set("cookie", cookieHeader)
        .send({});
      expect(csrfFailure.status).toBe(403);
      expect(JSON.stringify(csrfFailure.body)).not.toContain(appCookie ?? "signed");

      const clearResponse = await request(app.getHttpServer())
        .delete("/api/auth/browser-session")
        .set("cookie", cookieHeader)
        .expect(200);
      expect(clearResponse.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringContaining("hr_axis_browser_session="),
          expect.stringContaining("hr_axis_csrf_nonce="),
        ]),
      );
    } finally {
      await app.close();
    }
  });

  it("prefers explicit bearer auth when bearer and cookie are both present", async () => {
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(),
    });

    try {
      const firstToken = await createJwt("provider-subject-1");
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${firstToken}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));
      const cookieHeader = appCookie?.split(";")[0] ?? "";
      const secondToken = await createJwt("provider-subject-2");

      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", cookieHeader)
        .set("authorization", `Bearer ${secondToken}`)
        .expect(200);
    } finally {
      await app.close();
    }
  });

  it("rejects the next cookie-session read after the application account is deactivated", async () => {
    const accountState = { active: true, exists: true };
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(accountState),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));
      const cookieHeader = appCookie?.split(";")[0] ?? "";

      accountState.active = false;

      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", cookieHeader)
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it("rejects the next cookie-session read after the application account is removed", async () => {
    const accountState = { active: true, exists: true };
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(accountState),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));

      accountState.exists = false;

      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", appCookie?.split(";")[0] ?? "")
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it("does not restore removed DB roles from a previously issued cookie", async () => {
    const accountState = { active: true, exists: true, rolesActive: true };
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(accountState),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));

      accountState.rolesActive = false;

      await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", appCookie?.split(";")[0] ?? "")
        .expect(401);
    } finally {
      await app.close();
    }
  });

  it("keeps only the still-active DB role after a partial role removal", async () => {
    const accountState = {
      active: true,
      exists: true,
      roleCodes: ["REPORT_VIEWER", "STORE_MANAGER"],
    };
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(accountState),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));

      accountState.roleCodes = ["STORE_MANAGER"];

      const sessionResponse = await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", appCookie?.split(";")[0] ?? "")
        .expect(200);
      expect(sessionResponse.body.user.roleCodes).toEqual(["STORE_MANAGER"]);
    } finally {
      await app.close();
    }
  });

  it("does not restore a removed action store from a previously issued cookie", async () => {
    const accountState = {
      actionStoresActive: true,
      active: true,
      exists: true,
      roleStoreId: null,
    };
    const app = await createIntegrationApp({
      databaseService: createDatabaseService(accountState),
      standardErrorFilter: true,
    });

    try {
      const token = await createJwt();
      const createResponse = await request(app.getHttpServer())
        .post("/api/auth/browser-session")
        .set("authorization", `Bearer ${token}`)
        .expect(201);
      const appCookie = (
        createResponse.headers["set-cookie"] as unknown as string[]
      ).find((cookie) => cookie.startsWith("hr_axis_browser_session="));

      accountState.actionStoresActive = false;

      const sessionResponse = await request(app.getHttpServer())
        .get("/api/auth/session")
        .set("cookie", appCookie?.split(";")[0] ?? "")
        .expect(200);
      expect(sessionResponse.body.user.actionScope).toMatchObject({
        assignedStoreIds: [],
      });
      expect(sessionResponse.body.user.assignedStoreIds).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
