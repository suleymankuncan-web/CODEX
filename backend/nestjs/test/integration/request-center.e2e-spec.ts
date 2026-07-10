import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { WorkflowInboxService } from "../../src/modules/store-ops/application/workflow-inbox.service";
import { WorkflowInboxController } from "../../src/modules/store-ops/web/workflow-inbox.controller";

describe("Request center read API", () => {
  let app: INestApplication;
  const workflowInboxService = {
    listInbox: jest.fn(),
    listRequestCenter: jest.fn(async () => ({
      items: [],
      meta: { count: 0, total: 10_000, limit: 15, offset: 30 },
      summary: { open: 9_990, done: 10, returned: 2 },
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowInboxController],
      providers: [{ provide: WorkflowInboxService, useValue: workflowInboxService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = {
        roleCodes: ["REGION_MANAGER"],
        scope: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
        actionScope: { assignedStoreIds: ["store-1"] },
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    workflowInboxService.listRequestCenter.mockClear();
  });

  it("passes one transformed bounded page and returns exact metadata", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/workflow/request-center")
      .query({
        bucket: "open",
        type: "target",
        status: "pending",
        period: "2026-07",
        limit: "15",
        offset: "30",
      })
      .expect(200);

    expect(response.body.meta).toEqual({ count: 0, total: 10_000, limit: 15, offset: 30 });
    expect(workflowInboxService.listRequestCenter).toHaveBeenCalledWith({
      actorRoles: ["REGION_MANAGER"],
      actorScope: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
      actorActionScope: { assignedStoreIds: ["store-1"] },
      bucket: "open",
      type: "target",
      status: "pending",
      period: "2026-07",
      storeId: undefined,
      query: undefined,
      limit: 15,
      offset: 30,
    });
  });

  it("rejects an unbounded or malformed page before the service", async () => {
    await request(app.getHttpServer())
      .get("/api/workflow/request-center")
      .query({ bucket: "waiting", limit: "500", offset: "-1" })
      .expect(400);

    expect(workflowInboxService.listRequestCenter).not.toHaveBeenCalled();
  });
});
