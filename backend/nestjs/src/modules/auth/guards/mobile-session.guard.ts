import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthenticatedUser } from "../auth-context.service";
import { MobileSessionDto, MobileSessionService } from "../mobile-session.service";

export type MobileSessionRequest = {
  user?: AuthenticatedUser;
  mobileSession?: MobileSessionDto;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class MobileSessionGuard implements CanActivate {
  constructor(private readonly mobileSessionService: MobileSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MobileSessionRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Authenticated user is required");
    }

    const sessionId = getFirstHeaderValue(request.headers["x-mobile-session-id"]);
    if (!sessionId) {
      throw new UnauthorizedException("Mobile session id is required");
    }

    request.mobileSession = await this.mobileSessionService.assertActiveSession({
      userId: user.userId,
      sessionId,
    });

    return true;
  }
}

function getFirstHeaderValue(value: string | string[] | undefined) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const normalized = firstValue?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
