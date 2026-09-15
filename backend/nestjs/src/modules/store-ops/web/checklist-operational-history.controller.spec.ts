import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { ChecklistOperationalHistoryController } from "./checklist-operational-history.controller";

describe("ChecklistOperationalHistoryController", () => {
  it("keeps the endpoint read-only and aligned with the four approved Store personas", async () => {
    const service = { read: jest.fn().mockResolvedValue({ items: [], page: { nextCursor: null, hasMore: false } }) };
    const controller = new ChecklistOperationalHistoryController(service as never);
    const handler = ChecklistOperationalHistoryController.prototype.read;
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual(["REPORT_VIEWER", "SUPER_ADMIN", "REGION_MANAGER", "STORE_MANAGER"]);

    await expect(controller.read(
      { user: { roleCodes: ["REPORT_VIEWER"], readScope: { companyIds: ["company-a"], regionIds: [], storeIds: [] }, roleScopes: { REPORT_VIEWER: { companyIds: ["company-a"], regionIds: [], storeIds: [] } } } } as never,
      { storeId: "11111111-1111-4111-8111-111111111111" },
      { range: "3m", kinds: "checklist_completed", cursor: "cursor" },
    )).resolves.toEqual({ data: { items: [], page: { nextCursor: null, hasMore: false } } });
    expect(service.read).toHaveBeenCalledWith(expect.objectContaining({
      actorRoleCodes: ["REPORT_VIEWER"], actorReadScope: { companyIds: ["company-a"], regionIds: [], storeIds: [] }, storeId: "11111111-1111-4111-8111-111111111111", range: "3m",
    }));
  });
});
