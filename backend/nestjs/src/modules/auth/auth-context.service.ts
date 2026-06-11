import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import { redactSensitiveLogValue } from "../../shared/structured-log";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { BrowserSessionService } from "./browser-session.service";
import { parseCookieHeader } from "./browser-session-cookie";
import { JwtAuthProvider } from "./providers/jwt-auth.provider";
import { MockAuthProvider } from "./providers/mock-auth.provider";

export interface AuthenticatedUser {
  userId: string;
  employeeId?: string;
  roleCodes: string[];
  scope: AuthReadScope;
  readScope: AuthReadScope;
  actionScope: AuthActionScope;
  assignedStoreIds: string[];
}

export interface AuthReadScope {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
}

export interface AuthActionScope {
  assignedStoreIds: string[];
}

export function buildAuthenticatedUser(input: {
  userId: string;
  employeeId?: string;
  roleCodes: string[];
  scope?: AuthReadScope;
  readScope?: AuthReadScope;
  actionScope?: AuthActionScope;
  assignedStoreIds?: string[];
}): AuthenticatedUser {
  const readScope = normalizeReadScope(input.readScope ?? input.scope);
  const assignedStoreIds = uniqueStrings(
    input.actionScope?.assignedStoreIds ?? input.assignedStoreIds ?? [],
  );

  return {
    userId: input.userId,
    employeeId: input.employeeId,
    roleCodes: uniqueStrings(input.roleCodes),
    scope: readScope,
    readScope,
    actionScope: {
      assignedStoreIds,
    },
    assignedStoreIds,
  };
}

function normalizeReadScope(scope?: AuthReadScope): AuthReadScope {
  return {
    companyIds: uniqueStrings(scope?.companyIds ?? []),
    regionIds: uniqueStrings(scope?.regionIds ?? []),
    storeIds: uniqueStrings(scope?.storeIds ?? []),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

@Injectable()
export class AuthContextService {
  private readonly logger = new Logger(AuthContextService.name);

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly authAuthorizationRepository: AuthAuthorizationRepository,
    private readonly mockAuthProvider: MockAuthProvider,
    private readonly jwtAuthProvider: JwtAuthProvider,
    private readonly browserSessionService?: BrowserSessionService,
  ) {}

  async resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    const providerUser = await (async () => {
      const bearerUser = await this.resolveBearerUser(request);
      if (bearerUser) {
        return {
          mapProviderSubject: this.appConfigService.authMode === "jwt",
          user: bearerUser,
        };
      }

      const browserSessionUser = this.resolveBrowserSessionUser(request);
      if (browserSessionUser) {
        return {
          mapProviderSubject: false,
          user: browserSessionUser,
        };
      }

      switch (this.appConfigService.authMode) {
      case "mock":
        if (!this.appConfigService.allowMockAuth) {
          throw new UnauthorizedException("Mock auth is disabled");
        }
        return {
          mapProviderSubject: false,
          user: await this.mockAuthProvider.resolveUser(request),
        };
      case "jwt":
        return {
          mapProviderSubject: true,
          user: null,
        };
      default:
        throw new UnauthorizedException("Unsupported auth mode");
      }
    })();

    if (!providerUser.user) {
      return null;
    }

    return this.resolveAuthorizationContext(
      buildAuthenticatedUser(providerUser.user),
      providerUser.mapProviderSubject,
    );
  }

  async resolveJwtBearerToken(token: string): Promise<AuthenticatedUser> {
    if (this.appConfigService.authMode !== "jwt") {
      throw new UnauthorizedException("Unsupported auth mode");
    }

    return this.resolveAuthorizationContext(
      await this.jwtAuthProvider.resolveBearerToken(token),
      true,
    );
  }

  private async resolveBearerUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    if (this.appConfigService.authMode !== "jwt") {
      return null;
    }

    return this.jwtAuthProvider.resolveUser(request);
  }

  private resolveBrowserSessionUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): AuthenticatedUser | null {
    if (!this.appConfigService.browserSessionCookieEnabled) {
      return null;
    }

    if (!this.browserSessionService) {
      throw new UnauthorizedException("Invalid browser session");
    }

    const cookies = parseCookieHeader(request.headers.cookie);
    const cookieValue = cookies[this.appConfigService.browserSessionCookieName];
    if (!cookieValue) {
      return null;
    }

    return this.browserSessionService.verifySession(cookieValue).user;
  }

  private async resolveAuthorizationContext(
    providerUser: AuthenticatedUser,
    mapProviderSubject: boolean,
  ): Promise<AuthenticatedUser> {
    let appUser = providerUser;

    let assignments: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveRoleAssignments"]>
    > = [];
    let actionStoreAssignments: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveActionStoreAssignments"]>
    > = [];

    try {
      if (
        mapProviderSubject &&
        providerUser.userId !== "unknown-user"
      ) {
        const mappedUser =
          await this.authAuthorizationRepository.getUserAccountByProviderSubject({
            authProvider: this.appConfigService.authProviderKey ?? "oidc",
            providerSubject: providerUser.userId,
          });

        if (mappedUser) {
          if (!mappedUser.is_active) {
            throw new UnauthorizedException("User account is inactive");
          }

          appUser = buildAuthenticatedUser({
            ...providerUser,
            userId: mappedUser.user_id,
            employeeId: mappedUser.employee_id ?? providerUser.employeeId,
          });
        } else if (this.appConfigService.isProduction) {
          throw new UnauthorizedException("User account is not mapped");
        }
      }

      assignments = await this.authAuthorizationRepository.getActiveRoleAssignments(appUser.userId);
      actionStoreAssignments =
        await this.authAuthorizationRepository.getActiveActionStoreAssignments(appUser.userId);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (this.appConfigService.isProduction) {
        this.logger.error(
          `Failing closed because authorization lookup failed for provider user: ${this.safeErrorMessage(error)}`,
        );
        throw new ServiceUnavailableException("Authorization context is unavailable");
      }

      this.logger.warn(
        `Falling back to provider auth context because role assignment lookup failed for provider user: ${this.safeErrorMessage(error)}`,
      );
      return providerUser;
    }

    const assignedStoreIds = uniqueStrings([
      ...assignments
        .map((assignment) => assignment.store_id)
        .filter((value): value is string => Boolean(value)),
      ...actionStoreAssignments.map((assignment) => assignment.store_id),
    ]);

    if (assignments.length === 0) {
      if (
        this.appConfigService.authMode === "jwt" &&
        this.appConfigService.isProduction
      ) {
        throw new UnauthorizedException(
          "User account has no active role assignments",
        );
      }

      if (assignedStoreIds.length > 0) {
        return buildAuthenticatedUser({
          ...appUser,
          actionScope: {
            assignedStoreIds,
          },
        });
      }

      return appUser;
    }

    const readScope = {
      companyIds: [
        ...new Set(
          assignments
            .map((assignment) => assignment.company_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      regionIds: [
        ...new Set(
          assignments
            .map((assignment) => assignment.region_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      storeIds: [
        ...new Set(
          assignments
            .map((assignment) => assignment.store_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
    };

    return buildAuthenticatedUser({
      ...appUser,
      roleCodes: [...new Set(assignments.map((assignment) => assignment.role_code))],
      readScope,
      actionScope: {
        assignedStoreIds,
      },
    });
  }

  private safeErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return String(redactSensitiveLogValue(message));
  }
}
