import { AppConfigService } from "../../../shared/app-config.service";

describe("managed session configuration", () => {
  const base = { AUTH_MODE: "jwt", AUTH_CLIENT_ID: "app", AUTH_TOKEN_URL: "https://synthetic.invalid/token",
    BROWSER_SESSION_COOKIE_ENABLED: "true", BROWSER_SESSION_SECRET: "synthetic-secret-0123456789abcdef0123456789",
    MANAGED_BROWSER_SESSION_ENABLED: "true" };
  const config = (values: Record<string, string | undefined>) => new AppConfigService({ get: (key: string) => values[key] } as never);
  it("keeps the fixed managed cap separate from unchanged legacy expiry", () => {
    expect(config(base).managedBrowserSessionMaxSeconds).toBe(604800);
    expect(config(base).browserSessionTtlSeconds).toBe(900);
    expect(config({}).managedBrowserSessionEnabled).toBe(false);
  });
  it.each(["0", "-1", "Infinity", "604801", "1.5"])("rejects an invalid managed hard cap %s", (value) => {
    expect(() => config({ ...base, MANAGED_BROWSER_SESSION_MAX_SECONDS: value })).toThrow();
  });
  it.each([{ AUTH_MODE: "mock" }, { BROWSER_SESSION_COOKIE_ENABLED: "false" },
    { AUTH_CLIENT_ID: "" }, { AUTH_TOKEN_URL: "" }, { AUTH_RESPONSE_TYPE: "token" }])("fails closed for incompatible managed transport %#", (override) => {
    expect(() => config({ ...base, ...override })).toThrow("Managed browser sessions require");
  });
  it("refuses arbitrary plaintext production endpoints", () => {
    expect(() => config({ ...base, NODE_ENV: "production", AUTH_SESSION_ENDPOINT_URL: "http://untrusted.invalid/token" })).toThrow("must use https");
  });
});
