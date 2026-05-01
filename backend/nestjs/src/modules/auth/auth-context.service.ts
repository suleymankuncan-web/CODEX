import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
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
    input.actionScope?.assignedStoreIds ?? input.assignedStoreIds ?? readScope.storeIds,
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
  ) {}

  async resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    const user = await (async () => {
      switch (this.appConfigService.authMode) {
      case "jwt":
        return this.jwtAuthProvider.resolveUser(request);
      case "mock":
        if (!this.appConfigService.allowMockAuth) {
          throw new UnauthorizedException("Mock auth is disabled");
        }
        return this.mockAuthProvider.resolveUser(request);
      default:
        throw new UnauthorizedException("Unsupported auth mode");
      }
    })();

    if (!user) {
      return null;
    }

    const providerUser = buildAuthenticatedUser(user);
    let appUser = providerUser;

    let assignments: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveRoleAssignments"]>
    > = [];
    let actionStoreAssignments: Awaited<
      ReturnType<AuthAuthorizationRepository["getActiveActionStoreAssignments"]>
    > = [];

    try {
      if (
        this.appConfigService.authMode === "jwt" &&
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
          `Failing closed because authorization lookup failed for user ${providerUser.userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw new ServiceUnavailableException("Authorization context is unavailable");
      }

      this.logger.warn(
        `Falling back to provider auth context because role assignment lookup failed for user ${providerUser.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
}
