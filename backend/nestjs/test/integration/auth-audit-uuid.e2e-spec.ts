import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth audit UUID boundaries", () => {
  const adminUserId = "90000000-0000-4000-8000-000000000001";

  it.each([
    ["role assignment", "/api/auth/role-assignments/not-a-uuid/audit"],
    ["action-store assignment", "/api/auth/action-store-assignments/not-a-uuid/audit"],
    ["user account", "/api/auth/users/not-a-uuid/audit"],
  ])(
    "rejects a malformed UUID for the %s audit route before any query",
    async (_label, path) => {
      const query = jest.fn(async () => {
        throw new Error("malformed UUID must not reach the database");
      });
      const app = await createIntegrationApp({
        databaseService: { query },
        authContextService: {
          resolveUser: jest.fn(async () => ({
            userId: adminUserId,
            roleCodes: ["SUPER_ADMIN"],
            scope: { companyIds: [], regionIds: [], storeIds: [] },
          })),
        },
      });

      const response = await request(app.getHttpServer())
        .get(path)
        .set("x-user-id", adminUserId)
        .set("x-role-codes", "SUPER_ADMIN");

      expect(response.status).toBe(400);
      expect(query).not.toHaveBeenCalled();

      await app.close();
    },
  );
});
