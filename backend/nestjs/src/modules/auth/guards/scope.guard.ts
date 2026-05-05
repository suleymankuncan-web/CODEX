import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  REQUIRED_ACTION_SCOPE_KEY,
  REQUIRED_SCOPE_KEY,
  RequiredActionScope,
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

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | {
          scope: {
            companyIds: string[];
            regionIds: string[];
            storeIds: string[];
          };
          readScope?: {
            companyIds: string[];
            regionIds: string[];
            storeIds: string[];
          };
          actionScope?: {
            assignedStoreIds: string[];
          };
          assignedStoreIds?: string[];
        }
      | undefined;

    if (!user) {
      throw new ForbiddenException("Missing authenticated user context");
    }

    if (requiredScope && requiredScope !== "authenticated") {
      this.assertReadScope({
        request,
        requiredScope,
        readScope: user.readScope ?? user.scope,
      });
    }

    const requiredActionScope = this.reflector.getAllAndOverride<RequiredActionScope>(
      REQUIRED_ACTION_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredActionScope && requiredActionScope !== "authenticated") {
      this.assertActionScope({
        request,
        requiredActionScope,
        assignedStoreIds: user.actionScope?.assignedStoreIds ?? user.assignedStoreIds ?? [],
      });
    }

    return true;
  }

  private assertReadScope(input: {
    request: { query: Record<string, unknown>; body?: Record<string, unknown> };
    requiredScope: RequiredScope;
    readScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  }) {
    if (input.requiredScope === "company") {
      if (input.readScope.companyIds.length === 0) {
        throw new ForbiddenException("Missing company read scope");
      }

      return;
    }

    const scopeId =
      input.requiredScope === "region"
        ? input.request.query.regionId ?? input.request.body?.regionId
        : input.request.query.storeId ?? input.request.body?.storeId;

    if (!scopeId) {
      throw new ForbiddenException(`Missing ${input.requiredScope} scope identifier`);
    }

    const allowed =
      input.requiredScope === "region"
        ? input.readScope.regionIds.includes(String(scopeId))
        : input.readScope.storeIds.includes(String(scopeId));

    if (!allowed) {
      throw new ForbiddenException(`Out-of-scope ${input.requiredScope} access`);
    }
  }

  private assertActionScope(input: {
    request: { query: Record<string, unknown>; body?: Record<string, unknown> };
    requiredActionScope: RequiredActionScope;
    assignedStoreIds: string[];
  }) {
    const scopeId = input.request.query.storeId ?? input.request.body?.storeId;

    if (!scopeId) {
      throw new ForbiddenException("Missing store action scope identifier");
    }

    if (!input.assignedStoreIds.includes(String(scopeId))) {
      throw new ForbiddenException("Out-of-scope store action");
    }
  }
}
