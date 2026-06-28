import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from "jose";
import { AppConfigService } from "../../../shared/app-config.service";
import { redactSensitiveLogValue } from "../../../shared/structured-log";
import { AuthenticatedUser, buildAuthenticatedUser } from "../auth-context.service";
import { AuthProvider } from "../interfaces/auth-provider.interface";

const APP_ROLE_CODES = new Set([
  "AUDITOR",
  "HR_ADMIN",
  "INTEGRATION_ADMIN",
  "REGION_MANAGER",
  "REPORT_VIEWER",
  "SNAPSHOT_OPERATOR",
  "STORE_MANAGER",
  "STORE_PERSONNEL",
  "SUPER_ADMIN",
  "VISUAL_MERCHANDISER",
]);

@Injectable()
export class JwtAuthProvider implements AuthProvider {
  private readonly logger = new Logger(JwtAuthProvider.name);
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

    return this.resolveBearerToken(bearer.slice("Bearer ".length));
  }

  async resolveBearerToken(token: string): Promise<AuthenticatedUser> {
    const verification = await this.verifyToken(token);

    const payload = verification.payload;
    if (
      this.appConfigService.isProduction &&
      (typeof payload.sub !== "string" || payload.sub.length === 0)
    ) {
      throw new UnauthorizedException("JWT subject claim is required");
    }

    const userInfo = await this.resolveUserInfo(token, payload);

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

    const parseKeycloakRoles = (): string[] => {
      const explicitRoles = parseScope(payload["roles"]);
      const realmRoles =
        typeof payload["realm_access"] === "object" && payload["realm_access"] !== null
          ? parseScope((payload["realm_access"] as Record<string, unknown>).roles)
          : [];
      const clientId = this.appConfigService.authClientId;
      const resourceRoles =
        clientId &&
        typeof payload["resource_access"] === "object" &&
        payload["resource_access"] !== null
          ? parseScope(
              ((payload["resource_access"] as Record<string, unknown>)[clientId] as
                | Record<string, unknown>
                | undefined)?.roles,
            )
          : [];

      return [...new Set([...explicitRoles, ...realmRoles, ...resourceRoles])]
        .filter((role) => APP_ROLE_CODES.has(role));
    };

    const roleCodes = parseKeycloakRoles();
    const parseReadScopeClaim = (newField: string, legacyField: string): string[] =>
      payload[newField] === undefined ? parseScope(payload[legacyField]) : parseScope(payload[newField]);
    const companyIds = parseReadScopeClaim("read_company_ids", "company_ids");
    const regionIds = parseReadScopeClaim("read_region_ids", "region_ids");
    const storeIds = parseReadScopeClaim("read_store_ids", "store_ids");
    const assignedStoreIds =
      payload["assigned_store_ids"] === undefined
        ? []
        : parseScope(payload["assigned_store_ids"]);
    const resolvedUserId =
      typeof payload.sub === "string"
        ? payload.sub
        : userInfo?.sub ?? userInfo?.preferredUsername ?? "unknown-user";

    return buildAuthenticatedUser({
      userId: resolvedUserId,
      employeeId: payload["employee_id"] ? String(payload["employee_id"]) : undefined,
      displayName: userInfo?.name,
      username: userInfo?.preferredUsername,
      email: userInfo?.email,
      roleCodes,
      readScope: {
        companyIds,
        regionIds,
        storeIds,
      },
      actionScope: {
        assignedStoreIds,
      },
    });
  }

  private async verifyToken(token: string) {
    try {
      const audiences = [
        this.appConfigService.jwtAudience,
        this.appConfigService.authClientId,
      ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

      const options = {
        issuer: this.appConfigService.jwtIssuer,
      };

      const [, payloadSegment] = token.split(".");
      const decodedPayload =
        payloadSegment && payloadSegment.length > 0
          ? JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as {
              aud?: string | string[];
              exp?: number;
            }
          : {};

      if (this.appConfigService.isProduction && decodedPayload.aud === undefined) {
        throw new Error("JWT audience claim is required in production");
      }

      if (this.appConfigService.isProduction && typeof decodedPayload.exp !== "number") {
        throw new Error("JWT expiration claim is required in production");
      }

      const verificationOptions =
        decodedPayload.aud === undefined
          ? options
          : {
              ...options,
              audience: audiences,
            };

      if (this.appConfigService.jwtJwksUrl) {
        return await jwtVerify(token, this.getRemoteJwksResolver(), verificationOptions);
      }

      return await jwtVerify(
        token,
        new TextEncoder().encode(this.appConfigService.jwtSecret),
        verificationOptions,
      );
    } catch (error) {
      this.logger.warn(
        `JWT verification failed: ${String(
          redactSensitiveLogValue(error instanceof Error ? error.message : String(error)),
        )}`,
      );
      throw new UnauthorizedException("Invalid JWT");
    }
  }

  private async resolveUserInfo(
    token: string,
    payload: { email?: unknown; iss?: unknown; name?: unknown; sub?: unknown; preferred_username?: unknown },
  ): Promise<{ email?: string; name?: string; sub?: string; preferredUsername?: string } | null> {
    if (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.preferred_username === "string" &&
      payload.preferred_username.length > 0
    ) {
      return {
        email: typeof payload.email === "string" ? payload.email : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        sub: payload.sub,
        preferredUsername: payload.preferred_username,
      };
    }

    if (typeof payload.iss !== "string" || payload.iss.length === 0) {
      return null;
    }

    try {
      const response = await fetch(`${payload.iss}/protocol/openid-connect/userinfo`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const userInfo = (await response.json()) as {
        email?: unknown;
        name?: unknown;
        sub?: unknown;
        preferred_username?: unknown;
      };

      return {
        email: typeof userInfo.email === "string" ? userInfo.email : undefined,
        name: typeof userInfo.name === "string" ? userInfo.name : undefined,
        sub: typeof userInfo.sub === "string" ? userInfo.sub : undefined,
        preferredUsername:
          typeof userInfo.preferred_username === "string"
            ? userInfo.preferred_username
            : undefined,
      };
    } catch {
      return null;
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
