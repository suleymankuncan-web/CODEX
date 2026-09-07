import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { PersonnelObservationService } from "../application/personnel-observation.service";
import { IntegrationPersonnelObservationsController } from "./integration-personnel-observations.controller";

describe("personnel observation read controller", () => {
  it("keeps the exact personnel-master roles, company scope, and GET-only contract", () => {
    const handler = IntegrationPersonnelObservationsController.prototype.list;
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual(["HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN"]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("company");
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
  });
  it("passes only the authenticated company scope and bounded query to the service", async () => {
    const response = { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } };
    const list = jest.fn().mockResolvedValue(response);
    const module = await Test.createTestingModule({
      controllers: [IntegrationPersonnelObservationsController],
      providers: [{ provide: PersonnelObservationService, useValue: { list } }],
    }).compile();
    const controller = module.get(IntegrationPersonnelObservationsController);
    const query = { fromDate: "2026-08-09", toDate: "2026-09-07", q: "P001", limit: 20, offset: 0 };
    expect(await controller.list(query, { user: { scope: { companyIds: ["company-a"] } } })).toBe(response);
    expect(list).toHaveBeenCalledWith({ ...query, actorCompanyIds: ["company-a"], storeId: undefined });
    await module.close();
  });
});
