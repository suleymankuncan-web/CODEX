import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthContextService } from "../auth-context.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { RequestContextStore } from "../../../shared/request-context";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authContextService: AuthContextService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    request.user = await this.authContextService.resolveUser(request);
    RequestContextStore.setActorUserId(request.user?.userId ?? null);
    return request.user !== null;
  }
}
