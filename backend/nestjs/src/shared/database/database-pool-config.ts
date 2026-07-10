import type { PoolConfig } from "pg";
import type { DatabaseSslMode } from "../app-config.service";

type DatabasePoolConfigInput = {
  connectionTimeoutMs: number;
  databaseUrl: string;
  idleTimeoutMs: number;
  poolMax: number;
  queryTimeoutMs: number;
  sslCa: string | undefined;
  sslMode: DatabaseSslMode;
  statementTimeoutMs: number;
};

const CONNECTION_STRING_SSL_PARAMETERS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
] as const;

export function buildDatabasePoolConfig(
  input: DatabasePoolConfigInput,
): PoolConfig {
  return {
    connectionString: removeConnectionStringSslOverrides(input.databaseUrl),
    connectionTimeoutMillis: input.connectionTimeoutMs,
    idleTimeoutMillis: input.idleTimeoutMs,
    max: input.poolMax,
    query_timeout: input.queryTimeoutMs,
    ssl: buildDatabaseSslConfig(input.sslMode, input.sslCa),
    statement_timeout: input.statementTimeoutMs,
  };
}

function buildDatabaseSslConfig(
  mode: DatabaseSslMode,
  ca: string | undefined,
): PoolConfig["ssl"] {
  if (mode === "disable") {
    return false;
  }

  if (mode === "require") {
    return { rejectUnauthorized: false };
  }

  if (!ca) {
    throw new Error("DB_SSL_CA must be configured when DB_SSL_MODE=verify-full");
  }

  return {
    ca,
    rejectUnauthorized: true,
  };
}

function removeConnectionStringSslOverrides(connectionString: string): string {
  const hasSslOverride = CONNECTION_STRING_SSL_PARAMETERS.some((parameter) =>
    new RegExp(`[?&]${parameter}=`, "i").test(connectionString),
  );

  if (!hasSslOverride) {
    return connectionString;
  }

  const parsed = new URL(connectionString);

  for (const parameter of CONNECTION_STRING_SSL_PARAMETERS) {
    parsed.searchParams.delete(parameter);
  }

  return parsed.toString();
}
