import { createHash, createHmac } from "node:crypto";
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

  it("issues a deterministic CSRF nonce and recovers it without changing the session envelope", () => {
    const service = new BrowserSessionService(createConfig({ browserSessionTtlSeconds: 120 }) as never);
    const issuedAt = Date.now();
    const issued = service.issueSession(createUser(), issuedAt);
    const before = service.verifySession(issued.cookieValue, issuedAt + 30_000).envelope;

    const recovered = service.recoverCsrfNonce(issued.cookieValue, issuedAt + 30_000);
    const after = service.verifySession(issued.cookieValue, issuedAt + 30_000).envelope;

    expect(recovered.csrfNonce).toBe(issued.csrfNonce);
    expect(service.verifyCsrfToken(issued.cookieValue, recovered.csrfNonce)).toBe(true);
    expect(after).toMatchObject({
      sid: before.sid,
      iat: before.iat,
      exp: before.exp,
      user: before.user,
    });
    expect(after.csrfHash).toBe(before.csrfHash);
    expect(recovered.expiresAt).toBe(issued.expiresAt);
    expect(recovered.sessionId).toBe(issued.sessionId);
  });

  it("makes repeated CSRF recovery idempotent across concurrent tabs", () => {
    const service = new BrowserSessionService(createConfig({ browserSessionTtlSeconds: 120 }) as never);
    const issuedAt = Date.UTC(2026, 0, 1, 0, 0, 0);
    const issued = service.issueSession(createUser(), issuedAt);

    const first = service.recoverCsrfNonce(issued.cookieValue, issuedAt + 30_000);
    const repeated = service.recoverCsrfNonce(issued.cookieValue, issuedAt + 30_000);

    expect(repeated).toEqual(first);
    expect(first.expiresAt).toBe(issued.expiresAt);
    expect(first.sessionId).toBe(issued.sessionId);
  });

  it("derives different recovery nonces for different signed sessions", () => {
    const service = new BrowserSessionService(createConfig() as never);
    const issuedAt = Date.UTC(2026, 0, 1, 0, 0, 0);
    const first = service.issueSession(createUser(), issuedAt);
    const second = service.issueSession(createUser(), issuedAt);

    expect(service.recoverCsrfNonce(first.cookieValue, issuedAt).csrfNonce).not.toBe(
      service.recoverCsrfNonce(second.cookieValue, issuedAt).csrfNonce,
    );
  });

  it("recovers previous-secret cookies with the key that signed them", () => {
    const oldSecret = "abcdef0123456789ABCDEF0123456789";
    const issuedAt = Date.now();
    const recoveryNow = issuedAt + 30_000;
    const oldService = new BrowserSessionService(
      createConfig({ browserSessionSecret: oldSecret }) as never,
    );
    const oldIssued = oldService.issueSession(createUser(), issuedAt);
    const oldCookie = oldIssued.cookieValue;
    const rotatedService = new BrowserSessionService(
      createConfig({ browserSessionPreviousSecret: oldSecret }) as never,
    );

    const fromPrevious = rotatedService.recoverCsrfNonce(oldCookie, recoveryNow);
    const fromRepeated = rotatedService.recoverCsrfNonce(oldCookie, recoveryNow);

    expect(fromRepeated).toEqual(fromPrevious);
    expect(fromPrevious.csrfNonce).toBe(oldService.recoverCsrfNonce(oldCookie, recoveryNow).csrfNonce);
    expect(fromPrevious.csrfNonce).toBe(oldIssued.csrfNonce);
    expect(fromPrevious.csrfNonce).toHaveLength(43);
    expect(rotatedService.verifySession(oldCookie, recoveryNow).envelope.exp).toBe(
      oldService.verifySession(oldCookie, recoveryNow).envelope.exp,
    );
  });

  it("rejects signed legacy cookies whose random CSRF hash cannot be recovered", () => {
    const secret = "0123456789abcdef0123456789ABCDEF";
    const service = new BrowserSessionService(createConfig({ browserSessionSecret: secret }) as never);
    const issuedAt = Date.UTC(2026, 0, 1, 0, 0, 0);
    const envelope = {
      alg: "HS256",
      csrfHash: createHash("sha256").update("legacy-random-csrf").digest("base64url"),
      exp: Math.floor(issuedAt / 1000) + 120,
      iat: Math.floor(issuedAt / 1000),
      sid: "legacy-session-id",
      user: {
        actionScope: { assignedStoreIds: [], assignedStoreTypes: [] },
        readScope: { companyIds: [], regionIds: [], storeIds: [] },
        roleCodes: ["REPORT_VIEWER"],
        userId: "app-user-1",
      },
      v: 1,
    };
    const payload = Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
    const cookie = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;

    expect(() => service.recoverCsrfNonce(cookie, issuedAt + 30_000)).toThrow(UnauthorizedException);
  });

  it.each<[string, (cookie: string) => string]>([
    ["tampered", (cookie: string) => `${cookie}x`],
    ["missing", (_cookie: string) => ""],
  ])("rejects %s cookies during CSRF nonce recovery", (_label, mutate) => {
    const service = new BrowserSessionService(createConfig() as never);
    const issued = service.issueSession(createUser(), Date.UTC(2026, 0, 1, 0, 0, 0));

    expect(() => service.recoverCsrfNonce(mutate(issued.cookieValue), Date.UTC(2026, 0, 1, 0, 0, 1))).toThrow(
      UnauthorizedException,
    );
  });

  it("rejects expired cookies during CSRF nonce recovery", () => {
    const service = new BrowserSessionService(createConfig({ browserSessionTtlSeconds: 1 }) as never);
    const issued = service.issueSession(createUser(), Date.UTC(2026, 0, 1, 0, 0, 0));

    expect(() =>
      service.recoverCsrfNonce(issued.cookieValue, Date.UTC(2026, 0, 1, 0, 0, 2)),
    ).toThrow(UnauthorizedException);
  });
});
