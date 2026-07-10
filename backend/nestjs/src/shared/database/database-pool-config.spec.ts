import { buildDatabasePoolConfig } from "./database-pool-config";

const baseInput = {
  connectionTimeoutMs: 5_000,
  databaseUrl: "postgres://user:password@localhost:5432/store_ops",
  idleTimeoutMs: 30_000,
  poolMax: 5,
  queryTimeoutMs: 65_000,
  statementTimeoutMs: 60_000,
} as const;

describe("buildDatabasePoolConfig", () => {
  it("maps every validated pool and timeout setting", () => {
    const result = buildDatabasePoolConfig({
      ...baseInput,
      sslCa: undefined,
      sslMode: "disable",
    });

    expect(result).toMatchObject({
      connectionString: baseInput.databaseUrl,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 5,
      query_timeout: 65_000,
      statement_timeout: 60_000,
      ssl: false,
    });
  });

  it("preserves provider connection strings byte-for-byte when no SSL override exists", () => {
    const opaqueProviderConnectionString = "provider-managed-connection-reference";
    const result = buildDatabasePoolConfig({
      ...baseInput,
      databaseUrl: opaqueProviderConnectionString,
      sslCa: undefined,
      sslMode: "require",
    });

    expect(result.connectionString).toBe(opaqueProviderConnectionString);
  });

  it("keeps controlled-pilot require mode explicitly encrypted but unverified", () => {
    const result = buildDatabasePoolConfig({
      ...baseInput,
      sslCa: undefined,
      sslMode: "require",
    });

    expect(result.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("keeps certificate rejection enabled for verify-full so untrusted certificates fail", () => {
    const result = buildDatabasePoolConfig({
      ...baseInput,
      sslCa: "test-provider-ca",
      sslMode: "verify-full",
    });

    expect(result.ssl).toEqual({
      ca: "test-provider-ca",
      rejectUnauthorized: true,
    });
    expect(result.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it("removes connection-string SSL overrides while preserving unrelated parameters", () => {
    const result = buildDatabasePoolConfig({
      ...baseInput,
      databaseUrl:
        "postgres://user:password@localhost:5432/store_ops?sslmode=disable&sslcert=client&sslkey=key&sslrootcert=root&application_name=hr-axis",
      sslCa: "test-provider-ca",
      sslMode: "verify-full",
    });

    const parsed = new URL(String(result.connectionString));
    expect(parsed.searchParams.get("application_name")).toBe("hr-axis");
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      expect(parsed.searchParams.has(key)).toBe(false);
    }
  });
});
