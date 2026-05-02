import { MobileSessionRepository } from "./mobile-session.repository";

const sessionRow = {
  mobile_device_session_id: "44444444-4444-4444-8444-444444444444",
  user_id: "11111111-1111-4111-8111-111111111111",
  provider_subject: "11111111-1111-4111-8111-111111111111",
  device_id_hash: "hashed-device",
  platform: "android",
  device_name: "Pixel",
  app_version: "1.0.0",
  os_version: "14",
  status: "active",
  created_at: "2026-04-28T09:00:00.000Z",
  last_seen_at: "2026-04-28T09:00:00.000Z",
  expires_at: null,
  revoked_at: null,
  revoked_by_user_id: null,
  revocation_reason: null,
};

describe("MobileSessionRepository", () => {
  it("creates the session and audit event in one transaction", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [sessionRow] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const databaseService = {
      withTransaction: jest.fn(async (work) => work(client)),
    };
    const repository = new MobileSessionRepository(databaseService as never);

    await repository.createSession({
      userId: sessionRow.user_id,
      providerSubject: sessionRow.provider_subject,
      deviceIdHash: sessionRow.device_id_hash,
      platform: "android",
      deviceName: "Pixel",
      appVersion: "1.0.0",
      osVersion: "14",
    });

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.query.mock.calls[0][0]).toContain("INSERT INTO ops.mobile_device_session");
    expect(client.query.mock.calls[1][0]).toContain("audit.event_log");
    expect(client.query.mock.calls[1][1][1]).toBe("mobile_device_session.created");
  });

  it("revokes the session and records a security audit event", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              ...sessionRow,
              status: "revoked",
              revoked_at: "2026-04-28T10:00:00.000Z",
              revoked_by_user_id: sessionRow.user_id,
              revocation_reason: "user_logout",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const databaseService = {
      withTransaction: jest.fn(async (work) => work(client)),
    };
    const repository = new MobileSessionRepository(databaseService as never);

    await repository.revokeSession({
      sessionId: sessionRow.mobile_device_session_id,
      userId: sessionRow.user_id,
      revokedByUserId: sessionRow.user_id,
      reason: "user_logout",
    });

    expect(client.query.mock.calls[0][0]).toContain("SET status = 'revoked'");
    expect(client.query.mock.calls[1][1][1]).toBe("mobile_device_session.revoked");
  });
});
