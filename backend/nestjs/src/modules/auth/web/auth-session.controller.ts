import { Controller, Get, Req } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import { AuthenticatedUser } from "../auth-context.service";
import { Public } from "../decorators/public.decorator";

@Controller("auth")
export class AuthSessionController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Public()
  @Get("bootstrap")
  getBootstrap() {
    const responseType = this.appConfigService.authResponseType;
    const tokenUrl = this.appConfigService.authTokenUrl ?? null;
    const providerConfigured = Boolean(
      this.appConfigService.authAuthorizationUrl &&
        this.appConfigService.authClientId &&
        (responseType !== "code" || tokenUrl),
    );

    return {
      authMode: this.appConfigService.authMode || "mock",
      provider: {
        configured: providerConfigured,
        authorizationUrl:
          this.appConfigService.authAuthorizationUrl ?? null,
        clientId: this.appConfigService.authClientId ?? null,
        scope: this.appConfigService.authScope,
        responseType,
        audience: this.appConfigService.authAudienceOverride ?? null,
        callbackPath: this.appConfigService.authCallbackPath,
        tokenUrl,
        logoutUrl: this.appConfigService.authLogoutUrl ?? null,
        postLogoutRedirectPath:
          this.appConfigService.authPostLogoutRedirectPath,
      },
    };
  }

  @Get("session")
  getSession(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
  ) {
    const user = request.user;
    const authMode = this.appConfigService.authMode || "mock";

    return {
      authMode,
      authenticated: Boolean(user),
      user: {
        userId: user.userId,
        employeeId: user.employeeId ?? null,
        roleCodes: user.roleCodes,
        scope: {
          companyIds: user.scope.companyIds,
          regionIds: user.scope.regionIds,
          storeIds: user.scope.storeIds,
        },
        readScope: {
          companyIds: user.readScope.companyIds,
          regionIds: user.readScope.regionIds,
          storeIds: user.readScope.storeIds,
        },
        actionScope: {
          assignedStoreIds: user.actionScope.assignedStoreIds,
        },
        assignedStoreIds: user.assignedStoreIds,
      },
      scopeSummary: {
        companyCount: user.scope.companyIds.length,
        regionCount: user.scope.regionIds.length,
        storeCount: user.scope.storeIds.length,
        assignedStoreCount: user.assignedStoreIds.length,
      },
    };
  }
}
