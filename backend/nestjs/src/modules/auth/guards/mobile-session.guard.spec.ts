import { UnauthorizedException } from "@nestjs/common";
import { MobileSessionGuard } from "./mobile-session.guard";

const user = {
  userId: "11111111-1111-4111-8111-111111111111",
};

const session = {
  sessionId: "44444444-4444-4444-8444-444444444444",
  userId: user.userId,
  status: "active",
};

describe("MobileSessionGuard", () => {
  it("rejects mobile requests without x-mobile-session-id", async () => {
    const guard = new MobileSessionGuard({
      assertActiveSession: jest.fn(),
    } as never);

    await expect(
      guard.canActivate(buildContext({ user, headers: {} }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("attaches the active mobile session to the request", async () => {
    const service = {
      assertActiveSession: jest.fn().mockResolvedValue(session),
    };
    const request = {
      user,
      headers: {
        "x-mobile-session-id": session.sessionId,
      },
    };
    const guard = new MobileSessionGuard(service as never);

    await expect(guard.canActivate(buildContext(request) as never)).resolves.toBe(true);

    expect(service.assertActiveSession).toHaveBeenCalledWith({
      userId: user.userId,
      sessionId: session.sessionId,
    });
    expect(request).toMatchObject({
      mobileSession: session,
    });
  });
});

function buildContext(request: object) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}
