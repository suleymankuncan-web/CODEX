import { createHash, randomBytes } from "node:crypto";
import { Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AppConfigService } from "../../../shared/app-config.service";
import type { AuthenticatedUser } from "../auth-context.service";
import { BrowserSessionService, type BrowserSessionEnvelope } from "../browser-session.service";
import { decryptRefreshToken, encryptRefreshToken } from "./managed-session-crypto";
import { ManagedSessionRepository, type ManagedSessionRow } from "./managed-session.repository";
import { OidcSessionClient } from "./oidc-session.client";

@Injectable()
export class ManagedSessionService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  private cleaning = false;
  constructor(private readonly config: AppConfigService,
    private readonly repository: ManagedSessionRepository,
    private readonly oidc: OidcSessionClient,
    private readonly browser: BrowserSessionService) {}

  onModuleInit() {
    if (!this.config.managedBrowserSessionEnabled) return;
    this.cleanupTimer = setInterval(() => {
      if (this.cleaning) return;
      this.cleaning = true;
      void this.repository.purgeExpired().catch(() => undefined).finally(() => { this.cleaning = false; });
    }, 60_000);
    this.cleanupTimer.unref();
  }
  onModuleDestroy() { if (this.cleanupTimer) clearInterval(this.cleanupTimer); }

  async create(input: { code: string; codeVerifier: string; state: string; redirectUri: string },
    resolveUser: (token: string) => Promise<AuthenticatedUser>,
    resolveReplay: (cookie: string) => Promise<AuthenticatedUser>) {
    const fingerprint = createHash("sha256").update(JSON.stringify({ code: input.code, codeVerifier: input.codeVerifier,
      state: input.state, redirectUri: input.redirectUri })).digest("hex");
    const claim = await this.repository.claim(randomBytes(16).toString("base64url"), fingerprint,
      this.config.managedBrowserSessionMaxSeconds);
    const row = claim.row;
    if (!row || row.expires_at.getTime() <= Date.now() || row.status === "revoked") throw new UnauthorizedException("Login attempt has ended");
    if (!claim.owned) {
      if (Date.now() - row.created_at.getTime() > 600_000) throw new UnauthorizedException("Login attempt has ended");
      if (row.status === "creating") {
        if (Date.now() - row.created_at.getTime() > 30_000) throw new UnauthorizedException("Restart login to continue");
        throw new ServiceUnavailableException("Login is still being confirmed");
      }
      const issued = this.issue(row, this.identityUser(row.user_id!));
      const user = await resolveReplay(issued.cookieValue);
      return { ...this.issue(row, user), user, created: false };
    }
    try {
      const grant = await this.oidc.grant({ grant_type: "authorization_code", code: input.code,
        code_verifier: input.codeVerifier, redirect_uri: input.redirectUri });
      const user = await resolveUser(grant.accessToken);
      const active = await this.repository.activate(row.session_id, user.userId, grant.issuer, grant.subject,
        this.encrypt(grant.refreshToken, row.session_id), grant.expiresAt, this.config.authProviderKey ?? "oidc");
      if (!active) throw new UnauthorizedException("Login attempt has ended");
      return { ...this.issue(active, user), user, created: true };
    } catch (error) {
      // An indeterminate provider/DB outcome must never exchange the consumed code again.
      // Keep a durable claim. A committed activation is recoverable on a duplicate callback.
      if (error instanceof UnauthorizedException) await this.repository.revoke(row.session_id);
      throw error;
    }
  }

  async verify(envelope: BrowserSessionEnvelope, forceRefresh = false) {
    const requestedAt = Date.now();
    if (!this.config.managedBrowserSessionEnabled || envelope.v !== 2) throw new UnauthorizedException("Invalid browser session");
    try {
      const result = await this.repository.withLocked(envelope.sid, async (row, client) => {
        if (!row || row.status !== "active" || row.user_id !== envelope.user.userId ||
          !row.account_active || row.account_provider !== (this.config.authProviderKey ?? "oidc") ||
          row.account_subject !== row.subject || row.issuer !== this.config.jwtIssuer ||
          Math.floor(row.created_at.getTime() / 1000) !== envelope.iat ||
          Math.floor(row.expires_at.getTime() / 1000) !== envelope.exp || row.expires_at.getTime() <= Date.now()) return false;
        if (row.access_expires_at!.getTime() > Date.now() + 30_000 &&
          (!forceRefresh || row.refreshed_at.getTime() >= requestedAt - 1000)) return true;
        try {
          const grant = await this.oidc.grant({ grant_type: "refresh_token", refresh_token: this.decrypt(row) });
          if (grant.issuer !== row.issuer || grant.subject !== row.subject) throw new UnauthorizedException("Invalid browser session");
          await client.query(`UPDATE ops.managed_browser_session SET refresh_ciphertext=$2,
            access_expires_at=to_timestamp($3),refreshed_at=clock_timestamp() WHERE session_id=$1`,
          [row.session_id, this.encrypt(grant.refreshToken, row.session_id), grant.expiresAt]);
          return true;
        } catch (error) {
          if (!(error instanceof UnauthorizedException)) throw error;
          await client.query("UPDATE ops.managed_browser_session SET status='revoked',refresh_ciphertext=NULL WHERE session_id=$1", [row.session_id]);
          return false; // Commit revocation before returning an authentication failure.
        }
      });
      if (!result) throw new UnauthorizedException("Provider session has ended");
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Browser session is temporarily unavailable");
    }
  }

  async revoke(envelope: BrowserSessionEnvelope) {
    if (envelope.v === 2) await this.repository.revoke(envelope.sid);
  }

  private issue(row: ManagedSessionRow, user: AuthenticatedUser) {
    return this.browser.issueManagedSession(user, row.session_id, row.created_at.getTime(), row.expires_at.getTime());
  }
  private encrypt(token: string, sid: string) {
    const secret = this.config.browserSessionSecret;
    if (!secret) throw new ServiceUnavailableException("Browser session configuration is unavailable");
    return encryptRefreshToken(token, sid, secret);
  }
  private decrypt(row: ManagedSessionRow) {
    return decryptRefreshToken(row.refresh_ciphertext!, row.session_id,
      [this.config.browserSessionSecret, this.config.browserSessionPreviousSecret].filter((value): value is string => Boolean(value)));
  }
  private identityUser(userId: string): AuthenticatedUser {
    const scope = { companyIds: [], regionIds: [], storeIds: [] };
    return { userId, roleCodes: [], scope, readScope: scope, actionScope: { assignedStoreIds: [] }, assignedStoreIds: [] };
  }
}
