import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ManagedSessionService } from "../managed-session/managed-session.service";
import { assertBrowserSessionOrigin } from "../browser-session-origin";
import { CreateOidcBrowserSessionDto } from "./dto/create-oidc-browser-session.dto";
import { Public } from "../decorators/public.decorator";

@Controller("auth")
export class AuthSessionController {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly authContextService: AuthContextService,
    private readonly browserSessionService: BrowserSessionService,
    private readonly managedSessionService?: ManagedSessionService,
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
        managedBrowserSession: Boolean(this.appConfigService.managedBrowserSessionEnabled),
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

  @Public()
  @Post("browser-session/oidc")
  @HttpCode(HttpStatus.OK)
  async createOidcBrowserSession(
    @Body() input: CreateOidcBrowserSessionDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string | string[]): void },
  ) {
    if (!this.appConfigService.managedBrowserSessionEnabled || !this.managedSessionService) {
      throw new NotFoundException("Managed browser session transport is disabled");
    }
    const origin = assertBrowserSessionOrigin(request.headers, this.appConfigService.corsAllowedOrigins);
    if (input.redirectUri !== new URL(this.appConfigService.authCallbackPath, origin).toString()) {
      throw new BadRequestException("Invalid login callback");
    }
    const issued = await this.managedSessionService.create(input,
      (token) => this.authContextService.resolveJwtBearerToken(token, true),
      async (cookieValue) => {
        const user = await this.authContextService.resolveUser({ headers: {
          cookie: `${this.appConfigService.browserSessionCookieName}=${encodeURIComponent(cookieValue)}`,
        } });
        if (!user) throw new UnauthorizedException("Invalid browser session");
        return user;
      });
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Set-Cookie", serializeBrowserSessionCookie({
      httpOnly: true, maxAgeSeconds: Math.max(0, Math.floor((Date.parse(issued.expiresAt) - Date.now()) / 1000)),
      name: this.appConfigService.browserSessionCookieName,
      sameSite: this.appConfigService.browserSessionSameSite,
      secure: this.appConfigService.browserSessionCookieSecure, value: issued.cookieValue,
    }));
    return { csrfToken: issued.csrfNonce, expiresAt: issued.expiresAt,
      sessionId: issued.sessionId, session: this.buildSessionResponse(issued.user) };
  }

  @Post("browser-session/csrf")
  @HttpCode(HttpStatus.OK)
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
  async clearBrowserSession(
    @Res({ passthrough: true })
    response: {
      setHeader(name: string, value: string | string[]): void;
    },
    @Req() request?: { headers: Record<string, string | string[] | undefined> },
  ) {
    if (request) {
      const cookieValue = parseCookieHeader(request.headers.cookie)[this.appConfigService.browserSessionCookieName];
      if (cookieValue && this.appConfigService.managedBrowserSessionEnabled) {
        let envelope;
        try { envelope = this.browserSessionService.verifySession(cookieValue).envelope; }
        catch { /* An expired cookie has no active app session to revoke. */ }
        if (envelope?.v === 2) {
          assertBrowserSessionOrigin(request.headers, this.appConfigService.corsAllowedOrigins);
          if (!this.managedSessionService) throw new UnauthorizedException("Invalid browser session");
          await this.managedSessionService.revoke(envelope);
        }
      }
    }
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
        roleScopes: user.roleScopes ?? {},
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
