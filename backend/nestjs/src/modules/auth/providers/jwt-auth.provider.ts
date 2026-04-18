import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from "jose";
import { AppConfigService } from "../../../shared/app-config.service";
import { AuthenticatedUser } from "../auth-context.service";
import { AuthProvider } from "../interfaces/auth-provider.interface";

@Injectable()
export class JwtAuthProvider implements AuthProvider {
  private jwksResolver: JWTVerifyGetKey | null = null;
  private jwksUrl: string | null = null;

  constructor(private readonly appConfigService: AppConfigService) {}

  async resolveUser(request: {
    headers: Record<string, string | string[] | undefined>;
  }): Promise<AuthenticatedUser | null> {
    const authHeader = request.headers["authorization"];
    const bearer = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!bearer || !bearer.startsWith("Bearer ")) {
      return null;
    }

    const token = bearer.slice("Bearer ".length);
    const verification = await this.verifyToken(token);

    const payload = verification.payload;

    const parseScope = (field: unknown): string[] => {
      if (!field) return [];
      if (Array.isArray(field)) {
        return field.map(String);
      }
      return String(field)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    };

    return {
      userId: String(payload.sub),
      employeeId: payload["employee_id"] ? String(payload["employee_id"]) : undefined,
      roleCodes: parseScope(payload["roles"]),
      scope: {
        companyIds: parseScope(payload["company_ids"]),
        regionIds: parseScope(payload["region_ids"]),
        storeIds: parseScope(payload["store_ids"]),
      },
    };
  }

  private async verifyToken(token: string) {
    try {
      const options = {
        issuer: this.appConfigService.jwtIssuer,
        audience: this.appConfigService.jwtAudience,
      };

      if (this.appConfigService.jwtJwksUrl) {
        return await jwtVerify(token, this.getRemoteJwksResolver(), options);
      }

      return await jwtVerify(token, new TextEncoder().encode(this.appConfigService.jwtSecret), options);
    } catch {
      throw new UnauthorizedException("Invalid JWT");
    }
  }

  private getRemoteJwksResolver(): JWTVerifyGetKey {
    if (!this.appConfigService.jwtJwksUrl) {
      throw new UnauthorizedException("JWT JWKS URL is not configured");
    }

    if (!this.jwksResolver || this.jwksUrl !== this.appConfigService.jwtJwksUrl) {
      this.jwksResolver = createRemoteJWKSet(new URL(this.appConfigService.jwtJwksUrl));
      this.jwksUrl = this.appConfigService.jwtJwksUrl;
    }

    return this.jwksResolver;
  }
}
