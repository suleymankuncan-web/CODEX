import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import type { IdentityUserSnapshot } from "./identity-lifecycle.repository";

type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
  attributes?: Record<string, string[]>;
};
type KeycloakRole = { id: string; name: string };

const MANAGED_REALM_ROLES = [
  "SUPER_ADMIN",
  "REPORT_VIEWER",
  "STORE_MANAGER",
  "STORE_PERSONNEL",
  "REGION_MANAGER",
  "AUDITOR",
  "HR_ADMIN",
  "INTEGRATION_ADMIN",
  "SNAPSHOT_OPERATOR",
  "VISUAL_MERCHANDISER",
];

@Injectable()
export class KeycloakAdminClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfigService) {}

  get configured() {
    return Boolean(this.config.keycloakAdminBaseUrl && this.config.keycloakAdminClientSecret);
  }

  async provision(user: IdentityUserSnapshot): Promise<string> {
    const existing = await this.findExactUser(user.username);
    if (existing && existing.email?.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("keycloak_username_conflict");
    }
    if (existing && existing.attributes?.hr_axis_user_id?.[0] !== user.user_id) {
      throw new Error("keycloak_identity_owner_conflict");
    }
    const subject = existing?.id ?? await this.createDisabledUser(user);
    await this.updateUser(subject, user, true);
    await this.replaceRealmRoles(subject, user.role_codes);
    await this.sendSetupEmail(subject);
    return subject;
  }

  async enable(subject: string, user: IdentityUserSnapshot) {
    await this.updateUser(subject, user, true);
    await this.replaceRealmRoles(subject, user.role_codes);
  }

  async disable(subject: string) {
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/logout`, {
      method: "POST",
    });
  }

  private async createDisabledUser(user: IdentityUserSnapshot) {
    const response = await this.request(`/admin/realms/${this.realm}/users`, {
      method: "POST",
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? undefined,
        lastName: user.last_name ?? undefined,
        enabled: false,
        emailVerified: false,
        requiredActions: ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
        attributes: { hr_axis_user_id: [user.user_id] },
      }),
    });
    const location = response.headers.get("location") ?? "";
    const subject = location.split("/").pop();
    if (!subject) throw new Error("keycloak_create_missing_subject");
    return subject;
  }

  private async updateUser(subject: string, user: IdentityUserSnapshot, enabled: boolean) {
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? undefined,
        lastName: user.last_name ?? undefined,
        enabled,
        attributes: {
          hr_axis_user_id: [user.user_id],
          employee_id: user.employee_id ? [user.employee_id] : [],
          company_ids: user.company_ids,
          region_ids: user.region_ids,
          store_ids: user.store_ids,
          read_company_ids: user.company_ids,
          read_region_ids: user.region_ids,
          read_store_ids: user.store_ids,
          assigned_store_ids: user.assigned_store_ids,
        },
      }),
    });
  }

  private async replaceRealmRoles(subject: string, roleCodes: string[]) {
    const current = await this.json<KeycloakRole[]>(
      `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
    );
    const stale = current.filter((role) => MANAGED_REALM_ROLES.includes(role.name) && !roleCodes.includes(role.name));
    if (stale.length > 0) {
      await this.request(
        `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
        { method: "DELETE", body: JSON.stringify(stale) },
      );
    }
    const missing = roleCodes.filter((code) => !current.some((role) => role.name === code));
    if (missing.length === 0) return;
    const roles = await Promise.all(missing.map((code) => this.json<KeycloakRole>(
      `/admin/realms/${this.realm}/roles/${encodeURIComponent(code)}`,
    )));
    await this.request(
      `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
      { method: "POST", body: JSON.stringify(roles) },
    );
  }

  private async sendSetupEmail(subject: string) {
    const publicOrigin = this.config.corsAllowedOrigins[0];
    const query = new URLSearchParams({
      client_id: this.config.authClientId ?? "store-ops-admin-web",
      redirect_uri: `${publicOrigin}/auth/callback`,
      lifespan: "86400",
    });
    await this.request(
      `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/execute-actions-email?${query}`,
      { method: "PUT", body: JSON.stringify(["VERIFY_EMAIL", "UPDATE_PASSWORD"]) },
    );
  }

  private async findExactUser(username: string) {
    const query = new URLSearchParams({ username, exact: "true", max: "2" });
    const users = await this.json<KeycloakUser[]>(`/admin/realms/${this.realm}/users?${query}`);
    if (users.length > 1) throw new Error("keycloak_username_ambiguous");
    return users[0] ?? null;
  }

  private async json<T>(path: string): Promise<T> {
    return (await (await this.request(path)).json()) as T;
  }

  private async request(path: string, init: RequestInit = {}) {
    const baseUrl = this.config.keycloakAdminBaseUrl;
    if (!baseUrl || !this.config.keycloakAdminClientSecret) {
      throw new Error("keycloak_admin_not_configured");
    }
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.token()}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`keycloak_http_${response.status}`);
    return response;
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 10_000) return this.accessToken.value;
    const baseUrl = this.config.keycloakAdminBaseUrl;
    const secret = this.config.keycloakAdminClientSecret;
    if (!baseUrl || !secret) throw new Error("keycloak_admin_not_configured");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.keycloakAdminClientId,
      client_secret: secret,
    });
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/realms/${this.realm}/protocol/openid-connect/token`,
      { method: "POST", body, signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(`keycloak_token_http_${response.status}`);
    const payload = await response.json() as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("keycloak_token_missing");
    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(30, payload.expires_in ?? 60) * 1000,
    };
    return this.accessToken.value;
  }

  private get realm() {
    return encodeURIComponent(this.config.keycloakAdminRealm);
  }
}
