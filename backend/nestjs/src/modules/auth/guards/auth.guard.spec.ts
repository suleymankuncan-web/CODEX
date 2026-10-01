import { UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";

describe("auth guard missing-session recovery", () => {
  const context = (originalUrl: string) => ({ getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ originalUrl, headers: {} }) }) });
  const guard = () => new AuthGuard({ resolveUser: async () => null } as never,
    { getAllAndOverride: () => false } as never);
  it("returns an explicit expired-session failure when a reload cookie is absent", async () => {
    await expect(guard().canActivate(context("/api/auth/browser-session/csrf") as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it("retains ordinary denial behavior for other paths and near-matches", async () => {
    for (const path of ["/api/auth/session", "/api/auth/browser-session/csrf/other"]) {
      await expect(guard().canActivate(context(path) as never)).resolves.toBe(false);
    }
  });
});
