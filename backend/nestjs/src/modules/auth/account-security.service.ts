import { Injectable } from "@nestjs/common";
import { AccountSecurityRepository } from "./account-security.repository";

@Injectable()
export class AccountSecurityService {
  constructor(private readonly repository: AccountSecurityRepository) {}
  async read(userId: string) {
    const { account, links } = await this.repository.read(userId);
    const timestamp = (value: unknown) => value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
    return { passwordState: account.password_state ?? "unknown", passwordSetAt: timestamp(account.password_set_at),
      observedAt: timestamp(account.observed_at), lastLoginAt: timestamp(account.last_login_at), lastActiveAt: timestamp(account.last_active_at),
      requests: links.map(link => ({ requestId: link.request_id, kind: link.kind,
        state: ["sent", "unconfirmed"].includes(link.state) && link.tracking_expires_at && link.tracking_expires_at.getTime() < Date.now()
          ? "expired" : link.state,
        requestedAt: timestamp(link.requested_at), sentAt: timestamp(link.sent_at), expiresAt: timestamp(link.tracking_expires_at),
        completedObservedAt: timestamp(link.completed_observed_at), verifiedPasswordSetAt: timestamp(link.verified_password_set_at), errorCode: link.error_code })) };
  }
  enqueue(input: Parameters<AccountSecurityRepository["enqueue"]>[0]) { return this.repository.enqueue(input); }
  activity(userId: string) { return this.repository.activity(userId); }
}
