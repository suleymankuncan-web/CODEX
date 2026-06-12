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

function createDatabaseService() {
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("FROM ops.user_account ua") && sql.includes("provider_subject")) {
      return {
        rowCount: 1,
        rows: [
          {
            email: "pilot@example.com",
            employee_id: "employee-1",
            is_active: true,
            user_id: APP_USER_ID,
            username: "pilot",
          },
        ],
      };
    }

    if (sql.includes("FROM ops.user_account ua") && sql.includes("user_role_assignment")) {
      expect(params).toEqual([APP_USER_ID]);
      return {
        rowCount: 1,
        rows: [
          {
            company_id: COMPANY_ID,
            region_id: REGION_ID,
            role_code: "REPORT_VIEWER",
            scope_type: "store",
            store_id: STORE_ID,
          },
        ],
      };
    }

    if (
      sql.includes("FROM ops.user_account ua") &&
      sql.includes("user_action_store_assignment")
    ) {
      expect(params).toEqual([APP_USER_ID]);
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
});
