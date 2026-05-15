import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Mobile checklist today flow", () => {
  const storeId = "11111111-1111-4111-8111-111111111111";
  const otherStoreId = "99999999-9999-4999-8999-999999999999";
  const regionId = "12121212-1212-4121-8121-121212121212";
  const templateId = "22222222-2222-4222-8222-222222222222";
  const vmTemplateId = "77777777-7777-4777-8777-777777777777";
  const templateItemId = "55555555-5555-4555-8555-555555555555";

  it("returns mobile today payload with monthly visit average", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.store s") && sql.includes("ORDER BY s.store_name ASC")) {
        return {
          rows: [{ store_id: storeId, store_name: "Marmara Park" }],
        };
      }

      if (sql.includes("FROM ops.checklist_template_item cti")) {
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_item_id: templateItemId,
              section_name: "Standart",
              item_no: 1,
              item_text: "Magaza ziyareti standardi",
              response_type: "score",
              weight: "100.00",
              max_score: "10.00",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.checklist_template ct")) {
        expect(sql).toContain("ct.template_type = ANY");
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_code: "BM_VISIT_V1",
              template_type: "BM_STORE_VISIT",
              template_name: "BM Visit",
              version_no: 1,
            },
          ],
        };
      }

      if (sql.includes("GROUP BY ci.store_id, ci.checklist_template_id")) {
        return {
          rows: [
            {
              store_id: storeId,
              checklist_template_id: templateId,
              month_start: "2026-04-01",
              completed_count: "2",
              average_score: "86.00",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/mobile/checklists/today")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-region-ids", regionId)
      .set("x-read-company-ids", "");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      stores: [{ storeId, storeName: "Marmara Park" }],
      templates: [
        {
          checklistTemplateId: templateId,
          templateCode: "BM_VISIT_V1",
          templateType: "BM_STORE_VISIT",
          templateName: "BM Visit",
          versionNo: 1,
          items: [
            {
              templateItemId,
              sectionName: "Standart",
              itemNo: 1,
              itemText: "Magaza ziyareti standardi",
              responseType: "score",
              weight: 100,
              maxScore: 10,
            },
          ],
        },
      ],
      activeInstances: [],
      completedThisMonth: [],
      pendingAcknowledgements: [],
      monthlySummaries: [
        {
          storeId,
          checklistTemplateId: templateId,
          monthStart: "2026-04-01",
          completedCount: 2,
          averageScore: 86,
        },
      ],
    });

    await app.close();
  });

  it("returns BM and VM checklist coverage to region managers", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("ORDER BY s.store_name ASC")) {
        return {
          rows: [{ store_id: storeId, store_name: "Marmara Park" }],
        };
      }

      if (sql.includes("WITH ranked_templates")) {
        expect(params?.[1]).toEqual(["BM_STORE_VISIT", "VM_STORE_VISIT"]);
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_code: "BM_VISIT_V1",
              template_type: "BM_STORE_VISIT",
              template_name: "BM Visit",
              version_no: 1,
            },
            {
              checklist_template_id: vmTemplateId,
              template_code: "VM_VISIT_V1",
              template_type: "VM_STORE_VISIT",
              template_name: "VM Visit",
              version_no: 1,
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/mobile/checklists/today")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-region-ids", regionId)
      .set("x-read-company-ids", "");

    expect(response.status).toBe(200);
    expect(response.body.data.templates.map((template: { templateType: string }) => template.templateType)).toEqual([
      "BM_STORE_VISIT",
      "VM_STORE_VISIT",
    ]);

    await app.close();
  });

  it("filters VM checklist today payload to VM templates for visual merchandisers", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.store s") && sql.includes("ORDER BY s.store_name ASC")) {
        return {
          rows: [{ store_id: storeId, store_name: "Marmara Park" }],
        };
      }

      if (sql.includes("FROM ops.checklist_template_item cti")) {
        return {
          rows: [
            {
              checklist_template_id: vmTemplateId,
              template_item_id: templateItemId,
              section_name: "Gorsel duzen",
              item_no: 1,
              item_text: "Vitrin standartlara uygun",
              response_type: "score",
              weight: "100.00",
              max_score: "10.00",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.checklist_template ct")) {
        expect(sql).toContain("ct.template_type = ANY");
        return {
          rows: [
            {
              checklist_template_id: vmTemplateId,
              template_code: "VM_VISIT_V1",
              template_type: "VM_STORE_VISIT",
              template_name: "VM Visit",
              version_no: 1,
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const todayResponse = await request(app.getHttpServer())
      .get("/api/mobile/checklists/today")
      .set("x-user-id", "vm-user-1")
      .set("x-role-codes", "VISUAL_MERCHANDISER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId);

    expect(todayResponse.status).toBe(200);
    expect(todayResponse.body.data.templates).toEqual([
      {
        checklistTemplateId: vmTemplateId,
        templateCode: "VM_VISIT_V1",
        templateType: "VM_STORE_VISIT",
        templateName: "VM Visit",
        versionNo: 1,
        items: [
          {
            templateItemId,
            sectionName: "Gorsel duzen",
            itemNo: 1,
            itemText: "Vitrin standartlara uygun",
            responseType: "score",
            weight: 100,
            maxScore: 10,
          },
        ],
      },
    ]);

    await app.close();
  });

  it("lets visual merchandisers start VM checklists for assigned stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT ct.checklist_template_id") && sql.includes("ct.template_type")) {
        return {
          rows: [
            {
              checklist_template_id: vmTemplateId,
              template_type: "VM_STORE_VISIT",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              status: "in_progress",
              created_at: "2026-04-29T10:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "vm-user-1")
      .set("x-role-codes", "VISUAL_MERCHANDISER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: vmTemplateId, storeId });

    expect(response.status).toBe(201);
    expect(response.body.command.status).toBe("created");

    await app.close();
  });

  it("blocks visual merchandisers from starting BM checklists", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT ct.checklist_template_id") && sql.includes("ct.template_type")) {
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_type: "BM_STORE_VISIT",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const startBmChecklistResponse = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "vm-user-1")
      .set("x-role-codes", "VISUAL_MERCHANDISER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(startBmChecklistResponse.status).toBe(403);

    await app.close();
  });

  it("blocks region managers from starting VM checklists in V1", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT ct.checklist_template_id") && sql.includes("ct.template_type")) {
        return {
          rows: [
            {
              checklist_template_id: vmTemplateId,
              template_type: "VM_STORE_VISIT",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: vmTemplateId, storeId });

    expect(response.status).toBe(403);

    await app.close();
  });

  it("lets region managers start a checklist only for assigned stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT ct.checklist_template_id") && sql.includes("ct.template_type")) {
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_type: "BM_STORE_VISIT",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return {
          rows: [
            {
              checklist_instance_id: "instance-1",
              status: "in_progress",
              created_at: "2026-04-28T10:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const allowed = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(allowed.status).toBe(201);
    expect(allowed.body.data.checklistInstance.status).toBe("in_progress");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ct.status = 'published'"),
      [templateId, storeId],
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ops.checklist_instance"),
      [templateId, storeId, "region-user-1"],
    );

    const forbidden = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId: otherStoreId });

    expect(forbidden.status).toBe(403);

    await app.close();
  });

  it("rejects starting a checklist when the template is not available for the store", async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Checklist template is not available for this store");

    await app.close();
  });

  it("saves responses, completes with weighted score, and locks completed instances", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.checklist_instance ci") && sql.includes("cti.max_score")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              store_id: storeId,
              status: "in_progress",
              max_score: "10.00",
            },
          ],
        };
      }

      if (
        sql.includes("SELECT ci.checklist_instance_id, ci.store_id, ci.status") ||
        sql.includes("SELECT checklist_instance_id, store_id, status")
      ) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              store_id: storeId,
              status: "in_progress",
              template_type: "BM_STORE_VISIT",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_response")) {
        return {
          rows: [
            {
              response_id: "response-1",
              responded_at: "2026-04-28T10:05:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance") && sql.includes("status = 'in_progress'")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              status: "in_progress",
            },
          ],
        };
      }

      if (sql.includes("SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0))")) {
        return {
          rows: [
            {
              total_score: "86.00",
              compliance_rate: "1.0000",
              missing_mandatory_count: "0",
            },
          ],
        };
      }

      if (sql.includes("locked_at = NOW()")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              status: "completed",
              total_score: "86.00",
              compliance_rate: "1.0000",
              completed_at: "2026-04-28T10:10:00.000Z",
              locked_at: "2026-04-28T10:10:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const save = await request(app.getHttpServer())
      .patch("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/responses")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({
        templateItemId: "55555555-5555-4555-8555-555555555555",
        scoreValue: 8,
        commentText: "Good",
      });

    expect(save.status).toBe(200);

    const complete = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/complete")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(complete.status).toBe(201);
    expect(complete.body.data.checklistInstance.total_score).toBe("86.00");
    expect(complete.body.data.checklistInstance.locked_at).toBe("2026-04-28T10:10:00.000Z");

    await app.close();
  });

  it("lets store managers acknowledge assigned checklist results only", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT checklist_instance_id, store_id")) {
        return {
          rows: [
            {
              checklist_instance_id: "33333333-3333-4333-8333-333333333333",
              store_id: storeId,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_acknowledgement")) {
        return {
          rows: [
            {
              checklist_acknowledgement_id: "ack-1",
              acknowledged_by_user_id: "store-manager-1",
              acknowledgement_note: "Kabul ettim",
              acknowledged_at: "2026-04-28T11:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const allowed = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/acknowledge")
      .set("x-user-id", "store-manager-1")
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ acknowledgementNote: "Kabul ettim" });

    expect(allowed.status).toBe(201);
    expect(allowed.body.command.status).toBe("acknowledged");
    expect(allowed.body.data.acknowledgement.acknowledgementNote).toBe("Kabul ettim");

    const forbidden = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/acknowledge")
      .set("x-user-id", "store-manager-1")
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-store-ids", otherStoreId)
      .set("x-assigned-store-ids", otherStoreId)
      .send({ acknowledgementNote: "Kabul ettim" });

    expect(forbidden.status).toBe(403);

    await app.close();
  });

  it("hands a completed BM checklist to the store manager acknowledgement queue", async () => {
    const checklistInstanceIdForHandoff = "44444444-4444-4444-8444-444444444444";
    const state = {
      active: false,
      responseSaved: false,
      completed: false,
      acknowledged: false,
      acknowledgementNote: null as string | null,
    };
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT ct.checklist_template_id, ct.template_type")) {
        return {
          rows: [
            {
              checklist_template_id: templateId,
              template_type: "BM_STORE_VISIT",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        state.active = true;
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              status: "in_progress",
              created_at: "2026-04-28T10:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("SELECT ci.checklist_instance_id, ci.store_id, ci.status, ct.template_type")) {
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              store_id: storeId,
              status: state.completed ? "completed" : "in_progress",
              template_type: "BM_STORE_VISIT",
            },
          ],
        };
      }

      if (
        sql.includes("FROM ops.checklist_instance ci") &&
        sql.includes("cti.max_score") &&
        !sql.includes("jsonb_agg")
      ) {
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              store_id: storeId,
              status: state.completed ? "completed" : "in_progress",
              max_score: "10.00",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_response")) {
        state.responseSaved = true;
        return {
          rows: [
            {
              response_id: "66666666-6666-4666-8666-666666666666",
              responded_at: "2026-04-28T10:05:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance") && sql.includes("status = 'planned'")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT checklist_instance_id, store_id, status") && sql.includes("FOR UPDATE")) {
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              store_id: storeId,
              status: state.completed ? "completed" : "in_progress",
            },
          ],
        };
      }

      if (sql.includes("SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0))")) {
        return {
          rows: [
            {
              total_score: state.responseSaved ? "80.00" : "0.00",
              compliance_rate: state.responseSaved ? "1.0000" : "0.0000",
              missing_mandatory_count: "0",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.checklist_instance") && sql.includes("locked_at = NOW()")) {
        state.active = false;
        state.completed = true;
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              status: "completed",
              total_score: "80.00",
              compliance_rate: "1.0000",
              completed_at: "2026-04-28T10:10:00.000Z",
              locked_at: "2026-04-28T10:10:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("jsonb_agg")) {
        return {
          rows: state.completed
            ? [
                {
                  checklist_instance_id: checklistInstanceIdForHandoff,
                  checklist_template_id: templateId,
                  template_name: "BM Result",
                  template_type: "BM_STORE_VISIT",
                  category: "BM",
                  store_id: storeId,
                  store_name: "Marmara Park",
                  completed_by_user_id: "region-user-1",
                  completed_at: "2026-04-28T10:10:00.000Z",
                  status: "completed",
                  total_score: "80.00",
                  compliance_rate: "1.0000",
                  checklist_acknowledgement_id: state.acknowledged
                    ? "77777777-7777-4777-8777-777777777777"
                    : null,
                  acknowledged_by_user_id: state.acknowledged ? "store-manager-1" : null,
                  acknowledgement_note: state.acknowledgementNote,
                  acknowledged_at: state.acknowledged ? "2026-04-28T11:00:00.000Z" : null,
                  responses_json: [
                    {
                      templateItemId,
                      sectionName: "Vitrin",
                      itemNo: 1,
                      itemText: "Vitrin standartlara uygun",
                      responseType: "score",
                      weight: 100,
                      maxScore: 10,
                      scoreValue: 8,
                      commentText: "Saha kontrolu tamamlandi",
                    },
                  ],
                },
              ]
            : [],
        };
      }

      if (
        sql.includes("SELECT checklist_instance_id, store_id") &&
        sql.includes("FROM ops.checklist_instance")
      ) {
        return {
          rows: [
            {
              checklist_instance_id: checklistInstanceIdForHandoff,
              store_id: storeId,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.checklist_acknowledgement")) {
        state.acknowledged = true;
        state.acknowledgementNote = String(params?.[3] ?? "");
        return {
          rows: [
            {
              checklist_acknowledgement_id: "77777777-7777-4777-8777-777777777777",
              acknowledged_by_user_id: "store-manager-1",
              acknowledgement_note: state.acknowledgementNote,
              acknowledged_at: "2026-04-28T11:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const start = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(start.status).toBe(201);
    expect(start.body.data.checklistInstance.checklist_instance_id).toBe(
      checklistInstanceIdForHandoff,
    );

    const save = await request(app.getHttpServer())
      .patch(`/api/mobile/checklists/instances/${checklistInstanceIdForHandoff}/responses`)
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({
        templateItemId,
        scoreValue: 8,
        commentText: "Saha kontrolu tamamlandi",
      });

    expect(save.status).toBe(200);

    const complete = await request(app.getHttpServer())
      .post(`/api/mobile/checklists/instances/${checklistInstanceIdForHandoff}/complete`)
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(complete.status).toBe(201);
    expect(complete.body.data.checklistInstance.status).toBe("completed");
    expect(state.completed).toBe(true);

    const pendingList = await request(app.getHttpServer())
      .post("/api/checklists/acknowledgements/list")
      .set("x-user-id", "store-manager-1")
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(pendingList.status).toBe(201);
    expect(pendingList.body.items).toHaveLength(1);
    expect(pendingList.body.items[0]).toMatchObject({
      checklistInstanceId: checklistInstanceIdForHandoff,
      templateType: "BM_STORE_VISIT",
      totalScore: 80,
      acknowledgement: null,
    });
    expect(pendingList.body.items[0].responses).toEqual([
      expect.objectContaining({
        templateItemId,
        scoreValue: 8,
        commentText: "Saha kontrolu tamamlandi",
      }),
    ]);

    const acknowledge = await request(app.getHttpServer())
      .post(`/api/checklists/instances/${checklistInstanceIdForHandoff}/acknowledge`)
      .set("x-user-id", "store-manager-1")
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ acknowledgementNote: "Magaza sonucu gordu" });

    expect(acknowledge.status).toBe(201);
    expect(acknowledge.body.data.acknowledgement.acknowledgementNote).toBe(
      "Magaza sonucu gordu",
    );

    const acknowledgedList = await request(app.getHttpServer())
      .post("/api/checklists/acknowledgements/list")
      .set("x-user-id", "store-manager-1")
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({});

    expect(acknowledgedList.status).toBe(201);
    expect(acknowledgedList.body.items[0].acknowledgement).toMatchObject({
      acknowledgedByUserId: "store-manager-1",
      acknowledgementNote: "Magaza sonucu gordu",
    });

    await app.close();
  });
});
