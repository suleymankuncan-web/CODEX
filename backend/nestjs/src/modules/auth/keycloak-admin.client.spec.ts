import { KeycloakAdminClient } from "./keycloak-admin.client";
import type { AppConfigService } from "../../shared/app-config.service";
import type { IdentityUserSnapshot } from "./identity-lifecycle.repository";

describe("KeycloakAdminClient", () => {
  const config = {
    keycloakAdminBaseUrl: "http://keycloak:8080",
    keycloakAdminRealm: "store-ops",
    keycloakAdminClientId: "hr-axis-identity-lifecycle",
    keycloakAdminClientSecret: "test-secret",
    authClientId: "store-ops-admin-web",
    corsAllowedOrigins: ["https://hraxis.example.test"],
  } as AppConfigService;

  const user: IdentityUserSnapshot = {
    user_id: "user-1",
    employee_id: "employee-1",
    username: "ada.lovelace",
    email: "ada@example.test",
    provider_subject: null,
    is_active: false,
    first_name: "Ada",
    last_name: "Lovelace",
    role_codes: ["STORE_PERSONNEL"],
    company_ids: ["company-1"],
    region_ids: ["region-1"],
    store_ids: ["store-1"],
    assigned_store_ids: ["store-1"],
  };

  afterEach(() => jest.restoreAllMocks());

  it("creates a disabled identity, applies scope and role, then sends setup actions", async () => {
    const responses = [
      jsonResponse({ access_token: "token", expires_in: 60 }),
      jsonResponse([]),
      new Response(null, { status: 201, headers: { location: "http://keycloak/admin/realms/store-ops/users/subject-1" } }),
      new Response(null, { status: 204 }),
      jsonResponse([]),
      jsonResponse({ id: "role-1", name: "STORE_PERSONNEL" }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    ];
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => responses.shift()!);

    await expect(new KeycloakAdminClient(config).provision(user)).resolves.toBe("subject-1");

    expect(fetchMock).toHaveBeenCalledTimes(8);
    const createBody = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body));
    expect(createBody).toMatchObject({
      enabled: false,
      requiredActions: ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
      attributes: { hr_axis_user_id: ["user-1"] },
    });
    const updateBody = JSON.parse(String((fetchMock.mock.calls[3][1] as RequestInit).body));
    expect(updateBody).toMatchObject({
      enabled: true,
      attributes: {
        hr_axis_user_id: ["user-1"],
        employee_id: ["employee-1"],
        store_ids: ["store-1"],
      },
    });
    expect(String(fetchMock.mock.calls[7][0])).toContain("execute-actions-email");
  });

  it("refuses to adopt an existing Keycloak identity owned by another app user", async () => {
    const responses = [
      jsonResponse({ access_token: "token", expires_in: 60 }),
      jsonResponse([{
        id: "subject-1",
        username: user.username,
        email: user.email,
        attributes: { hr_axis_user_id: ["another-user"] },
      }]),
    ];
    jest.spyOn(global, "fetch").mockImplementation(async () => responses.shift()!);

    await expect(new KeycloakAdminClient(config).provision(user))
      .rejects.toThrow("keycloak_identity_owner_conflict");
  });

  it("removes stale managed roles when enabling an identity", async () => {
    const responses = [
      jsonResponse({ access_token: "token", expires_in: 60 }),
      new Response(null, { status: 204 }),
      jsonResponse([
        { id: "stale-role", name: "HR_ADMIN" },
        { id: "retained-role", name: "STORE_PERSONNEL" },
      ]),
      new Response(null, { status: 204 }),
    ];
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => responses.shift()!);

    await new KeycloakAdminClient(config).enable("subject-1", { ...user, provider_subject: "subject-1" });

    expect(fetchMock.mock.calls[3][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify([{ id: "stale-role", name: "HR_ADMIN" }]),
    });
  });

  it("disables the identity and logs out its sessions", async () => {
    const responses = [
      jsonResponse({ access_token: "token", expires_in: 60 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    ];
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => responses.shift()!);

    await new KeycloakAdminClient(config).disable("subject-1");

    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "PUT" });
    expect(String(fetchMock.mock.calls[2][0])).toContain("/logout");
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
