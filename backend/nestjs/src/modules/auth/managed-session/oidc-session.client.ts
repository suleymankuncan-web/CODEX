import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import { JwtAuthProvider } from "../providers/jwt-auth.provider";

@Injectable()
export class OidcSessionClient {
  constructor(private readonly config: AppConfigService, private readonly jwt: JwtAuthProvider) {}

  async grant(parameters: Record<string, string>) {
    const tokenUrl = this.config.authSessionTokenUrl;
    if (!tokenUrl || !this.config.authClientId) throw new ServiceUnavailableException("Session provider is unavailable");
    let response: Response;
    try {
      response = await fetch(tokenUrl, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(8_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ ...parameters, client_id: this.config.authClientId }),
      });
    } catch { throw new ServiceUnavailableException("Session provider is temporarily unavailable"); }
    if (!response.ok) {
      // Never propagate provider bodies, credentials or detailed grant errors.
      if (response.status === 400 || response.status === 401) throw new UnauthorizedException("Provider session has ended");
      throw new ServiceUnavailableException("Session provider is temporarily unavailable");
    }
    let payload: { access_token?: unknown; refresh_token?: unknown };
    try { payload = await response.json(); }
    catch { throw new ServiceUnavailableException("Session provider response is unavailable"); }
    if (!payload || typeof payload !== "object" || typeof payload.access_token !== "string" || typeof payload.refresh_token !== "string" ||
      !payload.access_token || !payload.refresh_token) throw new ServiceUnavailableException("Session provider response is unavailable");
    const identity = await this.jwt.resolveVerifiedIdentity(payload.access_token);
    return { accessToken: payload.access_token, refreshToken: payload.refresh_token, ...identity };
  }
}
