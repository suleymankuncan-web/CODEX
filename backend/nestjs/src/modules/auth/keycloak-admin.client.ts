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
type KeycloakAdminOperation =
  | "find_user"
  | "create_user"
  | "update_user"
  | "update_profile"
  | "disable_user"
  | "logout_user"
  | "list_role_mappings"
  | "remove_role_mappings"
  | "get_realm_role"
  | "add_role_mappings"
  | "send_setup_email";

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

  async updateProfile(subject: string, user: IdentityUserSnapshot) {
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({ username: user.username, email: user.email, emailVerified: false,
        firstName: user.first_name ?? undefined, lastName: user.last_name ?? undefined }),
    }, "update_profile");
  }

  async disable(subject: string) {
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    }, "disable_user");
    await this.request(`/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/logout`, {
      method: "POST",
    }, "logout_user");
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
    }, "create_user");
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
    }, "update_user");
  }

  private async replaceRealmRoles(subject: string, roleCodes: string[]) {
    const current = await this.json<KeycloakRole[]>(
      `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
      "list_role_mappings",
    );
    const stale = current.filter((role) => MANAGED_REALM_ROLES.includes(role.name) && !roleCodes.includes(role.name));
    if (stale.length > 0) {
      await this.request(
        `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
        { method: "DELETE", body: JSON.stringify(stale) },
        "remove_role_mappings",
      );
    }
    const missing = roleCodes.filter((code) => !current.some((role) => role.name === code));
    if (missing.length === 0) return;
    const roles = await Promise.all(missing.map((code) => this.json<KeycloakRole>(
      `/admin/realms/${this.realm}/roles/${encodeURIComponent(code)}`,
      "get_realm_role",
    )));
    await this.request(
      `/admin/realms/${this.realm}/users/${encodeURIComponent(subject)}/role-mappings/realm`,
      { method: "POST", body: JSON.stringify(roles) },
      "add_role_mappings",
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
      "send_setup_email",
    );
  }

  private async findExactUser(username: string) {
    const query = new URLSearchParams({ username, exact: "true", max: "2" });
    const users = await this.json<KeycloakUser[]>(`/admin/realms/${this.realm}/users?${query}`, "find_user");
    if (users.length > 1) throw new Error("keycloak_username_ambiguous");
    return users[0] ?? null;
  }

  private async json<T>(path: string, operation: KeycloakAdminOperation): Promise<T> {
    return (await (await this.request(path, {}, operation)).json()) as T;
  }

  private async request(path: string, init: RequestInit, operation: KeycloakAdminOperation) {
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
    if (!response.ok) {
      if (response.status !== 400) throw new Error(`keycloak_http_${response.status}`);
      const reason = await classifyKeycloakBadRequest(response);
      throw new Error(`keycloak_http_400_${operation}_${reason}`);
    }
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

// Keycloak error bodies can contain user input. Only fixed diagnostic labels are
// persisted in lifecycle jobs and logs; never include the raw body or request URL.
async function classifyKeycloakBadRequest(response: Response): Promise<string> {
  let payload: unknown;
  try {
    const body = await response.text();
    if (body.length > 4096) return "unknown";
    payload = JSON.parse(body);
  } catch {
    return "unknown";
  }

  const errors = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.errors) ? payload.errors : [];
  if (errors.length > 0) {
    const field = errors.find((entry: unknown) => isRecord(entry) && typeof entry.field === "string")?.field;
    const safeField = typeof field === "string" ? profileFieldCode(field) : null;
    return safeField ? `profile_${safeField}` : "profile_validation";
  }

  if (!isRecord(payload)) return "unknown";
  const message = typeof payload.errorMessage === "string" ? payload.errorMessage.toLowerCase() : "";
  if (message === "user name is missing") return "username_missing";
  if (message === "user exists with same username") return "username_duplicate";
  if (message === "user exists with same email") return "email_duplicate";
  if (message.includes("redirect") && message.includes("invalid")) return "invalid_redirect";
  if (message === "client not found") return "client_not_found";
  if (message === "client is not enabled") return "client_disabled";
  if (message === "user is disabled") return "user_disabled";
  if (message === "user email missing") return "email_missing";
  if (message.includes("required action") && message.includes("invalid")) return "invalid_action";
  return "unknown";
}

function profileFieldCode(field: string): string | null {
  const fields: Record<string, string> = {
    username: "username",
    email: "email",
    firstName: "first_name",
    lastName: "last_name",
    hr_axis_user_id: "owner_id",
    employee_id: "employee_id",
    company_ids: "company_ids",
    region_ids: "region_ids",
    store_ids: "store_ids",
    read_company_ids: "read_company_ids",
    read_region_ids: "read_region_ids",
    read_store_ids: "read_store_ids",
    assigned_store_ids: "assigned_store_ids",
  };
  return fields[field.replace(/^attributes\./, "")] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
