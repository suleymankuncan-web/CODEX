import "reflect-metadata";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  REQUIRED_ACTION_SCOPE_KEY,
  REQUIRED_SCOPE_KEY,
} from "../decorators/scope.decorator";
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

  it("does not read store scope identifiers from path params", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, "store", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        buildContext({
          handler,
          params: { storeId: "store-a" },
          user: {
            readScope: { companyIds: [], regionIds: [], storeIds: ["store-a"] },
            actionScope: { assignedStoreIds: [] },
          },
        }),
      ),
    ).toThrow("Missing store scope identifier");
  });

  it("does not read region scope identifiers from path params", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_SCOPE_KEY, "region", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        buildContext({
          handler,
          params: { regionId: "region-a" },
          user: {
            readScope: { companyIds: [], regionIds: ["region-a"], storeIds: [] },
            actionScope: { assignedStoreIds: [] },
          },
        }),
      ),
    ).toThrow("Missing region scope identifier");
  });

  it("does not read store action scope identifiers from path params", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_ACTION_SCOPE_KEY, "store", handler);
    const guard = new ScopeGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        buildContext({
          handler,
          params: { storeId: "store-a" },
          user: {
            readScope: { companyIds: [], regionIds: [], storeIds: ["store-a"] },
            actionScope: { assignedStoreIds: ["store-a"] },
          },
        }),
      ),
    ).toThrow("Missing store action scope identifier");
  });

  function buildContext(input: {
    handler: () => undefined;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    body?: Record<string, unknown>;
    user: unknown;
  }) {
    return {
      getHandler: () => input.handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          query: input.query ?? {},
          params: input.params ?? {},
          body: input.body,
          user: input.user,
        }),
      }),
    } as never;
  }
});
