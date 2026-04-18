import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  REQUIRED_SCOPE_KEY,
  RequiredScope,
} from "../decorators/scope.decorator";

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredScope = this.reflector.getAllAndOverride<RequiredScope>(
      REQUIRED_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScope || requiredScope === "authenticated") {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | {
          scope: {
            companyIds: string[];
            regionIds: string[];
            storeIds: string[];
          };
        }
      | undefined;

    if (!user) {
      throw new ForbiddenException("Missing authenticated user context");
    }

    if (requiredScope === "company") {
      return true;
    }

    const scopeId =
      requiredScope === "region"
        ? request.query.regionId ?? request.body?.regionId
        : request.query.storeId ?? request.body?.storeId;

    if (!scopeId) {
      throw new ForbiddenException(`Missing ${requiredScope} scope identifier`);
    }

    const allowed =
      requiredScope === "region"
        ? user.scope.regionIds.includes(scopeId) || user.scope.companyIds.length > 0
        : user.scope.storeIds.includes(scopeId) || user.scope.companyIds.length > 0;

    if (!allowed) {
      throw new ForbiddenException(`Out-of-scope ${requiredScope} access`);
    }

    return true;
  }
}
