import { UnauthorizedException } from "@nestjs/common";
import { buildAuthenticatedUser } from "./auth-context.service";
import { MobileSessionService } from "./mobile-session.service";

const user = buildAuthenticatedUser({
  userId: "11111111-1111-4111-8111-111111111111",
  employeeId: "22222222-2222-4222-8222-222222222222",
  roleCodes: ["STORE_MANAGER"],
  readScope: {
    companyIds: [],
    regionIds: [],
    storeIds: ["33333333-3333-4333-8333-333333333333"],
  },
  actionScope: {
    assignedStoreIds: ["33333333-3333-4333-8333-333333333333"],
  },
});

const sessionRow = {
  mobile_device_session_id: "44444444-4444-4444-8444-444444444444",
  user_id: user.userId,
  provider_subject: user.userId,
  device_id_hash: "hashed-device",
  platform: "ios",
  device_name: "iPhone",
  app_version: "1.0.0",
  os_version: "17.0",
  status: "active",
  created_at: "2026-04-28T09:00:00.000Z",
  last_seen_at: "2026-04-28T09:05:00.000Z",
  expires_at: null,
  revoked_at: null,
  revoked_by_user_id: null,
  revocation_reason: null,
};

describe("MobileSessionService", () => {
  it("creates a mobile session using a hashed device id", async () => {
    const repository = buildRepositoryMock();
    repository.findActiveByUserAndDeviceHash.mockResolvedValue(null);
    repository.createSession.mockResolvedValue(sessionRow);

    const service = new MobileSessionService(repository as never);

    const result = await service.registerSession(user, {
      deviceId: "ios-device-123",
      platform: "ios",
      deviceName: "iPhone",
      appVersion: "1.0.0",
      osVersion: "17.0",
    });

    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.userId,
        providerSubject: user.userId,
        deviceIdHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        platform: "ios",
      }),
    );
    expect(repository.createSession.mock.calls[0][0].deviceIdHash).not.toBe("ios-device-123");
    expect(result.mobileSession.sessionId).toBe(sessionRow.mobile_device_session_id);
  });

  it("reuses an active device session instead of creating a duplicate", async () => {
    const repository = buildRepositoryMock();
    repository.findActiveByUserAndDeviceHash.mockResolvedValue(sessionRow);
    repository.touchSession.mockResolvedValue({
      ...sessionRow,
      last_seen_at: "2026-04-28T09:10:00.000Z",
    });

    const service = new MobileSessionService(repository as never);

    const result = await service.registerSession(user, {
      deviceId: "ios-device-123",
      platform: "ios",
    });

    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.touchSession).toHaveBeenCalledWith({
      sessionId: sessionRow.mobile_device_session_id,
      userId: user.userId,
    });
    expect(result.mobileSession.lastSeenAt).toBe("2026-04-28T09:10:00.000Z");
  });

  it("requires an active session when asserting mobile requests", async () => {
    const repository = buildRepositoryMock();
    repository.getActiveSessionForUser.mockResolvedValue(null);
    const service = new MobileSessionService(repository as never);

    await expect(
      service.assertActiveSession({
        userId: user.userId,
        sessionId: sessionRow.mobile_device_session_id,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokes the current session with a logout reason", async () => {
    const repository = buildRepositoryMock();
    repository.revokeSession.mockResolvedValue({
      ...sessionRow,
      status: "revoked",
      revoked_at: "2026-04-28T09:30:00.000Z",
      revoked_by_user_id: user.userId,
      revocation_reason: "user_logout",
    });
    const service = new MobileSessionService(repository as never);

    const result = await service.logoutCurrentSession({
      user,
      sessionId: sessionRow.mobile_device_session_id,
    });

    expect(repository.revokeSession).toHaveBeenCalledWith({
      sessionId: sessionRow.mobile_device_session_id,
      userId: user.userId,
      revokedByUserId: user.userId,
      reason: "user_logout",
    });
    expect(result.mobileSession.status).toBe("revoked");
  });
});

function buildRepositoryMock() {
  return {
    createSession: jest.fn(),
    findActiveByUserAndDeviceHash: jest.fn(),
    getActiveSessionForUser: jest.fn(),
    listSessionsForUser: jest.fn(),
    revokeSession: jest.fn(),
    touchSession: jest.fn(),
  };
}
