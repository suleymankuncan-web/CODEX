import type { PoolConfig } from "pg";
import type { DatabaseSslMode } from "../src/shared/app-config.service";
import { buildDatabasePoolConfig } from "../src/shared/database/database-pool-config";
import type { TargetClass } from "./database-invariant-preflight-core";

const databaseSslModes = new Set<DatabaseSslMode>([
  "disable",
  "require",
  "verify-full",
]);

export function buildDatabaseInvariantPreflightPoolConfig(
  targetClass: TargetClass,
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  const sslMode = readDatabaseSslMode(targetClass, env.DB_SSL_MODE);
  const sslCa = readOptionalSecret(env.DB_SSL_CA);

  if (targetClass === "staging" && sslMode !== "verify-full") {
    throw new Error("staging_verify_full_required");
  }
  if (targetClass === "staging" && !sslCa) {
    throw new Error("staging_ssl_ca_missing");
  }

  return buildDatabasePoolConfig({
    connectionTimeoutMs: 5_000,
    databaseUrl: connectionString,
    idleTimeoutMs: 1_000,
    poolMax: 1,
    queryTimeoutMs: 30_000,
    sslCa,
    sslMode,
    statementTimeoutMs: 30_000,
  });
}

function readDatabaseSslMode(
  targetClass: TargetClass,
  value: string | undefined,
): DatabaseSslMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return targetClass === "disposable" ? "disable" : "require";
  }
  if (!databaseSslModes.has(normalized as DatabaseSslMode)) {
    throw new Error("invalid_database_ssl_mode");
  }
  return normalized as DatabaseSslMode;
}

function readOptionalSecret(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
