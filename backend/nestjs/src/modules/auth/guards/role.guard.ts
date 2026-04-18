import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REQUIRED_ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roleCodes?: string[] } | undefined;

    if (!user) {
      throw new ForbiddenException("Missing authenticated user context");
    }

    const roleCodes = user.roleCodes ?? [];

    if (roleCodes.includes("SUPER_ADMIN")) {
      return true;
    }

    const allowed = requiredRoles.some((role) => roleCodes.includes(role));

    if (!allowed) {
      throw new ForbiddenException("Missing required role");
    }

    return true;
  }
}
