import { Injectable } from "@nestjs/common";
import { AccountSecurityRepository } from "./account-security.repository";
import { KeycloakAdminClient } from "./keycloak-admin.client";

@Injectable()
export class AccountSecurityWorkerService {
  private lastPoll = 0;
  constructor(private readonly repository: AccountSecurityRepository, private readonly provider: KeycloakAdminClient) {}

  async send(jobId: string) {
    const request = await this.repository.getLink(jobId);
    if (!request) throw new Error("password_link_missing");
    // A previous send may have succeeded before a worker/DB interruption. Never repeat it automatically.
    if (request.state !== "queued") return;
    let metadata;
    try {
      metadata = await this.provider.passwordMetadata(request.provider_subject, request.user_id, request.email);
    } catch {
      await this.repository.outcome(jobId, "failed", "observation_unavailable");
      return;
    }
    const sending = await this.repository.beginSend(jobId, metadata);
    if (!sending) {
      await this.repository.outcome(jobId, "failed", "account_changed");
      return;
    }
    try {
      await this.provider.sendPasswordLink(sending.provider_subject, sending.kind);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const definite = /^keycloak_http_(?:400_|404$)/.test(code);
      await this.repository.outcome(jobId, definite ? "failed" : "unconfirmed", definite ? "provider_rejected" : "send_unconfirmed");
      return;
    }
    await this.repository.outcome(jobId, "sent", null);
  }

  async poll() {
    if (Date.now() - this.lastPoll < 60_000) return;
    this.lastPoll = Date.now();
    const claims = await this.repository.claimObservations();
    for (const claim of claims) {
      let metadata = null;
      try { metadata = await this.provider.passwordMetadata(claim.provider_subject, claim.user_id, claim.email); }
      catch { /* Neutral unavailable observation; no provider/user payload enters logs. */ }
      await this.repository.observe(claim, metadata);
    }
  }
}
