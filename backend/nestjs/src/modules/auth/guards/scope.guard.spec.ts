import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_SCOPE_KEY } from "../decorators/scope.decorator";
import { ScopeGuard } from "./scope.guard";

describe("ScopeGuard", () => {
  const controller = class TestController {};

  it("requires company read scope for company-scoped routes", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, "company", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        buildContext({
          handler,
          user: {
            readScope: { companyIds: [], regionIds: [], storeIds: [] },
            actionScope: { assignedStoreIds: [] },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("does not treat company read scope as access to every store id", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, "store", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        buildContext({
          handler,
          query: { storeId: "store-b" },
          user: {
            readScope: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
            actionScope: { assignedStoreIds: [] },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows explicit store read scope for matching store ids", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, "store", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(
      guard.canActivate(
        buildContext({
          handler,
          query: { storeId: "store-a" },
          user: {
            readScope: { companyIds: [], regionIds: [], storeIds: ["store-a"] },
            actionScope: { assignedStoreIds: [] },
          },
        }),
      ),
    ).toBe(true);
  });

  function buildContext(input: {
    handler: () => undefined;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    user: unknown;
  }) {
    return {
      getHandler: () => input.handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          query: input.query ?? {},
          body: input.body,
          user: input.user,
        }),
      }),
    } as never;
  }
});
