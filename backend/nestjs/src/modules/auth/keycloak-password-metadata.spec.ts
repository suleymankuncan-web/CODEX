import { KeycloakAdminClient } from "./keycloak-admin.client";
import type { AppConfigService } from "../../shared/app-config.service";

describe("Keycloak password metadata", () => {
  const config = { keycloakAdminBaseUrl: "http://keycloak:8080", keycloakAdminRealm: "store-ops",
    keycloakAdminClientId: "synthetic", keycloakAdminClientSecret: "synthetic", authClientId: "store-ops-admin-web" } as AppConfigService;
  const owner = { id: "subject", email: "synthetic@example.invalid", attributes: { hr_axis_user_id: ["user"] } };
  const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const mock = (user: unknown, credentials: unknown) => {
    const replies = [response({ access_token: "synthetic", expires_in: 60 }), response(user), response(credentials)];
    return jest.spyOn(global, "fetch").mockImplementation(async () => replies.shift()!);
  };
  afterEach(() => jest.restoreAllMocks());
  it("returns only neutral password presence and date, ignoring OTP and credential secrets", async () => {
    const date = Date.now() - 1000;
    mock(owner, [{ type: "otp", createdDate: Date.now() }, { type: "password", createdDate: date,
      id: "private-credential-id", secretData: "private-hash", credentialData: "private-salt" }]);
    const result = await new KeycloakAdminClient(config).passwordMetadata("subject", "user", owner.email);
    expect(result).toEqual({ state: "present", setAt: date });
    expect(JSON.stringify(result)).not.toMatch(/private|otp|secretData|credentialData/);
  });
  it.each([undefined, "invalid", -1, Date.now() + 600_000])("keeps a missing or invalid date unknown: %s", async createdDate => {
    mock(owner, [{ type: "password", createdDate }]);
    expect(await new KeycloakAdminClient(config).passwordMetadata("subject", "user", owner.email)).toEqual({ state: "present", setAt: null });
  });
  it("does not claim absent password for a federated account", async () => {
    mock({ ...owner, federationLink: "synthetic-storage" }, []);
    expect(await new KeycloakAdminClient(config).passwordMetadata("subject", "user", owner.email)).toEqual({ state: "unknown", setAt: null });
  });
  it.each([{ ...owner, id: "other" }, { ...owner, email: "other@example.invalid" }, { ...owner, attributes: {} }])("refuses mismatched account ownership before reading credentials", async user => {
    const fetch = mock(user, []);
    await expect(new KeycloakAdminClient(config).passwordMetadata("subject", "user", owner.email)).rejects.toThrow("keycloak_identity_owner_conflict");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("sends reset actions without a PKCE callback lacking browser state", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValueOnce(response({ access_token: "synthetic" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await new KeycloakAdminClient(config).sendPasswordLink("subject", "reset");
    const url = new URL(String(fetch.mock.calls[1][0]));
    expect(url.searchParams.get("lifespan")).toBe("86400");
    expect(url.searchParams.get("client_id")).toBe("store-ops-admin-web");
    expect(url.searchParams.has("redirect_uri")).toBe(false);
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual(["UPDATE_PASSWORD"]);
  });
});
