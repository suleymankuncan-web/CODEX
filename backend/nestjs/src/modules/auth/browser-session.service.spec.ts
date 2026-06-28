import { UnauthorizedException } from "@nestjs/common";
import { BrowserSessionService } from "./browser-session.service";
import { buildAuthenticatedUser } from "./auth-context.service";

function createConfig(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    browserSessionPreviousSecret: undefined,
    browserSessionSecret: "0123456789abcdef0123456789ABCDEF",
    browserSessionTtlSeconds: 900,
    ...overrides,
  };
}

function createUser() {
  return buildAuthenticatedUser({
    userId: "app-user-1",
    employeeId: "employee-1",
    displayName: "Ada Kaya",
    username: "ada.kaya",
    email: "ada.kaya@example.com",
    roleCodes: ["REPORT_VIEWER"],
    readScope: {
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: ["store-1"],
    },
    actionScope: {
      assignedStoreIds: ["store-1"],
      assignedStoreTypes: ["company"],
    },
  });
}

describe("BrowserSessionService", () => {
  it("signs and verifies short-lived app sessions", () => {
    const service = new BrowserSessionService(createConfig() as never);
    const issued = service.issueSession(createUser());
    const verified = service.verifySession(
      issued.cookieValue,
      Date.UTC(2026, 0, 1, 0, 5, 0),
    );

    expect(verified.user).toMatchObject({
      userId: "app-user-1",
      employeeId: "employee-1",
      displayName: "Ada Kaya",
      username: "ada.kaya",
      email: "ada.kaya@example.com",
      roleCodes: ["REPORT_VIEWER"],
      readScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      actionScope: {
        assignedStoreIds: ["store-1"],
        assignedStoreTypes: ["company"],
      },
      assignedStoreTypes: ["company"],
    });
    expect(service.verifyCsrfToken(issued.cookieValue, issued.csrfNonce)).toBe(true);
  });

  it("verifies previous-secret sessions but signs new sessions with the current secret", () => {
    const oldService = new BrowserSessionService(
      createConfig({
        browserSessionSecret: "abcdef0123456789ABCDEF0123456789",
      }) as never,
    );
    const oldCookie = oldService.issueSession(createUser()).cookieValue;
    const rotatedService = new BrowserSessionService(
      createConfig({
        browserSessionPreviousSecret: "abcdef0123456789ABCDEF0123456789",
      }) as never,
    );
    const newCookie = rotatedService.issueSession(createUser()).cookieValue;

    expect(rotatedService.verifySession(oldCookie).user.userId).toBe("app-user-1");
    expect(() => oldService.verifySession(newCookie)).toThrow(UnauthorizedException);
  });

  it("rejects expired, malformed, and wrong-key sessions", () => {
    const service = new BrowserSessionService(createConfig() as never);
    const issued = service.issueSession(createUser(), Date.UTC(2026, 0, 1, 0, 0, 0));
    const wrongKeyService = new BrowserSessionService(
      createConfig({
        browserSessionSecret: "abcdef0123456789ABCDEF0123456789",
      }) as never,
    );

    expect(() =>
      service.verifySession(issued.cookieValue, Date.UTC(2026, 0, 1, 0, 20, 0)),
    ).toThrow(UnauthorizedException);
    expect(() => service.verifySession("not-a-session")).toThrow(UnauthorizedException);
    expect(() => wrongKeyService.verifySession(issued.cookieValue)).toThrow(
      UnauthorizedException,
    );
  });
});
