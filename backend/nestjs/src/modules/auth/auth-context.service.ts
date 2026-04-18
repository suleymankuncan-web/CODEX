import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { JwtAuthProvider } from "./providers/jwt-auth.provider";
import { MockAuthProvider } from "./providers/mock-auth.provider";

export interface AuthenticatedUser {
  userId: string;
  employeeId?: string;
  roleCodes: string[];
  scope: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  };
}

@Injectable()
export class AuthContextService {
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
      default:
        return this.mockAuthProvider.resolveUser(request);
      }
    })();

    if (!user) {
      return null;
    }

    const assignments = await this.authAuthorizationRepository.getActiveRoleAssignments(user.userId);

    if (assignments.length === 0) {
      return user;
    }

    return {
      ...user,
      roleCodes: [...new Set(assignments.map((assignment) => assignment.role_code))],
      scope: {
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
      },
    };
  }
}
