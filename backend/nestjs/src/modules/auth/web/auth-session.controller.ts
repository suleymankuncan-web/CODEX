import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { buildAuthorizationContextVersion } from "../authorization-context-version";
import { AppConfigService } from "../../../shared/app-config.service";
import { AuthContextService, AuthenticatedUser } from "../auth-context.service";
import { BrowserSessionService } from "../browser-session.service";
import {
  parseCookieHeader,
  serializeBrowserSessionCookie,
  serializeClearCookie,
} from "../browser-session-cookie";
import { Public } from "../decorators/public.decorator";

@Controller("auth")
export class AuthSessionController {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly authContextService: AuthContextService,
    private readonly browserSessionService: BrowserSessionService,
  ) {}

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
    return this.buildSessionResponse(request.user);
  }

  @Public()
  @Post("browser-session")
  async createBrowserSession(
    @Req()
    request: {
      headers: Record<string, string | string[] | undefined>;
    },
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string | string[]): void;
    },
  ) {
    if (!this.appConfigService.browserSessionCookieEnabled) {
      throw new NotFoundException("Browser session transport is disabled");
    }

    const bearer = resolveHeader(request.headers.authorization);
    if (!bearer?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const user = await this.authContextService.resolveJwtBearerToken(
      bearer.slice("Bearer ".length),
    );
    const issued = this.browserSessionService.issueSession(user);

    response.setHeader(
      "Set-Cookie",
      serializeBrowserSessionCookie({
        httpOnly: true,
        maxAgeSeconds: this.appConfigService.browserSessionTtlSeconds,
        name: this.appConfigService.browserSessionCookieName,
        sameSite: this.appConfigService.browserSessionSameSite,
        secure: this.appConfigService.browserSessionCookieSecure,
        value: issued.cookieValue,
      }),
    );

    return {
      csrfToken: issued.csrfNonce,
      expiresAt: issued.expiresAt,
      sessionId: issued.sessionId,
      session: this.buildSessionResponse(user),
    };
  }

  @Post("browser-session/csrf")
  recoverBrowserSessionCsrf(
    @Req()
    request: {
      headers: Record<string, string | string[] | undefined>;
      user: AuthenticatedUser;
    },
  ) {
    if (!this.appConfigService.browserSessionCookieEnabled) {
      throw new NotFoundException("Browser session transport is disabled");
    }

    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieValue = cookies[this.appConfigService.browserSessionCookieName];
    if (!cookieValue) {
      throw new UnauthorizedException("Browser session cookie is required");
    }

    const now = Date.now();
    const verified = this.browserSessionService.verifySession(cookieValue, now);
    if (!request.user || request.user.userId !== verified.user.userId) {
      throw new UnauthorizedException("Invalid browser session");
    }

    const recovered = this.browserSessionService.recoverCsrfNonce(cookieValue, now);
    return {
      csrfToken: recovered.csrfNonce,
      expiresAt: recovered.expiresAt,
      sessionId: recovered.sessionId,
    };
  }

  @Public()
  @Delete("browser-session")
  clearBrowserSession(
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string | string[]): void;
    },
  ) {
    response.setHeader("Set-Cookie", [
      serializeClearCookie({
        httpOnly: true,
        name: this.appConfigService.browserSessionCookieName,
        sameSite: this.appConfigService.browserSessionSameSite,
        secure: this.appConfigService.browserSessionCookieSecure,
      }),
      serializeClearCookie({
        httpOnly: false,
        name: this.appConfigService.browserSessionCsrfCookieName,
        sameSite: this.appConfigService.browserSessionSameSite,
        secure: this.appConfigService.browserSessionCookieSecure,
      }),
    ]);

    return {
      cleared: true,
    };
  }

  private buildSessionResponse(user: AuthenticatedUser) {
    const authMode = this.appConfigService.authMode || "mock";

    return {
      authMode,
      authenticated: Boolean(user),
      user: {
        userId: user.userId,
        employeeId: user.employeeId ?? null,
        displayName: user.displayName ?? null,
        username: user.username ?? null,
        email: user.email ?? null,
        roleCodes: user.roleCodes,
        authorizationContextVersion: buildAuthorizationContextVersion(
          user.roleScopes,
          user.permissionScopes,
        ),
        permissionScopes: user.permissionScopes ?? {},
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
          assignedStoreTypes: user.actionScope.assignedStoreTypes ?? [],
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

function resolveHeader(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}
