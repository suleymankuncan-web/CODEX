import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Checklist flow integration", () => {
  it("creates a checklist instance through the HTTP API", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return {
          rowCount: 1,
          rows: [
            {
              checklist_instance_id: "instance-1",
              status: "planned",
              created_at: "2026-04-17T00:00:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/checklists/instances")
      .set("x-user-id", "user-1")
      .set("x-store-ids", "11111111-1111-4111-8111-111111111111")
      .send({
        templateId: "22222222-2222-4222-8222-222222222222",
        storeId: "11111111-1111-4111-8111-111111111111",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Checklist instance created",
    });
    expect(response.body.data.checklistInstance.checklist_instance_id).toBe("instance-1");

    await app.close();
  });
});
