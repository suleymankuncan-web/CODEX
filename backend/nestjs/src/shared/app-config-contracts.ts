import type { AppConfigService } from "./app-config.service";

export function assertBrowserSessionConfiguration(config: Pick<AppConfigService, "managedBrowserSessionEnabled" | "browserSessionCookieEnabled" | "browserSessionSecret" | "managedBrowserSessionMaxSeconds" | "browserSessionPreviousSecret" | "browserSessionTtlSeconds" | "browserSessionRenewalWindowSeconds" | "browserSessionSameSite">) {
  config.managedBrowserSessionEnabled;
  if (!config.browserSessionCookieEnabled) {
    return;
  }

  config.browserSessionSecret;
  config.managedBrowserSessionEnabled;
  config.managedBrowserSessionMaxSeconds;
  config.browserSessionPreviousSecret;
  config.browserSessionTtlSeconds;
  config.browserSessionRenewalWindowSeconds;
  config.browserSessionSameSite;
}

export function assertDatabaseNumericConfiguration(config: Pick<AppConfigService, "dbPoolMax" | "dbConnectionTimeoutMs" | "dbIdleTimeoutMs" | "dbStatementTimeoutMs" | "redisOperationTimeoutMs" | "dailyClosurePollMinutes">) {
  config.dbPoolMax;
  config.dbConnectionTimeoutMs;
  config.dbIdleTimeoutMs;
  config.dbStatementTimeoutMs;
  config.redisOperationTimeoutMs;
  config.dailyClosurePollMinutes;
}

export function readManagedSessionMaximum(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error("MANAGED_BROWSER_SESSION_MAX_SECONDS must be a positive integer");
  if (value > 604800) throw new Error("Managed browser session maximum cannot exceed seven days");
  return value;
}

export function readManagedSessionEnabled(enabled: boolean,
  config: Pick<AppConfigService, "browserSessionCookieEnabled" | "authMode" | "authResponseType" | "authSessionTokenUrl" | "authClientId">) {
  if (enabled && (!config.browserSessionCookieEnabled || config.authMode !== "jwt" || config.authResponseType !== "code" || !config.authSessionTokenUrl || !config.authClientId)) {
    throw new Error("Managed browser sessions require JWT, cookie transport and a configured provider");
  }
  return enabled;
}
